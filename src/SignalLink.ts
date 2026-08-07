import {
  type EventizedObject,
  emit,
  eventize,
  off,
  on,
  once,
  retain,
  retainClear,
} from '@spearwolf/eventize';
import {throwCollectedErrors} from './collect-errors.js';
import {$queueUnsubscribes, DESTROY, MUTE, UNMUTE, VALUE} from './constants.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import {SignalGroup} from './SignalGroup.js';
import {signalImpl} from './signal-core.js';
import {ISignalImpl, SignalLike} from './types.js';

export type ValueCallback<ValueType = any> = (value: ValueType) => void;

// Eventize injects EventizedObject members at runtime via eventize(this) in
// the constructor — declaration merging tells TS the brand is present.
// biome-ignore lint/correctness/noUnusedVariables: declaration merging requires the same type-parameter name as the class
export interface SignalLink<ValueType = any> extends EventizedObject {}

export abstract class SignalLink<ValueType = any> {
  #muted = false;
  #attachedGroups?: Set<SignalGroup>;

  // Every subscription this link holds on one of the two permanent,
  // module-level global queues, as its unsubscribe handle: the
  // `on(globalSignalQueue, source.id, ...)` and the
  // `once(globalDestroySignalQueue, source.id, ...)` from this constructor,
  // plus — for `SignalLinkToSignal` — the
  // `once(globalDestroySignalQueue, target.id, ...)` its constructor adds
  // through `releaseOnDestroy()`. Two handles for a callback target, three
  // for a signal target.
  //
  // MEM-004: `destroy()` runs all of them. Without it, the closures (routed
  // through `selfRef`, so they no longer pin the link *from the queues* —
  // see MEM-002 below; `src/link.ts`'s comments cover what still does) stay
  // subscribed on a queue that lives as long as the process, until the
  // *other* side's signal is destroyed too — which for a link torn down well
  // before its signals is never.
  //
  // MEM-001: `destroy()` is not the only reader. `src/link.ts` registers
  // this very array as the held value of its `FinalizationRegistry`, so a
  // link that is merely dropped — never destroyed, so no DESTROY, no
  // teardown — still gets these handles run once it is collected. That is
  // why this is a symbol-keyed field and not a `#private` one: a private
  // field is unreachable from `link.ts`. The held value stays safe because
  // nothing in it points back at the link strongly — the handles reach the
  // constructor closures, and those know the link only through a `WeakRef`.
  //
  // S7: `destroy()` runs the handles before `Object.freeze(this)`, but not
  // *because of* it — the freeze reaches neither the array object this field
  // points to (a separate, unfrozen object one hop away) nor anything that
  // would stop a push after the fact. It runs there because that is simply
  // where `destroy()`'s one-shot teardown sequence puts it; the guard at the
  // top of that method (`if (this.isDestroyed) return`) is what actually
  // rules out a second run pushing anything new.
  readonly [$queueUnsubscribes]: (() => void)[] = [];

  // ASYNC-005: how many `asyncValues()` generators are currently iterating
  // this link. `retainClear(this, VALUE)` in that generator's `finally`
  // block only runs once this drops back to 0.
  #activeAsyncValuesCount = 0;

  // BUG-008: bumped once per `updateValue()` frame, before control goes
  // to `action()`. Only ever compared for equality — the absolute value
  // carries no meaning, and no path reads it from outside this class.
  #propagationGeneration = 0;

  readonly source: ISignalImpl<ValueType>;

  /**
   * The last value this link actually announced — i.e. the value of the
   * most recent `updateValue()` frame that ran to completion.
   *
   * Two frames deliberately leave it alone: one whose `action()`
   * destroyed this link (`destroy()` sets it to `undefined` and that
   * stands, BUG-001), and one that a nested, re-entrant frame superseded
   * while `action()` was running — the nested frame's newer value is the
   * one that stays (BUG-008).
   */
  lastValue?: ValueType;

  isDestroyed = false;

  constructor(source: SignalLike<ValueType>) {
    eventize(this);

    this.source = signalImpl(source);

    // Weak self-reference (MEM-002): these two callbacks subscribe on
    // module-level global queues that live for the whole process. A plain
    // `this` closure here would keep the link (and everything it reaches —
    // the source signal, the target, a callback's closure) permanently
    // reachable *from those queues*, on top of whatever else already holds
    // it. Going through a WeakRef stops the queues from being one more
    // pinning path; once a link is genuinely collected, the dereffed
    // callbacks are silent no-ops.
    //
    // It does not, on its own, make an orphaned link collectible (MEM-007):
    // `src/link.ts`'s `gLinks` registry holds every link on a live source
    // signal in an ordinary, strongly-referencing `Map`, for as long as that
    // source lives — see the comment there. This WeakRef only rules out the
    // queues as an *additional* permanent root; the registry is still one.
    //
    // MEM-001 leans on it a second time, so it is load-bearing twice over:
    // the unsubscribe handles collected below are handed to `link.ts`'s
    // `FinalizationRegistry` as its held value, and a held value that could
    // reach its own registered object keeps that object alive forever — the
    // finalizer would never fire. The only path from a handle back to this
    // link runs through the arrow functions here, and they go through
    // `selfRef`. Anyone replacing these closures with a plain `this` breaks
    // the finalizer silently: no test in the standard run would say so.
    const selfRef = new WeakRef(this);

    this[$queueUnsubscribes].push(
      on(globalSignalQueue, this.source.id, (_, params) => {
        const self = selfRef.deref();
        if (self != null && !self.#muted && !self.isDestroyed) {
          if (params?.touch === true) {
            self.touch();
          } else {
            self.write();
          }
        }
      }),
    );

    this[$queueUnsubscribes].push(
      once(globalDestroySignalQueue, this.source.id, () =>
        selfRef.deref()?.destroy(),
      ),
    );
  }

  /**
   * Register an unsubscribe handle (from a `once(globalDestroySignalQueue,
   * ...)` subscription or similar) for release. Subclasses that add their own
   * subscriptions on a permanent global queue (see `SignalLinkToSignal`) go
   * through this instead of touching the field directly.
   *
   * Anything registered here is released by **both** teardown routes:
   * `destroy()` runs it (before `Object.freeze(this)`), and so does
   * `src/link.ts`'s `FinalizationRegistry` if the link is merely collected
   * instead (MEM-001). Which means the handle must survive being called on a
   * link that no longer exists — eventize's handles do, and a subclass
   * handing over anything else has to.
   */
  protected releaseOnDestroy(unsubscribe: () => void) {
    this[$queueUnsubscribes].push(unsubscribe);
  }

  attach(to: object) {
    const group = SignalGroup.findOrCreate(to);

    // `group.attachLink()` runs on every call, unconditionally — it's an
    // idempotent `Set.add`, it's what actually (re-)establishes membership,
    // and it must run (and throw, for a destroyed link) before anything
    // touches `#attachedGroups` below. Skipping it on a re-attach is exactly
    // the bug this used to have: `SignalGroup.detachLink()` (public API) can
    // remove the link from the group without destroying it or clearing the
    // guard, so a later `attach(sameGroup)` needs to actually re-add it, not
    // just see "already known" and return early.
    group.attachLink(this);

    // The `once(this, DESTROY, ...)` subscription below, unlike
    // `attachLink()`, is *not* deduplicated by eventize (a plain function
    // listener isn't recognized as "similar" to a previous one — eventize's
    // `isSimilar()` dedup only covers listeners of type `LISTENER_IS_OBJ`
    // and `LISTENER_IS_NAMED_FUNC`; a plain function is excluded by type, so
    // even the *same* function reference registered twice yields two
    // subscriptions) — so it still needs its own guard, or re-attaching the
    // same group (e.g. on every `link()` cache hit that passes `{attach}`)
    // would grow the link's DESTROY listener list without bound.
    this.#attachedGroups ??= new Set();
    if (this.#attachedGroups.has(group)) {
      return group;
    }
    this.#attachedGroups.add(group);

    once(this, DESTROY, () => {
      group.detachLink(this);
    });
    return group;
  }

  /**
   * Resolves on the next value propagated through this link, or rejects
   * with an `Error` if the link is destroyed first.
   *
   * `options.signal` — an `AbortSignal` — rejects (and unsubscribes) early:
   * an already-aborted signal rejects immediately, without waiting for the
   * next value or a destroy.
   *
   * Deliberately a hand-rolled `Promise` rather than eventize's own
   * `onceAsync(obj, name, {signal})` (which does support an `AbortSignal`
   * out of the box, and — despite taking a single `eventName` parameter
   * here — does accept an array of names, so watching both `VALUE` and
   * `DESTROY` in one call isn't the blocker). What `onceAsync` can't do is
   * tell the two apart: it always *resolves*, with whichever event's first
   * argument arrived — `VALUE`'s value or `DESTROY`'s payload (`this`, the
   * link itself). A `VALUE` of `this` is exactly the value a link carrying
   * itself would propagate, so a `result === this` check to tell "resolved
   * because of DESTROY" from "resolved because of VALUE" is not reliable.
   * `DESTROY` needs to *reject* here, and `onceAsync` has no way to make
   * one name in its list do that while another resolves.
   */
  nextValue(options?: {signal?: AbortSignal}): Promise<ValueType> {
    const {signal} = options ?? {};

    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }

      // A link destroyed before this call even started never emits DESTROY
      // again (destroy() is a one-shot; off(this) already ran) — without
      // this guard the promise below would simply hang forever, and its
      // VALUE/DESTROY subscriptions would sit on the dead link permanently
      // (only an {signal} would ever pull the caller back out). Same
      // rejection as the "destroyed while pending" path below; from the
      // caller's side there is no meaningful difference between the two.
      if (this.isDestroyed) {
        reject(new Error('SignalLink destroyed before the next value arrived'));
        return;
      }

      const subscriptions: (() => void)[] = [];
      const unsubscribe = () =>
        subscriptions.forEach((unsub) => {
          unsub();
        });

      // K1: DESTROY and the abort listener are subscribed *before* VALUE,
      // and each is pushed onto `subscriptions` immediately, not batched
      // into one `push()` call after all three exist. Reason: eventize
      // replays a *retained* event synchronously, inside the `once()` call
      // itself, before that call returns — and `asyncValues()` retains
      // VALUE (ASYNC-005). If VALUE were subscribed first, its own replay
      // could run before `subscriptions` holds anything else at all —
      // including the not-yet-registered DESTROY/abort handles — so the
      // `unsubscribe()` it calls would walk an empty array and release
      // nothing, leaking the other two for however long `this` and the
      // caller's `AbortSignal` live. DESTROY is never retained, and
      // `addEventListener('abort', ...)` cannot fire synchronously on
      // registration, so subscribing them first is both safe and
      // sufficient — VALUE is the only one of the three that can go off
      // inline, right here, and only it needs everything else in place
      // first.
      subscriptions.push(
        once(this, DESTROY, () => {
          unsubscribe();
          reject(
            new Error('SignalLink destroyed before the next value arrived'),
          );
        }),
      );

      if (signal != null) {
        const onAbort = () => {
          unsubscribe();
          reject(signal.reason);
        };
        signal.addEventListener('abort', onAbort, {once: true});
        // Also part of `unsubscribe()`: whichever of VALUE/DESTROY/abort
        // settles the promise first must detach the *other* listeners too,
        // this one included — otherwise a `nextValue()` that resolves
        // normally leaves its abort listener on the caller's `AbortSignal`
        // for as long as that signal lives (ASYNC-004).
        subscriptions.push(() => signal.removeEventListener('abort', onAbort));
      }

      subscriptions.push(
        // we can not just use 'once' here because the value is retained
        once(this, VALUE, (val) => {
          unsubscribe();
          resolve(val);
        }),
      );
    });
  }

  /**
   * An `AsyncIterable` of values propagated through this link. Stops when
   * `stopAction(value, index)` returns `true`, or when the link is
   * destroyed — in both cases the loop simply ends, `for await` sees a
   * normal completion.
   *
   * `options.signal` — an `AbortSignal`, forwarded to every internal
   * `nextValue()` call — makes an *aborted* iteration end differently: it
   * **throws** the abort reason out of the loop instead of ending quietly.
   * That is deliberate, not an oversight: destroy is this link's own
   * lifecycle, expected and unremarkable; abort is the caller cancelling
   * their own wait from the outside, and swallowing that silently would
   * make a signalled cancellation indistinguishable from `stopAction`
   * returning `true` on its own.
   *
   * Retains only the **last** propagated value (a sampler, not a lossless
   * stream) — a value that arrives between two reads of a slow consumer is
   * lost, same as a single `retain()`'d event anywhere else. Several
   * `asyncValues()` iterators may run over the same link concurrently; they
   * share that one retained slot, released only once the *last* active
   * iterator stops (ASYNC-005) — an iterator finishing early must not cut a
   * still-running sibling off from the next value.
   *
   * Caveat shared with every JS async generator, not specific to this one:
   * the `finally` block below — where the iterator count is decremented —
   * only runs if the generator is driven to completion or explicitly closed
   * (`.return()`, `.throw()`, or the implicit `.return()` a `for await`
   * loop issues on `break`/an exception). A caller that calls `.next()` a
   * few times and then simply drops the generator without closing it takes
   * this link's retained-value bookkeeping down with it: the count never
   * comes back to 0, so `retainClear()` never runs again for this link.
   * There is no fix within the iterator protocol itself; the caller closing
   * what it opens is the contract, same as any other manually-driven
   * iterator.
   */
  async *asyncValues(
    stopAction?: (value: ValueType, index: number) => boolean,
    options?: {signal?: AbortSignal},
  ) {
    retain(this, VALUE);
    this.#activeAsyncValuesCount += 1;
    try {
      let i = 0;
      while (!this.isDestroyed) {
        try {
          const next = await this.nextValue(options);
          if (stopAction?.(next, i++)) break;
          yield next;
        } catch (err) {
          // S9: distinguish *why* nextValue() rejected, and rethrow only
          // for an actual abort. `options.signal?.aborted` alone answers
          // "was this signal ever aborted", not "did *this* rejection come
          // from that abort" — a destroy() and an abort() landing in the
          // same synchronous block (a teardown calling both, e.g. an
          // unmount that also cancels its own controller) would otherwise
          // have the destroy-driven rejection misread as an abort, purely
          // because the signal happens to be aborted *now*, one line later.
          // Both of `nextValue()`'s abort paths (already-aborted, aborted
          // while pending) reject with exactly `signal.reason`; the destroy
          // path rejects with its own freshly constructed `Error`. Matching
          // the rejection itself against `signal.reason` is what actually
          // ties this rethrow to *this* rejection's cause instead of the
          // signal's current state.
          if (options?.signal?.aborted && err === options.signal.reason) {
            throw err;
          }
          break;
        }
      }
    } finally {
      this.#activeAsyncValuesCount -= 1;
      if (this.#activeAsyncValuesCount === 0) {
        retainClear(this, VALUE);
      }
    }
  }

  destroy() {
    if (this.isDestroyed) return;

    // BUG-002: flag first, teardown second — same rule and the same
    // reason as `EffectImpl.destroy()` (`src/EffectImpl.ts:804-807`).
    // Everything below reaches application code: `emit(this, DESTROY,
    // this)` serves every listener, and an `on()` listener — unlike a
    // `once()` one — is still subscribed while it runs. One that calls
    // `destroy()` again used to walk into an unguarded teardown and
    // recurse until the stack blew; the guard above now catches it. It
    // also makes `isDestroyed` tell the truth *inside* a DESTROY
    // listener, which is what `updateValue()`'s post-`action()` check
    // relies on when the callback destroys the link.
    this.isDestroyed = true;

    // MEM-004: release every global-queue subscription this link (and its
    // subclass, if any) registered — the `globalSignalQueue` one included
    // (MEM-001), which used to be unsubscribed one line above this loop,
    // outside the collecting pattern. Safe to call even for an obligation
    // that already fired and self-removed (e.g. this destroy() run *is* the
    // callback from one of them) — eventize's once() handles are inert once
    // their obligation is settled.
    //
    // S6: one throwing handle must not skip releasing the rest, nor skip
    // the teardown steps below — a half-destroyed link (still subscribed on
    // globalSignalQueue, DESTROY never emitted, never frozen) is worse than
    // a rethrown error once everything else is done. Same function as
    // `EffectImpl.destroy()`'s cleanup collection now uses, not just the
    // same shape: gather, keep going, report at the end via
    // `throwCollectedErrors()`.
    const releaseErrors: unknown[] = [];
    for (const unsubscribe of this[$queueUnsubscribes]) {
      try {
        unsubscribe();
      } catch (err) {
        releaseErrors.push(err);
      }
    }
    // Emptying the array also disarms `link.ts`'s finalizer for this link:
    // it holds *this* array, so a later collection finds nothing left to
    // release. (The `once(link, DESTROY, ...)` hook in `link()` unregisters
    // the link from the registry outright, so this is the second of two
    // independent guards against a double release.)
    this[$queueUnsubscribes].length = 0;

    // S6, second half: `emit()` reaches application code too, and a throwing
    // DESTROY listener used to be survivable — the error escaped before the
    // old `this.isDestroyed = true` at the tail, so a later `destroy()` got
    // past the guard and finished the job. With the flag set up front
    // (BUG-002) that second chance is gone: an escaping error would leave a
    // link that reports `isDestroyed === true` while still being subscribed,
    // unfrozen and holding its last value, permanently. So the emit joins the
    // same collect-and-carry-on pattern as the release loop above.
    try {
      emit(this, DESTROY, this);
    } catch (err) {
      releaseErrors.push(err);
    }

    retainClear(this, VALUE);
    off(this);

    this.lastValue = undefined;

    Object.freeze(this);

    throwCollectedErrors(releaseErrors, 'tearing down a SignalLink');
  }

  get isMuted(): boolean {
    return this.#muted;
  }

  mute(): this {
    if (!this.isDestroyed && !this.#muted) {
      this.#muted = true;
      emit(this, MUTE, this);
    }
    return this;
  }

  unmute(): this {
    if (!this.isDestroyed && this.#muted) {
      this.#muted = false;
      emit(this, UNMUTE, this);
    }
    return this;
  }

  toggleMute(): boolean {
    if (!this.isDestroyed) {
      this.#muted = !this.#muted;
      emit(this, this.#muted ? MUTE : UNMUTE, this);
    }
    return this.#muted;
  }

  abstract touch(): this;
  protected abstract write(): void;

  protected updateValue(action: (value: ValueType) => void) {
    if (!this.#muted && !this.isDestroyed) {
      // BUG-008: claim a generation *before* handing control over. Every
      // line below the `action()` call can have been re-entered by then;
      // this counter is how the outer frame finds out that it was.
      const generation = ++this.#propagationGeneration;

      const {value} = this.source;

      action(value);

      // BUG-001: `action()` is application code — the link callback, or
      // the target signal's write plus every effect it triggers. Tearing
      // this link down from in there is the normal case ("take the first
      // value, then unsubscribe"), and `destroy()` ends with
      // `Object.freeze(this)`, so the assignment below would raise a
      // TypeError in strict mode — out of a plain `signal.set()`,
      // aborting the rest of that write's delivery. Nothing is lost by
      // leaving now: `destroy()` has already emitted DESTROY and run
      // `off(this)`, so there is no VALUE listener left to serve, and it
      // set `lastValue` to `undefined` on purpose.
      if (this.isDestroyed) return;

      // BUG-008: a nested `updateValue()` ran to completion while
      // `action()` was on the stack — a feedback loop wrote the source
      // again. That frame read a newer value, emitted it and stored it.
      // `value` is stale on both signals by now; emitting it here would
      // announce a state that exists nowhere, and announce it *after*
      // the newer one. Dropping the superseded frame is the only order
      // that keeps VALUE monotonic without emitting before `action()`.
      if (this.#propagationGeneration !== generation) return;

      emit(this, VALUE, value);
      this.lastValue = value;
    }
  }
}

export class SignalLinkToSignal<ValueType = any> extends SignalLink<ValueType> {
  readonly target: ISignalImpl<ValueType>;

  constructor(source: SignalLike<ValueType>, target: SignalLike<ValueType>) {
    super(source);
    this.target = signalImpl(target);
    // Weak self-reference, same reasoning as the base constructor
    // (MEM-002): `globalDestroySignalQueue` is a permanent module-level
    // root, so a plain `this` closure here would pin this link — and
    // through it `source`/`target` — for the process lifetime, same as the
    // base class's two subscriptions did before they were fixed.
    const selfRef = new WeakRef(this);
    this.releaseOnDestroy(
      once(globalDestroySignalQueue, this.target.id, () =>
        selfRef.deref()?.destroy(),
      ),
    );
    this.touch();
  }

  touch(): this {
    this.updateValue((value) => {
      this.target.writer(value, {touch: true});
    });
    return this;
  }

  protected write() {
    this.updateValue((value) => {
      this.target.writer(value);
    });
  }
}

export class SignalLinkToCallback<
  ValueType = any,
> extends SignalLink<ValueType> {
  readonly target: ValueCallback<ValueType>;

  constructor(source: SignalLike<ValueType>, target: ValueCallback<ValueType>) {
    super(source);
    this.target = target;
    this.touch();
  }

  touch() {
    this.updateValue((value) => {
      this.target(value);
    });
    return this;
  }

  protected write() {
    this.updateValue((value) => {
      this.target(value);
    });
  }
}
