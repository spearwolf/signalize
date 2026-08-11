import {
  type EventizedObject,
  emit,
  eventize,
  getSubscribedEventNames,
  off,
  on,
  once,
} from '@spearwolf/eventize';
import {getCurrentBatch, isFlushingBatch} from './batch.js';
import {isQuiet} from './bequiet.js';
import {
  collect,
  collectDeliveryError,
  throwCollectedErrors,
} from './collect-errors.js';
import {
  $createEffect,
  $destroyEffect,
  $destroySignal,
  $effectError,
  DESTROY,
  RECALL,
} from './constants.js';
import {Effect} from './Effect.js';
import {
  globalDestroySignalQueue,
  globalEffectCalledQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './global-queues.js';
import {getCurrentEffect, runWithinEffect} from './globalEffectStack.js';
import {SignalGroup} from './SignalGroup.js';
import {signalImpl} from './signal-core.js';
import {reportSignalizeError} from './signalize-error.js';
import type {
  EffectCallback,
  EffectErrorPayload,
  EffectErrorPhase,
  SignalLike,
  VoidFunc,
} from './types.js';
import {UniqIdGen} from './UniqIdGen.js';

export type EffectDeps = (SignalLike<any> | string | symbol)[];

/** Deps array containing only SignalLike entries — no group needed. */
export type SignalLikeDeps = SignalLike<any>[];

/**
 * The wide form of the effect options — what the `EffectImpl` constructor
 * takes, not what a `createEffect()` call site accepts.
 *
 * Its `dependencies` may hold names while `attach` stays optional, and that
 * is exactly the pairing the four `createEffect()` overloads forbid: a name
 * without a group throws at runtime. A caller holding an options object in a
 * variable therefore names {@link EffectOptionsWithSignalDeps} or
 * {@link EffectOptionsWithNameDeps}; passing a variable of this type reports
 * `TS2769`.
 */
export interface EffectOptions {
  autorun?: boolean;
  dependencies?: EffectDeps;
  attach?: object | SignalGroup;
  priority?: number;
}

/**
 * Effect options whose `dependencies` (if any) contain only SignalLike
 * entries. `attach` stays optional because no name lookup is needed.
 */
export interface EffectOptionsWithSignalDeps {
  autorun?: boolean;
  dependencies?: SignalLikeDeps;
  attach?: object | SignalGroup;
  priority?: number;
}

/**
 * Effect options whose `dependencies` array contains at least one
 * string/symbol entry. Such names are resolved via a SignalGroup, so
 * `attach` is **required** by the type system — preventing the runtime
 * TypeError that would otherwise be thrown when `group.signal(name)` is
 * called on an undefined group.
 */
export interface EffectOptionsWithNameDeps {
  autorun?: boolean;
  dependencies: EffectDeps;
  attach: object | SignalGroup;
  priority?: number;
}

const isThenable = (value: unknown): value is Promise<unknown> =>
  value != null && typeof (value as Promise<unknown>).then === 'function';

/**
 * Route an error that surfaced after the synchronous call stack was gone.
 *
 * A promise returned by an effect or cleanup callback rejects with nobody
 * left to throw at — rethrowing here would just produce another unhandled
 * rejection, which since Node 15 terminates the process. So the failure goes
 * out on the global effect queue where `onEffectError()` handlers pick it up.
 *
 * With no handler registered it would vanish silently, and a silent swallow
 * is worse than the crash we came from, so it falls back to the general
 * diagnostics channel — `onSignalizeError()` handlers get it with
 * `source: 'effect'`, and with nobody listening there either it reaches
 * `console.error` as before. That fallback carries the effect id and the
 * phase inside the message text, not as fields; only `onEffectError()` hands
 * them out structured. A handler that throws is treated the same way:
 * reported, never re-raised.
 *
 * Note the cost of the handler probe: `getSubscribedEventNames()` builds an
 * array holding one entry per subscribed event name — and every live effect
 * subscribes to the queue by its own id — which is then scanned linearly.
 * A storm of failures across many effects is therefore quadratic. Acceptable
 * because this is the error path and errors are meant to be rare; if that
 * ever stops being true, cache the answer and invalidate it in
 * `onEffectError()`'s subscribe/unsubscribe.
 */
const emitEffectError = (
  effect: EffectImpl,
  error: unknown,
  phase: EffectErrorPhase,
): void => {
  if (getSubscribedEventNames(globalEffectQueue).includes($effectError)) {
    const payload: EffectErrorPayload = {
      error,
      effect,
      effectId: effect.id,
      phase,
    };
    try {
      emit(globalEffectQueue, $effectError, payload);
      return;
    } catch (handlerError) {
      console.error(
        `[signalize] an onEffectError handler threw while reporting an error of effect ${effect.id.toString()}:`,
        handlerError,
      );
    }
  }

  reportSignalizeError({
    level: 'error',
    source: 'effect',
    message: `[signalize] unhandled rejection in the ${phase} of effect ${effect.id.toString()}:`,
    error,
  });
};

/**
 * The snapshot/prune pair of `#lostSignals` for a single dynamic run, with
 * the "may I commit" criterion that belongs to it.
 *
 * BUG-005: `readSignal()` reports a read only while no quiet frame is
 * open (`src/signal-core.ts:34`), so a run inside `beQuiet()` re-reads
 * nothing this instance can hear. Filling `#lostSignals` anyway and
 * pruning afterwards would therefore unsubscribe *every* dependency
 * the effect had — permanently: nothing wakes it again, `run()` finds
 * `shouldRun === false`, and it sits in `getEffectsCount()` as a deaf
 * shell. Snapshot and prune are a matched pair; a run that could not
 * record what it might lose must not throw anything away either.
 * Taken once, up front, so both halves below decide by the same
 * value.
 *
 * Both halves sit in {@link EffectImpl.runDynamicCallback}: the snapshot
 * under `active`, the prune under {@link TrackedReadScope.mayCommit}.
 */
class TrackedReadScope {
  readonly active: boolean;
  readonly #readsBefore: number;
  #completed = false;

  constructor(active: boolean, readsBefore: number) {
    this.active = active;
    this.#readsBefore = readsBefore;
  }

  complete(): void {
    this.#completed = true;
  }

  /**
   * The second half of the BUG-006 note that stands at the `finally` in
   * {@link EffectImpl.runDynamicCallback} — read that one first; the
   * `though` below turns against it.
   *
   * A throw is only allowed to commit what the run actually got to
   * see, though. `#lostSignals` starts out as *every* dependency and
   * is emptied read by read, so a callback that throws before its
   * first read leaves it complete — pruning there would read "not
   * read anymore" off a run that never got as far as reading, and
   * unsubscribe the lot. That is the deaf shell of BUG-005 again,
   * reached from the other side: one transient failure and the effect
   * never wakes again. A run that did read commits its partial set as
   * before (that is BUG-006, and it heals on the next run because
   * something is still subscribed); a completed run always commits,
   * including the one that legitimately read nothing at all.
   */
  mayCommit(readsNow: number): boolean {
    return this.active && (this.#completed || readsNow > this.#readsBefore);
  }
}

// Eventize injects EventizedObject members at runtime via eventize(this) in
// the constructor — declaration merging tells TS the brand is present.
export interface EffectImpl extends EventizedObject {}

export class EffectImpl {
  private static idGen = new UniqIdGen('ef');

  /** global effect counter */
  static count = 0;

  /**
   * Maximum allowed re-entrant depth of `EffectImpl.run()`.
   *
   * Effects that synchronously write to a signal they depend on re-enter
   * `run()` recursively. Without a guard, a runaway loop would terminate
   * with a native `RangeError` (stack overflow) at an arbitrary depth.
   *
   * When the counter exceeds this limit, `run()` throws a descriptive
   * `Error` instead, naming the effect id and the limit. The default of
   * 256 is well above realistic legitimate fixpoint iterations and well
   * below the JS stack limit on common engines.
   *
   * This property is the storage, not the way in: it is unexported, and the
   * `exports` map bars deep imports. Read and write it through
   * `setMaxEffectDepth()` / `getMaxEffectDepth()` — and only where the
   * recursion is intentional, since breaking the cycle is the usual repair.
   */
  static maxDepth = 256;

  /** unique effect id */
  readonly id: symbol;

  /** the effect callback */
  readonly callback: EffectCallback;

  #nextCleanupCallback?: VoidFunc;

  readonly #signals: Set<symbol> = new Set();

  #lostSignals: Set<symbol> = new Set();
  readonly #signalSubscriptions: Map<symbol, Array<() => void>> = new Map();

  /**
   * Monotonic count of tracked reads this effect has seen, over its whole
   * lifetime. Only ever compared against a value a single `run()` frame took
   * before invoking the callback — "did anything get read since?" — never
   * read for its absolute value. A counter rather than a flag because a
   * frame's baseline has to survive a nested run bumping it.
   */
  #trackedReads = 0;

  readonly #destroyedSignals: Set<symbol> = new Set();

  /**
   * Effects created while this effect's callback was on the effect stack.
   * Destroyed and rebuilt from scratch on every rerun — there is no slot
   * recycling; see {@link collectDestroyChildEffects}.
   */
  private readonly childEffects: EffectImpl[] = [];

  autorun = true;
  shouldRun = true;

  /**
   * Set while an explicitly requested run of a **non-autorun** effect sits
   * parked in an open batch (ASYNC-002).
   *
   * `[RECALL]` drops the flush's redispatch for a non-autorun effect — that
   * is what `{autorun: false}` means for a *signal write*. But `run()` is
   * not a signal write: somebody asked, in so many words, for this effect
   * to run, and the batch only ever promised to postpone that run, not to
   * swallow it. The note is what tells the two apart at the flush, where
   * the effect id is all that arrives.
   *
   * Cleared by the run that honours it, not by `[RECALL]`: a request can
   * also be spent by a run that happened for another reason before the
   * flush got to it — the batch then dedups its RECALL away, and the note
   * would stay armed for the next unrelated write. That is the moment
   * `{autorun: false}` would silently have become `true`.
   */
  #explicitRunRequested = false;

  readonly priority: number;

  #dependencies?: SignalLike<unknown>[];

  #destroyed = false;

  /**
   * Whether `destroy()` has already run.
   *
   * Exposed so a caller that missed the synchronous window for subscribing
   * to `DESTROY` — the effect died during its own construction, before
   * control returned to them — can tell "already gone" apart from "still
   * alive" instead of registering a `once` that will never fire. See
   * `Effect#onDestroy()`.
   */
  get destroyed(): boolean {
    return this.#destroyed;
  }

  #runDepth = 0;

  /**
   * Set when the `[$destroySignal]` handler found nothing left that could
   * trigger this effect *while a run was in progress* — see
   * {@link destroyWhenUntriggerable}.
   *
   * Consumed at the end of the outermost `run()` — in its `finally`, so a
   * run that threw settles it too — which re-checks the condition against the
   * dependency set the callback actually built and only then destroys.
   */
  #selfDestroyPending = false;

  /**
   * Monotonically increasing run counter, bumped before each callback
   * invocation. An async callback captures the value it ran under; when its
   * promise settles later the captured value is compared against the current
   * one to tell a still-current run from a superseded one.
   */
  #generation = 0;

  /**
   * Set while a **static-deps** callback is running.
   *
   * Such an effect still runs on the global effect stack — that is what makes
   * effects created inside it child effects that die with their parent. But
   * being on the stack is also what `readSignal()` looks for, so without this
   * flag a static-deps effect would suddenly subscribe to everything its
   * callback reads. The flag draws the line: visible as the current effect,
   * deaf to signal reads.
   *
   * `saveSignalsFromDeps()` calls `whenSignalIsRead()` too and is not spared
   * by timing — create a static-deps effect inside another effect's callback
   * and it runs in the middle of a run. What spares it is the instance: it
   * runs on the freshly constructed effect, whose own flag is still `false`.
   * The suppression is per instance and never consulted through anything but
   * `this`, so a suppressed parent cannot silence a child.
   *
   * Saved and restored rather than cleared: an effect that writes a signal it
   * depends on re-enters `run()`, and the inner run must not un-suppress the
   * outer one on its way out.
   */
  #suppressAutoTracking = false;

  /**
   * An effect subscribes to the _global effects queue_ by its `id`.
   * When triggered by its `id`, the _effect callback_ is executed.
   *
   * While the _effect callback_ is being executed, the effect instance is pushed onto the _global effect stack_.
   * If a _signal_ is read during the execution of the _effect callback_
   * it recognizes the effect and executes the `effect.onReadSignal()` method.
   *
   * The effect then knows which signals are calling it and subscribes to those signal ids in the _global signals queue_.
   *
   * Please do not call this constructor directly, use `createEffect()` instead.
   */
  constructor(callback: EffectCallback, options?: EffectOptions) {
    eventize(this);

    this.callback = callback;

    // Resolved eagerly because dependency resolution below needs it for
    // name lookups (`group.signal(dep)`, a read-only operation). Attaching
    // `this` to the group is deferred until after that resolution succeeds
    // — see the `group?.attachEffect(this)` call near the end of this
    // constructor for why.
    const group: SignalGroup | undefined =
      options?.attach != null
        ? SignalGroup.findOrCreate(options.attach)
        : undefined;

    this.autorun = options?.autorun ?? true;

    this.#dependencies = options?.dependencies
      ? options.dependencies.map((dep) => {
          switch (typeof dep) {
            case 'string':
            case 'symbol': {
              // The overloads require `attach` whenever `dependencies`
              // contains a string/symbol — but that is a compile-time-only
              // guarantee. A JavaScript consumer (or anyone bypassing the
              // types) can still reach this with no group at all, or with a
              // group that never registered `dep` as a named signal. Both
              // are user mistakes worth naming precisely instead of
              // surfacing as an opaque TypeError from a null deref further
              // down the line (BUG-003).
              if (group == null) {
                throw new Error(
                  `[signalize] createEffect: cannot resolve dependency "${String(dep)}" — no SignalGroup is attached (missing "attach" option)`,
                );
              }
              const signal = group.signal(dep);
              if (signal == null) {
                throw new Error(
                  `[signalize] createEffect: cannot resolve dependency "${String(dep)}" — no signal with that name is registered in the attached SignalGroup`,
                );
              }
              return signal;
            }
            default:
              return dep;
          }
        })
      : undefined;

    // a batch will call the effect by id to run the effect
    this.id = EffectImpl.idGen.make();

    this.priority = options?.priority ?? 0;

    on(globalEffectQueue, this.id, RECALL, this);

    // Deferred from where `group` was resolved above: attaching before
    // dependency resolution could succeed left a half-built instance
    // registered in the group's `#effects` set whenever a name lookup threw
    // (BUG-003). Such an instance never reaches `++EffectImpl.count` below,
    // but a later `destroy()` on it — reachable through the group's own
    // teardown — decrements that counter regardless, since every field
    // `destroy()` touches has a default initializer and none of it requires
    // `this.id`. The counter then drifts permanently negative, which is
    // exactly what `assertEffectsCount()` polices in nearly every spec file.
    // Attaching only after the constructor is certain to complete keeps the
    // group's bookkeeping symmetric with the counter's.
    group?.attachEffect(this);

    ++EffectImpl.count;
  }

  private hasStaticDeps() {
    return this.#dependencies != null && this.#dependencies.length > 0;
  }

  /**
   * (Re-)declare the static dependency set.
   *
   * Called once at construction and again at the top of every run. The
   * second call is what makes `SignalGroup.off()` a pause rather than a
   * one-way door for a static-deps effect: the soft-detach drops the
   * subscription, and the effect's next run puts it back — the same moment
   * a dynamic effect re-subscribes, and by the same trigger, except that
   * this one re-declares where the other re-reads (BUG-003).
   *
   * A destroyed dependency is skipped. `whenSignalIsRead()` cannot tell the
   * difference, but the dynamic path can and does — `signalReader` reports
   * a read only while the signal is alive (`createSignal.ts`). Without the
   * same guard here, a dependency that was soft-detached and *then*
   * destroyed would be re-subscribed on the next run: the effect stopped
   * listening for that signal's destruction when it detached, so it never
   * heard it die. That subscription is unremovable short of `destroy()` —
   * `globalDestroySignalQueue` fires once per signal and already has — and
   * it keeps `hasNoLiveSignals()` false forever, so the effect no longer
   * notices when its last *live* dependency goes.
   */
  private saveSignalsFromDeps() {
    for (const sig of this.#dependencies!) {
      const signal = signalImpl(sig);
      if (signal.destroyed) continue;
      this.whenSignalIsRead(signal.id);
    }
  }

  // Overload 1: options-only form with pure-SignalLike deps (or no deps).
  // `attach` is optional because no name lookup is needed.
  static createEffect(
    callback: EffectCallback,
    options?: EffectOptionsWithSignalDeps,
  ): Effect;
  // Overload 2: options-only form with string/symbol deps. The conditional
  // type forces `attach` to be present — without a group, name lookup
  // would throw at runtime.
  static createEffect(
    callback: EffectCallback,
    options: EffectOptionsWithNameDeps,
  ): Effect;
  // Overload 3: positional deps, SignalLike-only — `attach` optional.
  static createEffect(
    callback: EffectCallback,
    dependencies: SignalLikeDeps,
    options?: Omit<EffectOptionsWithSignalDeps, 'dependencies'>,
  ): Effect;
  // Overload 4: positional deps containing string/symbol — options is
  // required and must carry `attach`.
  static createEffect(
    callback: EffectCallback,
    dependencies: EffectDeps,
    options: Omit<EffectOptionsWithNameDeps, 'dependencies'>,
  ): Effect;
  static createEffect(
    callback: EffectCallback,
    optsOrDeps?: EffectOptions | EffectDeps,
    opts?: EffectOptions,
  ): Effect {
    const dependencies = Array.isArray(optsOrDeps) ? optsOrDeps : undefined;

    // Build a fresh options object instead of writing into the caller's own
    // `opts` — mutating it would corrupt a shared options object reused
    // across multiple createEffect() calls (BUG-005).
    const options: EffectOptions | undefined = dependencies
      ? {...opts, dependencies}
      : (optsOrDeps as EffectOptions | undefined);

    const effect = new EffectImpl(callback, options);

    // BUG-012, from the other side: the constructor has counted and
    // subscribed, but the caller holds nothing yet. If anything behind it
    // throws, `new Effect(effect)` is never reached and the effect is
    // unreachable for everyone — unless something else is already holding
    // it. `{attach}` is exactly that holder: the constructor has put the
    // effect into the group, `clear()` still reaches it, and docs/api.md
    // promises such an effect stays usable and runs again on the next
    // change. So the rollback is for the unheld case, and there it follows
    // the rule `run()` already follows: a run that throws still leaves the
    // effect in a defined state. The teardown must neither replace nor
    // displace the creation error, hence collecting instead of `throw err`.
    try {
      // An effect born while another effect's callback is running belongs to
      // that effect and dies with it — see collectDestroyChildEffects().
      getCurrentEffect()?.attachChildEffect(effect);

      emit(globalEffectQueue, $createEffect, effect);

      if (effect.hasStaticDeps()) {
        if (!effect.destroyed) {
          effect.saveSignalsFromDeps();
        }
      } else if (effect.autorun) {
        effect.run();
      }
    } catch (err) {
      const errors: unknown[] = [err];
      if (options?.attach == null) {
        collect(errors, () => effect.destroy());
      }
      throwCollectedErrors(errors, 'creating an effect');
    }

    return new Effect(effect);
  }

  private attachChildEffect(effect: EffectImpl): void {
    this.childEffects.push(effect);
  }

  /**
   * Run the _effect callback_.
   *
   * Before the _effect callback_ is executed, the _cleanup callback_ (if any) is executed.
   *
   * While the _effect callback_ is being executed, the effect instance is placed on top of the _global effect stack_.
   *
   * The optional return value of the _effect callback_ is stored as the next _cleanup callback_.
   */
  run = (): void => {
    this.#run(false);
  };

  /**
   * Run the effect callback now, even while a batch is open.
   *
   * The entry point for a read that demands a current value — a memo's
   * `beforeRead` (ASYNC-003). Everything else about the run is identical,
   * including that its own writes go into the open batch.
   *
   * @internal
   */
  runImmediately = (): void => {
    this.#run(true);
  };

  #run(immediate: boolean): void {
    if (this.#destroyed) return;
    if (!this.shouldRun) return;

    const curBatch = getCurrentBatch();
    if (curBatch) {
      if (!immediate) {
        // ASYNC-002: the id is the only thing that reaches the flush, and
        // `[RECALL]` cannot tell a redispatched write from a run somebody
        // asked for. The note travels with the effect instead.
        if (!this.autorun) {
          this.#explicitRunRequested = true;
        }
        curBatch.batch(this.id, this.priority);
        return;
      }
      // ASYNC-003: a read that demands a current value is not deferrable —
      // postponing it does not delay the answer, it falsifies it. The write
      // this run is about to make still goes into the open batch, and that
      // is the point: the value is current *and* the notification stays
      // grouped. What the queue must not keep is the run itself, which is
      // happening right now; left in there it would recompute a second time
      // at the flush.
      curBatch.unbatch(this.id, this.priority);
    }

    this.#explicitRunRequested = false;

    if (this.#runDepth >= EffectImpl.maxDepth) {
      throw new Error(
        `[signalize] Effect ${this.id.toString()} exceeded maxDepth=${EffectImpl.maxDepth}: ` +
          'an effect callback recursively re-triggered itself (likely by writing a signal it depends on). ' +
          'Break the cycle, or raise the cap with setMaxEffectDepth(n) if the recursion is intentional.',
      );
    }

    this.#runDepth++;
    try {
      this.runCleanupCallback();
      this.destroyChildEffects();

      this.shouldRun = false;

      // Only a running flush listens on that queue (PERF-003), and it is the
      // only thing the emit is for: telling the flush this effect has already
      // run so it is not recalled a second time. Outside a flush the emit was
      // an eventize dispatch for zero listeners, on every single effect run.
      if (isFlushingBatch()) {
        emit(globalEffectCalledQueue, this.id, this.id);
      }

      // Bumped here, not at the top of run(): the callbacks must be numbered
      // in the order they are *invoked*. A cleanup above can re-enter run()
      // — the inner run then finishes before this outer callback is even
      // called, and only a bump at this point gives the outer run the higher
      // generation its later-settling promise will be compared against.
      // Bumping earlier would also count a run that never reached its
      // callback, because the cleanup or a child's teardown threw.
      const generation = ++this.#generation;

      if (this.hasStaticDeps()) {
        this.runStaticCallback(generation);
      } else {
        this.runDynamicCallback(generation);
      }
    } finally {
      this.#runDepth--;

      // Deferred self-destruction — see #selfDestroyPending. In the `finally`
      // because a run that throws leaves the effect just as unwakeable as one
      // that returns: skipping the teardown there would strand it in
      // getEffectsCount() and on the effect queue forever, since the very
      // condition that set the flag means no further run is coming.
      //
      // The teardown gets its own guard so it cannot displace whatever the
      // run is already propagating. A cleanup that throws during this
      // destroy() goes to the error channel instead — same treatment an
      // async cleanup's rejection gets, and for the same reason: there is
      // nobody left to throw it at.
      if (this.#runDepth === 0 && this.#selfDestroyPending) {
        this.#selfDestroyPending = false;
        if (!this.#destroyed && this.hasNoLiveSignals()) {
          try {
            this.destroy();
          } catch (err) {
            emitEffectError(this, err, 'cleanup');
          }
        }
      }
    }
  }

  private runStaticCallback(generation: number): void {
    // Re-declare before the callback, not after: a callback that throws
    // must not cost the effect its subscriptions — the same reason the
    // dynamic branch prunes in a `finally` (BUG-006). Idempotent, because
    // `whenSignalIsRead()` subscribes only to ids it does not already
    // hold, so an ordinary rerun changes nothing — it pays two property
    // reads, a `#lostSignals.delete()`, a `#signals.has()` and a counter
    // bump per declared dependency, which is measurable only against an
    // empty callback. A run re-entered from inside this effect's own
    // callback finds `#suppressAutoTracking` set and re-declares nothing
    // — harmless, the outer run did it already.
    this.saveSignalsFromDeps();
    this.storeCleanupCallback(this.runWithoutAutoTracking(), generation);
  }

  private runDynamicCallback(generation: number): void {
    const scope = new TrackedReadScope(!isQuiet(), this.#trackedReads);

    // Guarded, because a run inside `beQuiet()` hears no reads and must
    // therefore not snapshot either — see TrackedReadScope for what an
    // unguarded snapshot costs the effect.
    if (scope.active) {
      this.#lostSignals.clear();
      for (const id of this.#signals) {
        this.#lostSignals.add(id);
      }
    }

    try {
      this.storeCleanupCallback(
        runWithinEffect(this, this.callback),
        generation,
      );
      scope.complete();
    } finally {
      // BUG-006: the callback is application code and may throw. Without
      // this `finally` the prune was skipped while `shouldRun` was already
      // `false` and the cleanup already consumed — the effect kept a live
      // RECALL subscription on a signal it no longer reads, every write to
      // which re-triggered it into (typically) the same throw. It also
      // left `hasNoLiveSignals()` — and therefore the deferred
      // self-destruction below — reading a dependency set that no run
      // built. It healed on the next successful run, which a
      // deterministically failing callback never has.
      if (scope.mayCommit(this.#trackedReads)) {
        this.cleanupLostSignals();
        this.#destroyedSignals.clear();
      }
    }
  }

  /**
   * Run the callback on the effect stack with subscribe-on-read turned off —
   * the static-deps counterpart to the plain `runWithinEffect()` call in the
   * dynamic branch. See the `#suppressAutoTracking` field.
   */
  private runWithoutAutoTracking(): unknown {
    const wasSuppressed = this.#suppressAutoTracking;
    this.#suppressAutoTracking = true;
    try {
      return runWithinEffect(this, this.callback);
    } finally {
      this.#suppressAutoTracking = wasSuppressed;
    }
  }

  /**
   * Eventually run the _effect callback_
   *
   * If the _autorun_ flag is activated, then the effect is executed immediately in any case.
   * Otherwise the effect is only executed if it is necessary.
   *
   * The necessity is given if
   * - the effect has been initialized but has not yet run
   * - a signal used in the effect has changed
   *
   * A callback that throws no longer ends the delivery it was part of: the
   * failure is collected and re-raised once every other subscriber of that
   * write has run. A `run()` outside a delivery — `effect.run()`, a
   * hand-emitted RECALL — still throws immediately, at its caller.
   *
   * A `run()` an open batch parked is carried out here when the batch
   * closes, `autorun` or not (ASYNC-002): what the missing `autorun` waives
   * is the redispatch of a *write*, never a run somebody asked for.
   */
  [RECALL]() {
    this.shouldRun = true;
    if (!this.autorun && !this.#explicitRunRequested) return;
    try {
      this.run();
    } catch (err) {
      // BUG-004: this is the listener eventize calls, and the only place
      // where swallowing helps — one frame further out, around `emit()`,
      // the dispatch loop has already given up on the siblings. Isolation
      // is a property of the *delivery*, not of `run()`: without an open
      // frame (a direct `effect.run()`, a hand-emitted RECALL) the error
      // belongs to whoever asked for the run and is rethrown here.
      if (!collectDeliveryError(err)) throw err;
    }
  }

  whenSignalIsRead(signalId: symbol): void {
    // destroy()'s off() calls have already run and discarded the unsubscribe
    // handles — a subscription created after that point would be unremovable.
    if (this.#destroyed) return;
    if (this.#suppressAutoTracking) return;

    this.#trackedReads++;
    this.#lostSignals.delete(signalId);

    if (!this.#signals.has(signalId)) {
      this.#signals.add(signalId);

      this.#signalSubscriptions.set(signalId, [
        on(globalSignalQueue, signalId, this.priority, RECALL, this),
        once(globalDestroySignalQueue, signalId, $destroySignal, this),
      ]);
    }
  }

  [$destroySignal](signalId: symbol, params?: {detach?: boolean}): void {
    // BUG-011: this is the listener eventize calls, and — exactly as in
    // `[RECALL]` — the only place where swallowing helps. One frame
    // further out, around `emit()`, the dispatch loop has already given
    // up on every subscriber behind this one: the link that is still
    // attached to the dead source, the group that still holds the dead
    // SignalImpl, the auto map entry that is still there.
    //
    // Which frame that is, matters. `collectDeliveryError()` knows only
    // the delivery *depth*, and that counter is module-global: an open
    // frame is no proof that it belongs to this delivery. Two emitters
    // reach this queue, and only one of them opens a frame. A hard
    // destroy always parks in its own — `destroySignal()` opens it per
    // signal id, immediately around its own emit. The soft-detach comes
    // from `SignalGroup#off()`, which opens none and collects per signal
    // itself; parking there would hand the failure to whatever frame
    // happens to be open further out — the write's, when the `off()` runs
    // from an effect callback — and `off()` would return successfully
    // while its own report lost the entry. A silent success is the worst
    // error shape there is, so a detach rethrows, and so does a destroy
    // with no frame at all.
    //
    // That guard and the missing frame are one decision, not two: giving
    // `SignalGroup#off()` a frame of its own — the obvious first move for
    // anyone isolating the soft-detach path — changes nothing here, because
    // `params?.detach` still rethrows before the frame is ever asked. The
    // next step then looks like dropping this condition, and that is
    // exactly how the silent success comes back. What such a frame needs is
    // identity — a token the frame carries and this listener compares
    // against its own delivery — not one condition fewer.
    try {
      this.onSignalDestroyed(signalId, params);
    } catch (err) {
      if (params?.detach || !collectDeliveryError(err)) throw err;
    }
  }

  private onSignalDestroyed(
    signalId: symbol,
    params?: {detach?: boolean},
  ): void {
    if (!this.#signals.has(signalId)) return;

    if (params?.detach) {
      // Soft-detach: the signal stays alive; we just drop our subscription.
      // Removing the id from #signals (and any prior destroyed-marker) lets
      // a later whenSignalIsRead() re-subscribe cleanly when the effect
      // runs again and re-reads this signal.
      this.unsubscribeSignal(signalId);
      this.#signals.delete(signalId);
      this.#destroyedSignals.delete(signalId);
      this.#lostSignals.delete(signalId);

      if (this.hasNoLiveSignals()) {
        // no signals left, so nobody can trigger this effect anymore
        this.destroyWhenUntriggerable();
      }
      return;
    }

    if (!this.#destroyedSignals.has(signalId)) {
      this.#destroyedSignals.add(signalId);

      this.unsubscribeSignal(signalId);

      if (this.hasNoLiveSignals()) {
        // no signals left, so nobody can trigger this effect anymore
        this.destroyWhenUntriggerable();
      }
    }
  }

  /**
   * Nothing is left that could trigger this effect, so it destroys itself —
   * but not from inside its own `run()`.
   *
   * A running effect is in the middle of rebuilding its dependency set: the
   * old subscriptions are still listed while the callback has not yet
   * re-read anything. An emptied set at that moment says nothing about the
   * effect's future. It happens routinely — an effect whose dependencies are
   * all self-created (`createMemo()` in the body) sees every one of them
   * destroyed by `destroyChildEffects()` before the callback runs, and would
   * otherwise kill itself on its very first rerun, mid-run, with `run()`
   * carrying on regardless because it checks `#destroyed` only on entry.
   *
   * So the verdict is postponed to the end of the outermost run, where it is
   * re-checked against the dependency set the callback actually built. An
   * effect that really did lose everything still dies — one run later, not
   * never.
   */
  private destroyWhenUntriggerable(): void {
    if (this.#runDepth > 0) {
      this.#selfDestroyPending = true;
      return;
    }
    this.destroy();
  }

  /**
   * Whether nothing tracked can wake this effect anymore.
   *
   * `#signalSubscriptions` is the honest register for that question — an
   * entry exists exactly as long as the effect holds a live `RECALL`
   * subscription for that signal, and both teardown paths
   * (`[$destroySignal]`, `cleanupLostSignals()`) remove it. `#signals` and
   * `#destroyedSignals` cannot answer it at the end of a run: the dynamic
   * branch clears the destroyed-markers there, and a signal destroyed *after*
   * the callback read it stays listed in `#signals` unsubscribed.
   *
   * `[$destroySignal]` reads it too, in both its soft- and hard-destroy
   * branches — not just `run()`. That decouples correctness from teardown
   * order: a hard-destroyed signal is never removed from `#signals` (only
   * marked in `#destroyedSignals`), so a soft-detach arriving afterwards for
   * a different signal would never see `#signals` empty even though nothing
   * live remains to trigger the effect.
   */
  private hasNoLiveSignals(): boolean {
    return this.#signalSubscriptions.size === 0;
  }

  private cleanupLostSignals(): void {
    for (const signalId of this.#lostSignals) {
      this.unsubscribeSignal(signalId);
      this.#signals.delete(signalId);
    }
  }

  /**
   * Destroy every child effect and empty the child list.
   *
   * A child whose teardown throws must not take its siblings with it: an
   * undestroyed sibling keeps its queue subscriptions and goes on reacting
   * to signal writes long after its parent is gone. So each child is
   * destroyed under its own guard, the errors are collected, and only
   * afterwards re-raised — one error unchanged, several as an
   * `AggregateError`.
   *
   * The early return is exactly equivalent to running the body on an empty
   * list: the loop below iterates zero times, `childEffects.length = 0` on
   * an empty array is a no-op, and `throwCollectedErrors()` returns
   * immediately for an empty list. It is here because `#run()` calls this
   * method on *every* rerun while the overwhelming majority of effects never
   * have a child — without it, each rerun allocated an error array and paid
   * a call for nothing (PERF-001).
   */
  private destroyChildEffects(): void {
    if (this.childEffects.length === 0) return;

    const errors: unknown[] = [];
    this.collectDestroyChildEffects(errors);
    throwCollectedErrors(errors, 'destroying an effect');
  }

  /**
   * The body of {@link destroyChildEffects}, but appending to a caller-owned
   * error list instead of throwing. Lets `destroy()` merge the child errors
   * with an error from its own cleanup into a single report.
   */
  private collectDestroyChildEffects(errors: unknown[]): void {
    for (const effect of this.childEffects) {
      collect(errors, () => effect.destroy());
    }
    this.childEffects.length = 0;
  }

  private unsubscribeSignal(signalId: symbol): void {
    if (this.#signalSubscriptions.has(signalId)) {
      this.#signalSubscriptions.get(signalId).forEach((unsubscribe) => {
        unsubscribe();
      });
      this.#signalSubscriptions.delete(signalId);
    }
  }

  /**
   * Take what the effect callback returned and remember it as the next
   * cleanup callback — or, if that cleanup arrived too late to be anyone's
   * *next* one, run it right away.
   *
   * A synchronous return value is stored as is. An `async` callback returns
   * a promise instead, and by the time it settles the world may have moved
   * on: the effect may have run again — acquiring fresh resources — or been
   * destroyed. Nothing is awaited either way: the library stays
   * synchronous, and the next run does not wait for a pending promise.
   *
   * **A stale cleanup is executed, not discarded.** It belongs to the run
   * that produced it, and it is the only thing that will ever release what
   * that run acquired. Nobody else will: the next run's cleanup releases
   * the next run's resources, and `destroy()` runs the one cleanup it has
   * stored — neither of them knows about this one. Dropping it — as this
   * method used to — turned every `createEffect(async () => { const c =
   * await open(); return () => c.close(); })` into a leak on the ordinary
   * unmount path, where `destroy()` overtakes the first `await`. Running it
   * late is not a double-acquire: nobody else holds this run's resource.
   *
   * The same applies to the synchronous branch when the effect destroyed
   * itself in the middle of its own callback. `run()` carries on to the
   * end, but `destroy()` has already run its cleanup, so a value stored
   * here would sit on a dead instance and never be called.
   *
   * A cleanup run this way has no caller left to throw at, so it goes
   * through {@link runOrphanedCleanupCallback}: a synchronous throw and a
   * rejected async cleanup are both reported via {@link emitEffectError}
   * with phase `cleanup`. It may write signals like any other cleanup — on
   * a destroyed effect `run()` is a no-op, on a superseded one a further
   * run is triggered exactly as a regular cleanup would.
   *
   * A rejection of the *callback* promise is reported through
   * {@link emitEffectError} with phase `callback`, current run or not.
   */
  private storeCleanupCallback(result: unknown, generation: number): void {
    if (!isThenable(result)) {
      // Same tolerance as the async branch below: a callback returning
      // something that is not a function has simply returned no cleanup.
      if (typeof result === 'function') {
        this.acceptCleanupCallback(result as VoidFunc, generation);
      }
      return;
    }

    Promise.resolve(result).then(
      (cleanup) => {
        if (typeof cleanup !== 'function') return;
        this.acceptCleanupCallback(cleanup as VoidFunc, generation);
      },
      (error) => {
        emitEffectError(this, error, 'callback');
      },
    );
  }

  /**
   * Take a cleanup the effect callback produced and decide where it goes:
   * into the single `#nextCleanupCallback` slot, or straight to
   * {@link runOrphanedCleanupCallback} because nobody will ever call it
   * from that slot.
   *
   * Two ways to be too late, and both used to end in a silently dropped
   * cleanup on the synchronous path (BUG-007):
   *
   * - **Superseded.** An effect that writes a signal it depends on
   *   re-enters `run()`; the `#runDepth` guard exists precisely because
   *   that is a legitimate, bounded fixpoint pattern here. Every nested
   *   run acquires its own resources and returns its own cleanup, but the
   *   *outermost* run returns last — so the oldest cleanup used to win the
   *   slot and every inner one was thrown away unrun. `destroy()` then
   *   released the resources of a long-superseded state and leaked the
   *   current one. The generation comparison the async branch already made
   *   answers this for both branches: a run whose number is no longer the
   *   current one hands its cleanup over instead of overwriting a newer.
   *
   * - **Displaced.** The slot is normally empty here, because `run()`
   *   consumes it through {@link runCleanupCallback} before the callback is
   *   invoked. It is not empty when a *cleanup* re-entered `run()`: that
   *   nested run stored its cleanup after the outer one had already
   *   emptied the slot, and the outer run — the current generation, so the
   *   check above lets it through — then overwrote it. Running the
   *   displaced one is the same rule as above, applied to the other end of
   *   the collision.
   *
   * Both cases run the cleanup at the earliest moment it is known to be
   * stale, which is the best available: nobody else holds that run's
   * resource, so this is not a double release, and it is the only thing
   * that will ever release it.
   */
  private acceptCleanupCallback(cleanup: VoidFunc, generation: number): void {
    if (this.#destroyed || generation !== this.#generation) {
      this.runOrphanedCleanupCallback(cleanup);
      return;
    }

    // Assign before running the displaced one: a displaced cleanup may write
    // signals and re-enter run(), which would otherwise find the stale slot
    // and run the very same cleanup a second time.
    const displaced = this.#nextCleanupCallback;
    this.#nextCleanupCallback = cleanup;
    if (displaced != null) {
      this.runOrphanedCleanupCallback(displaced);
    }
  }

  private runCleanupCallback(): void {
    const cleanupCallback = this.#nextCleanupCallback;
    if (cleanupCallback == null) return;

    this.#nextCleanupCallback = undefined;

    // An `async` cleanup has the same nobody-to-throw-at problem as an async
    // effect callback: its rejection surfaces long after this frame returned.
    const result = cleanupCallback() as unknown;
    if (isThenable(result)) {
      Promise.resolve(result).catch((error) => {
        emitEffectError(this, error, 'cleanup');
      });
    }
  }

  /**
   * Run a cleanup whose run nobody owns anymore — the callback of a
   * superseded run settled late, or the effect was destroyed while its
   * callback was still on the stack.
   *
   * Unlike {@link runCleanupCallback} this never throws at its caller.
   * There is no caller worth throwing at: the frame is either a microtask
   * of a long-settled promise, or a `run()` whose effect is already gone.
   * A synchronous throw and a rejected async cleanup therefore take the
   * same route as every other error without a stack to land on —
   * {@link emitEffectError} with phase `cleanup`.
   */
  private runOrphanedCleanupCallback(cleanup: VoidFunc): void {
    try {
      const result = cleanup() as unknown;
      if (isThenable(result)) {
        Promise.resolve(result).catch((error) => {
          emitEffectError(this, error, 'cleanup');
        });
      }
    } catch (error) {
      emitEffectError(this, error, 'cleanup');
    }
  }

  /**
   * Destroy the effect.
   *
   * The effect is marked as destroyed and unsubscribed from all queues
   * _before_ any notification goes out and before the _cleanup callback_
   * runs. Everything that observes the teardown — a `DESTROY` listener on
   * the effect, an `onDestroyEffect()` handler, the cleanup callback itself
   * — therefore sees an effect that no longer reacts: a signal write from a
   * cleanup cannot trigger another run, and `run()` is a no-op.
   *
   * Calling `destroy()` again (including re-entrantly from a cleanup) does
   * nothing. Every step of the teardown is guarded on its own, so a throw
   * propagates to the caller but stops nothing: a `DESTROY` listener, an
   * `onDestroyEffect()` handler and the cleanup callback each fail alone,
   * and child effects, the internal bookkeeping and the effect counter are
   * settled in any case.
   *
   * When more than one thing throws — several of this effect's own teardown
   * steps, its cleanup and a child's, or several children's — every error is
   * reported: the failures are collected during the teardown and re-raised
   * afterwards as an `AggregateError` whose `errors` array holds them in
   * teardown order (own steps first, then the children). A lone error is
   * rethrown unchanged.
   */
  destroy = (): void => {
    if (this.#destroyed) return;

    // Flag first, unsubscribe second — from here on nothing can call the
    // effect callback again. The early return above then makes every
    // re-entrant destroy() a no-op, so --EffectImpl.count runs exactly once.
    this.#destroyed = true;

    off(globalSignalQueue, this);
    off(globalEffectQueue, this);
    off(globalDestroySignalQueue, this);

    // Userland code below may throw. Since the early return has already
    // sealed this instance, a half-finished teardown would be permanent:
    // orphaned child effects and a counter that never comes back down. So
    // nothing here rethrows before the last step is done.
    //
    // MEM-008: and each of the four steps carries its own guard, not one
    // shared `try`. A failing first step used to take the three behind it —
    // among them the cleanup callback, the one place userland releases its
    // resources, on an effect that already counts as destroyed and gets no
    // second attempt.
    const errors: unknown[] = [];

    collect(errors, () => emit(this, DESTROY, this));
    collect(errors, () => off(this));
    collect(errors, () => emit(globalEffectQueue, $destroyEffect, this));
    collect(errors, () => this.runCleanupCallback());

    try {
      this.collectDestroyChildEffects(errors);
    } finally {
      this.#signals.clear();
      this.#lostSignals.clear();
      this.#signalSubscriptions.clear();
      this.#destroyedSignals.clear();

      --EffectImpl.count;
    }

    throwCollectedErrors(errors, 'destroying an effect');
  };
}
