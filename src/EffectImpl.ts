import {
  type EventizedObject,
  emit,
  eventize,
  getSubscribedEventNames,
  off,
  on,
  once,
} from '@spearwolf/eventize';
import {getCurrentBatch} from './batch.js';
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
 * is worse than the crash we came from, so it falls back to `console.error`.
 * A handler that throws is treated the same way: reported, never re-raised.
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

  console.error(
    `[signalize] unhandled rejection in the ${phase} of effect ${effect.id.toString()}:`,
    error,
  );
};

/**
 * Re-raise errors collected while tearing down a tree of effects.
 *
 * A single error is rethrown unchanged, so the common case keeps the exact
 * error the userland cleanup threw. Several errors are bundled into an
 * `AggregateError` — none of them may be dropped just because a sibling
 * failed first.
 */
const throwCollectedErrors = (errors: unknown[]): void => {
  if (errors.length === 0) return;
  if (errors.length === 1) throw errors[0];
  throw new AggregateError(
    errors,
    `[signalize] ${errors.length} errors while destroying an effect`,
  );
};

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
   * Tune via `EffectImpl.maxDepth = N` if you intentionally need deeper
   * recursion — but prefer breaking the cycle.
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

  readonly #destroyedSignals: Set<symbol> = new Set();

  private readonly childEffects: EffectImpl[] = [];
  private curChildEffectSlot = 0;

  autorun = true;
  shouldRun = true;

  readonly priority: number;

  #dependencies?: SignalLike<unknown>[];

  #destroyed = false;

  #runDepth = 0;

  /**
   * Monotonically increasing run counter, bumped before each callback
   * invocation. An async callback captures the value it ran under; when its
   * promise settles later the captured value is compared against the current
   * one to tell a still-current run from a superseded one.
   */
  #generation = 0;

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

    let group: SignalGroup | undefined;

    if (options?.attach != null) {
      group = SignalGroup.findOrCreate(options.attach);
      group.attachEffect(this);
    }

    this.autorun = options?.autorun ?? true;

    this.#dependencies = options?.dependencies
      ? options.dependencies.map((dep) => {
          switch (typeof dep) {
            case 'string':
            case 'symbol':
              return group.signal(dep);
            default:
              return dep;
          }
        })
      : undefined;

    // a batch will call the effect by id to run the effect
    this.id = EffectImpl.idGen.make();

    this.priority = options?.priority ?? 0;

    on(globalEffectQueue, this.id, RECALL, this);

    ++EffectImpl.count;
  }

  private hasStaticDeps() {
    return this.#dependencies != null && this.#dependencies.length > 0;
  }

  private saveSignalsFromDeps() {
    for (const sig of this.#dependencies!) {
      this.whenSignalIsRead(signalImpl(sig).id);
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

    const options: EffectOptions | undefined = dependencies
      ? (opts ?? {dependencies})
      : (optsOrDeps as EffectOptions | undefined);

    if (options && dependencies) {
      options.dependencies = dependencies;
    }

    let effect: EffectImpl | undefined;

    const parentEffect = getCurrentEffect();
    if (parentEffect != null) {
      effect = parentEffect.getCurrentChildEffect();
      if (effect == null) {
        effect = new EffectImpl(callback, options);
        parentEffect.attachChildEffect(effect);
        emit(globalEffectQueue, $createEffect, effect);
      }
      parentEffect.curChildEffectSlot++;
    } else {
      effect = new EffectImpl(callback, options);
      emit(globalEffectQueue, $createEffect, effect);
    }

    if (effect.hasStaticDeps()) {
      effect.saveSignalsFromDeps();
    } else if (effect.autorun) {
      effect.run();
    }

    return new Effect(effect);
  }

  private getCurrentChildEffect(): EffectImpl | undefined {
    return this.childEffects[this.curChildEffectSlot];
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
    if (this.#destroyed) return;
    if (!this.shouldRun) return;

    const curBatch = getCurrentBatch();
    if (curBatch) {
      curBatch.batch(this.id, this.priority);
      return;
    }

    if (this.#runDepth >= EffectImpl.maxDepth) {
      throw new Error(
        `[signalize] Effect ${this.id.toString()} exceeded maxDepth=${EffectImpl.maxDepth}: ` +
          'an effect callback recursively re-triggered itself (likely by writing a signal it depends on). ' +
          'Break the cycle, or raise EffectImpl.maxDepth if the recursion is intentional.',
      );
    }

    this.#runDepth++;
    try {
      this.runCleanupCallback();
      this.destroyChildEffects();

      this.curChildEffectSlot = 0;
      this.shouldRun = false;

      emit(globalEffectCalledQueue, this.id, this.id);

      // Bumped here, not at the top of run(): the callbacks must be numbered
      // in the order they are *invoked*. A cleanup above can re-enter run()
      // — the inner run then finishes before this outer callback is even
      // called, and only a bump at this point gives the outer run the higher
      // generation its later-settling promise will be compared against.
      // Bumping earlier would also count a run that never reached its
      // callback, because the cleanup or a child's teardown threw.
      const generation = ++this.#generation;

      if (this.hasStaticDeps()) {
        this.storeCleanupCallback(this.callback(), generation);
      } else {
        this.#lostSignals.clear();
        for (const id of this.#signals) {
          this.#lostSignals.add(id);
        }
        this.storeCleanupCallback(
          runWithinEffect(this, this.callback),
          generation,
        );
        this.cleanupLostSignals();
        this.#destroyedSignals.clear();
      }
    } finally {
      this.#runDepth--;
    }
  };

  /**
   * Eventually run the _effect callback_
   *
   * If the _autorun_ flag is activated, then the effect is executed immediately in any case.
   * Otherwise the effect is only executed if it is necessary.
   *
   * The necessity is given if
   * - the effect has been initialized but has not yet run
   * - a signal used in the effect has changed
   */
  [RECALL]() {
    this.shouldRun = true;
    if (this.autorun) {
      this.run();
    }
  }

  whenSignalIsRead(signalId: symbol): void {
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

      if (this.#signals.size === 0) {
        // no signals left, so nobody can trigger this effect anymore
        this.destroy();
      }
      return;
    }

    if (!this.#destroyedSignals.has(signalId)) {
      this.#destroyedSignals.add(signalId);

      this.unsubscribeSignal(signalId);

      if (this.#destroyedSignals.size === this.#signals.size) {
        // no signals left, so nobody can trigger this effect anymore
        this.destroy();
      }
    }
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
   */
  private destroyChildEffects(): void {
    const errors: unknown[] = [];
    this.collectDestroyChildEffects(errors);
    throwCollectedErrors(errors);
  }

  /**
   * The body of {@link destroyChildEffects}, but appending to a caller-owned
   * error list instead of throwing. Lets `destroy()` merge the child errors
   * with an error from its own cleanup into a single report.
   */
  private collectDestroyChildEffects(errors: unknown[]): void {
    for (const effect of this.childEffects) {
      try {
        effect.destroy();
      } catch (err) {
        errors.push(err);
      }
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
   * cleanup callback.
   *
   * A synchronous return value is stored as is. An `async` callback returns a
   * promise instead, and by the time it settles the world may have moved on:
   * the effect may have run again — acquiring fresh resources — or been
   * destroyed. Running that stale cleanup then is the late-release half of a
   * double-acquire bug, so it is **discarded**, identified by the generation
   * the run carried. Nothing is awaited: the library stays synchronous, and
   * the next run does not wait for a pending promise.
   *
   * A rejection is never discarded — it is reported through
   * {@link emitEffectError} whether the run is still current or not.
   *
   * **The synchronous branch deliberately ignores `generation`.** It can only
   * be stale through re-entrancy: a callback writes a signal it depends on,
   * the inner run completes first, and the outer run then overwrites the
   * inner cleanup with its own, older one. That is how this library has
   * always behaved, and the `#runDepth` guard exists precisely because such
   * recursion is a legitimate (if bounded) fixpoint pattern here. Making the
   * outer run drop its cleanup would change synchronous semantics for every
   * self-writing effect, which is a decision of its own and not the async
   * ordering bug this method was written for. The async branch checks the
   * generation because there the stale case is the *normal* one.
   */
  private storeCleanupCallback(result: unknown, generation: number): void {
    if (!isThenable(result)) {
      // Same tolerance as the async branch below: a callback returning
      // something that is not a function has simply returned no cleanup.
      if (typeof result === 'function') {
        this.#nextCleanupCallback = result as VoidFunc;
      }
      return;
    }

    Promise.resolve(result).then(
      (cleanup) => {
        if (this.#destroyed || generation !== this.#generation) return;
        if (typeof cleanup === 'function') {
          this.#nextCleanupCallback = cleanup as VoidFunc;
        }
      },
      (error) => {
        emitEffectError(this, error, 'callback');
      },
    );
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
   * nothing. A cleanup callback that throws propagates to the caller, but
   * does not stop the teardown: child effects, the internal bookkeeping and
   * the effect counter are settled in any case.
   *
   * When more than one thing throws — this effect's cleanup and a child's,
   * or several children's — every error is reported: the failures are
   * collected during the teardown and re-raised afterwards as an
   * `AggregateError` whose `errors` array holds them in teardown order (own
   * cleanup first, then the children). A lone error is rethrown unchanged.
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
    const errors: unknown[] = [];

    try {
      emit(this, DESTROY, this);
      off(this);

      emit(globalEffectQueue, $destroyEffect, this);

      this.runCleanupCallback();
    } catch (err) {
      errors.push(err);
    }

    try {
      this.collectDestroyChildEffects(errors);
    } finally {
      this.#signals.clear();
      this.#lostSignals.clear();
      this.#signalSubscriptions.clear();
      this.#destroyedSignals.clear();

      --EffectImpl.count;
    }

    throwCollectedErrors(errors);
  };
}
