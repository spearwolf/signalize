import {
  type EventizedObject,
  emit,
  eventize,
  off,
  on,
  once,
  retain,
  unretain,
} from '@spearwolf/eventize';
import {collect, throwCollectedErrors} from './collect-errors.js';
import {$queueUnsubscribes, DESTROY, MUTE, UNMUTE, VALUE} from './constants.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import {SignalGroup} from './SignalGroup.js';
import {signalImpl} from './signal-core.js';
import type {
  AbortSignalLike,
  ISignalImpl,
  LinkSource,
  SignalLike,
} from './types.js';

/** The value type defaults to `unknown`; annotate `ValueCallback<number>`. */
export type ValueCallback<ValueType = unknown> = (value: ValueType) => void;

// One text, two rejection sites: `NextValueRead.settleWithDestroy()` for a
// link destroyed while the read is pending, and the up-front guard in
// `#nextValue()` for one that was already dead when the call arrived. From
// the caller's side there is no meaningful difference between the two, so
// they must not drift apart — a constant makes that structural instead of a
// promise (side finding of package 6).
const NEXT_VALUE_DESTROYED =
  '[signalize] SignalLink destroyed before the next value arrived';

/**
 * W1: the handle that cancels the read an `asyncValues()` iterator is
 * currently waiting on — present only while a read is actually pending,
 * cleared again the moment it settles. See `asyncValues()` for why an
 * iterator parked in an `await` cannot be closed without it.
 */
type PendingRead = {cancel?: () => void};

/**
 * One pending read of the next value: the two promise callbacks, every
 * unsubscribe handle the read has collected so far, and the four ways it can
 * end. Created inside `#nextValue()`'s promise executor, one per call.
 *
 * Not to be confused with {@link PendingRead}, despite the neighbouring
 * names: that one is only the cancel handle an `asyncValues()` iterator
 * holds on the read *from the outside*, this one is the read itself.
 *
 * Each of the four `settleWith*()` methods releases everything the read
 * holds and then settles the promise — which of the four runs is what tells
 * the caller apart: a value, a destroy, an abort, or the iterator pulling
 * the plug.
 */
class NextValueRead<ValueType> {
  readonly #resolve: (value: ValueType) => void;
  readonly #reject: (reason?: unknown) => void;
  readonly #pendingRead?: PendingRead;

  readonly #handles: (() => void)[] = [];

  #settled = false;

  constructor(
    resolve: (value: ValueType) => void,
    reject: (reason?: unknown) => void,
    pendingRead?: PendingRead,
  ) {
    this.#resolve = resolve;
    this.#reject = reject;
    this.#pendingRead = pendingRead;
  }

  get hasSettled(): boolean {
    return this.#settled;
  }

  /**
   * Register one unsubscribe handle — called at the subscription it belongs
   * to, immediately, never collected and handed over in one go afterwards.
   * The K1 block at the subscribe sequence in `#nextValue()` is where that
   * rule is argued; it is the reason this takes one handle and not a list.
   */
  add(unsubscribe: () => void): void {
    this.#handles.push(unsubscribe);
  }

  /**
   * W1: every settle path runs this. It releases the handles this read
   * collected and clears the cancel hook that `#nextValue()` installed on
   * the shared `PendingRead` — a read that is over cannot be cancelled.
   *
   * Clearing the hook is precaution, not load bearing, and the difference is
   * measured. Package 6 removed the clearing and found nothing observable
   * across seven scenarios: a hook left behind reaches only this read's own
   * handles, which are spent by then (eventize unsubscribes are idempotent —
   * measured again in package 8), and it would reject a promise that has
   * already settled. It stays because the next thing added to a settle path
   * need not be inert.
   */
  releaseAll(): void {
    if (this.#pendingRead != null) {
      this.#pendingRead.cancel = undefined;
    }
    this.#handles.forEach((unsub) => {
      unsub();
    });
  }

  settleWithValue(value: ValueType): void {
    this.#settled = true;
    this.releaseAll();
    this.#resolve(value);
  }

  settleWithDestroy(): void {
    this.releaseAll();
    this.#reject(new Error(NEXT_VALUE_DESTROYED));
  }

  settleWithAbort(reason: unknown): void {
    this.releaseAll();
    this.#reject(reason);
  }

  settleWithCancel(): void {
    this.releaseAll();
    this.#reject(
      new Error('[signalize] SignalLink read cancelled by the iterator'),
    );
  }
}

// Eventize injects EventizedObject members at runtime via eventize(this) in
// the constructor — declaration merging tells TS the brand is present.
// biome-ignore lint/correctness/noUnusedVariables: declaration merging requires the same type-parameter name as the class
export interface SignalLink<ValueType = unknown> extends EventizedObject {}

/**
 * The value type defaults to `unknown`; a bare `SignalLink` claims nothing
 * about the value it carries. Where "some link, any value type" is meant —
 * a parameter position, a heterogeneous collection — `SignalLink<any>` is
 * the right spelling, for callers as much as for this library: `ValueType`
 * is invariant, so `SignalLink<unknown>` accepts no concrete link.
 */
export abstract class SignalLink<ValueType = unknown> {
  #muted = false;

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
  // field is unreachable from `link.ts`. Why holding this array is safe —
  // no strong path from it back to the link, or the registry would never
  // fire — is argued once, at `gLinkFinalizer`.
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
  // this link. `unretain(this, VALUE)` in that generator's `finally` block
  // only runs once this drops back to 0.
  #activeAsyncValuesCount = 0;

  // BUG-008: bumped once per `updateValue()` frame, before control goes
  // to `action()`. Only ever compared for equality — the absolute value
  // carries no meaning, and no path reads it from outside this class.
  #propagationGeneration = 0;

  // ASYNC-005: the generation of the most recent VALUE emit — assigned on
  // every emit, whether anything retains VALUE or not, and never cleared
  // (`unretain()` empties eventize's slot without touching this). It is
  // read in one place only, from inside a VALUE delivery, where it always
  // describes *that* delivery: a live emit has just written it, and a
  // replay carries the value the emit that wrote it put in the slot. That
  // is what lets a cursor tell a replay it has already consumed from a new
  // value. 0 = nothing emitted yet. Only ever compared for equality, like
  // the counter above it.
  #emittedGeneration = 0;

  /**
   * The signal this link reads from.
   *
   * The view is deliberately narrow (API-007): {@link LinkSource} exposes
   * `id`, `value`, `muted` and `destroyed` and nothing else. At runtime this
   * *is* the signal implementation, it is simply no longer typed as one — a
   * link is a one-way read connection, not a second handle to drive its own
   * source. Whoever needs to write holds the `Signal` the link was made from.
   */
  readonly source: LinkSource<ValueType>;

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
    group.attachLink(this);
    return group;
  }

  /**
   * Resolves on the next value propagated through this link, or rejects
   * with an `Error` if the link is destroyed first.
   *
   * `options.signal` — an `AbortSignal` — rejects (and unsubscribes) early:
   * an already-aborted signal rejects immediately, without waiting for the
   * next value or a destroy. The parameter type is `AbortSignalLike`, a
   * structural subset of `AbortSignal`; every real `AbortSignal` satisfies
   * it.
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
  nextValue(options?: {signal?: AbortSignalLike}): Promise<ValueType> {
    return this.#nextValue(null, options);
  }

  /**
   * The implementation behind `nextValue()`, with one addition: an optional
   * `cursor` carrying the propagation generation its owner last consumed.
   *
   * With a cursor, a synchronous replay of an already-consumed generation is
   * ignored and the call keeps waiting for the *next* propagation — that is
   * what stops an `asyncValues()` loop from being handed the retained value
   * over and over (ASYNC-005). Without one (`null`, i.e. every public
   * `nextValue()` call) the behaviour is unchanged: whatever sits in the
   * retained slot settles the promise right away.
   */
  #nextValue(
    cursor: {generation: number} | null,
    options?: {signal?: AbortSignalLike},
    pendingRead?: PendingRead,
  ): Promise<ValueType> {
    const {signal} = options ?? {};

    return new Promise((resolve, reject) => {
      // Order-bearing, not incidental: an already-aborted signal beats an
      // already-destroyed link, because the S9 check in `#asyncValues()`
      // decides by the *identity* of the rejection (`err === signal.reason`)
      // and this is the path that picks which one that is.
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
        reject(new Error(NEXT_VALUE_DESTROYED));
        return;
      }

      const read = new NextValueRead<ValueType>(resolve, reject, pendingRead);

      if (pendingRead != null) {
        // W1: hand the caller — `asyncValues()`, and only it — a way to end
        // this read from the outside. Rejecting with an `Error` of our own
        // (never `signal.reason`) makes the generator's catch clause treat
        // it as a normal stop, so it breaks out of the loop and runs its
        // `finally` instead of rethrowing.
        pendingRead.cancel = () => read.settleWithCancel();
      }

      // K1: DESTROY and the abort listener are subscribed *before* VALUE,
      // and each is handed to `read.add()` immediately, not batched
      // into one `push()` call after all three exist. Reason: eventize
      // replays a *retained* event synchronously, inside the subscribe call
      // itself (`on()` for VALUE below, `once()` for the rest), before that
      // call returns — and `asyncValues()` retains
      // VALUE (ASYNC-005). If VALUE were subscribed first, its own replay
      // could run before the read's handle list holds anything else at all —
      // including the not-yet-registered DESTROY/abort handles — so the
      // `releaseAll()` it calls would walk an empty array and release
      // nothing, leaking the other two for however long `this` and the
      // caller's `AbortSignal` live. DESTROY is never retained, and
      // `addEventListener('abort', ...)` cannot fire synchronously on
      // registration, so subscribing them first is both safe and
      // sufficient — VALUE is the only one of the three that can go off
      // inline, right here, and only it needs everything else in place
      // first.
      read.add(once(this, DESTROY, () => read.settleWithDestroy()));

      if (signal != null) {
        const onAbort = () => read.settleWithAbort(signal.reason);
        signal.addEventListener('abort', onAbort, {once: true});
        // Also part of `releaseAll()`: whichever of VALUE/DESTROY/abort
        // settles the promise first must detach the *other* listeners too,
        // this one included — otherwise a `nextValue()` that resolves
        // normally leaves its abort listener on the caller's `AbortSignal`
        // for as long as that signal lives (ASYNC-004).
        read.add(() => signal.removeEventListener('abort', onAbort));
      }

      // ASYNC-005: `on`, not `once` — which is what the line that used to
      // stand here ("we can not just use 'once' here because the value is
      // retained") was reaching for, three refactors ago. A retained VALUE is
      // replayed synchronously inside this very call (see the K1 block
      // above), and a replay of a generation this caller has already consumed
      // is not a next value: it has to be ignored *while staying subscribed*.
      // A `once` is spent by the replay, so ignoring it would leave this
      // promise pending for good.
      // `hasSettled`, not `settledInline`: the listener sets it on *every*
      // resolution, including one that arrives minutes later. It answers the
      // inline question only because it is read exactly once, on the line
      // after `on()` returns — at that point "has settled" can only mean
      // "settled during the subscribe call".
      const releaseValue = on(this, VALUE, (val) => {
        if (this.#consumeGeneration(cursor)) {
          read.settleWithValue(val);
        }
      });
      if (read.hasSettled) {
        // Settled by the replay, i.e. from inside the `on()` call above:
        // `releaseAll()` ran before this handle existed, so it walked past
        // it. Release it here instead — the one thing `once` used to do for
        // us, since a spent obligation removes itself.
        releaseValue();
      } else {
        read.add(releaseValue);
      }
    });
  }

  /**
   * "This delivery is new for this cursor — take it." The predicate a VALUE
   * delivery has to pass before it may settle a read, and the one place the
   * cursor is advanced.
   *
   * A cursor that takes a delivery moves to its generation in the same step,
   * so a later replay of that same generation is refused (ASYNC-005). A
   * plain `nextValue()` passes no cursor and therefore still settles on the
   * replay, exactly as before.
   *
   * Stays a method of the link rather than moving into {@link
   * NextValueRead}: it reads `#emittedGeneration`, a `#private` field no
   * other object can reach without having it handed over as a parameter.
   */
  #consumeGeneration(cursor: {generation: number} | null): boolean {
    if (cursor == null) return true;
    if (cursor.generation === this.#emittedGeneration) return false;
    cursor.generation = this.#emittedGeneration;
    return true;
  }

  /**
   * An `AsyncIterable` of values propagated through this link. Stops when
   * `stopAction(value, index)` returns `true`, or when the link is
   * destroyed — in both cases the loop simply ends, `for await` sees a
   * normal completion.
   *
   * `options.signal` — an `AbortSignal` (typed as `AbortSignalLike`, a
   * structural subset every real `AbortSignal` satisfies), forwarded to
   * every internal `nextValue()` call — makes an *aborted* iteration end
   * differently: it
   * **throws** the abort reason out of the loop instead of ending quietly.
   * That is deliberate, not an oversight: destroy is this link's own
   * lifecycle, expected and unremarkable; abort is the caller cancelling
   * their own wait from the outside, and swallowing that silently would
   * make a signalled cancellation indistinguishable from `stopAction`
   * returning `true` on its own.
   *
   * Retains only the **last** propagated value (a sampler, not a lossless
   * stream) — a value that arrives between two reads of a slow consumer is
   * lost, same as a single `retain()`'d event anywhere else. Each iterator
   * sees each propagated value at most once: a read that finds nothing new
   * waits for the next propagation instead of being handed the retained
   * value again (ASYNC-005). A plain `nextValue()` is unchanged — it still
   * settles on whatever is in the slot. Several
   * `asyncValues()` iterators may run over the same link concurrently; they
   * share that one retained slot, released only once the *last* active
   * iterator stops (ASYNC-005) — an iterator finishing early must not cut a
   * still-running sibling off from the next value. "Released" is literal
   * (MEM-004 — the retain policy, not the queue handles at the top of this
   * file): the last iterator switches retaining off entirely, so a later
   * `nextValue()` waits for the next value instead of resolving
   * synchronously with a stale one. The flip side: `asyncValues()` claims
   * the `'value'` event's retain policy for itself and hands it back at the
   * end, so a `retain(link, VALUE)` set by the caller does not survive it.
   *
   * Caveat shared with every JS async generator, not specific to this one:
   * the `finally` block below — where the iterator count is decremented —
   * only runs if the generator is driven to completion or explicitly closed
   * (`.return()`, `.throw()`, or the implicit `.return()` a `for await`
   * loop issues on `break`/an exception). A caller that calls `.next()` a
   * few times and then simply drops the generator without closing it takes
   * this link's retained-value bookkeeping down with it: the count never
   * comes back to 0, so `unretain()` never runs again for this link and
   * VALUE stays retained until the link is destroyed.
   * There is no fix within the iterator protocol itself; the caller closing
   * what it opens is the contract, same as any other manually-driven
   * iterator. What the contract *does* guarantee is that closing works at
   * any time: `.return()`/`.throw()` settle even while the iterator is
   * waiting for a value that never comes (W1).
   */
  asyncValues(
    stopAction?: (value: ValueType, index: number) => boolean,
    options?: {signal?: AbortSignalLike},
  ) {
    // W1: an async generator suspended in an `await` — which is where this
    // one spends every idle phase, inside `#nextValue()` — cannot be closed
    // from the outside: `.return()`/`.throw()` are queued behind the pending
    // read and only run once it settles. With ASYNC-005 fixed, a read that
    // finds nothing new waits for the next propagation, so that queue can
    // sit there forever, and `.return()` — the very call this method's
    // contract asks callers to make — would never settle, never run the
    // `finally` below, never release the retain policy.
    //
    // So the iterator gets one thing a bare generator has not: a handle on
    // its own pending read. `.return()`/`.throw()` pull it first, the read
    // rejects, the generator leaves its `await` and runs to completion — and
    // only then does the queued call it was blocking get its turn.
    const pendingRead: PendingRead = {};
    const iterator = this.#asyncValues(pendingRead, stopAction, options);

    const closeIterator = iterator.return.bind(iterator);
    iterator.return = ((value?: any) => {
      pendingRead.cancel?.();
      return closeIterator(value);
    }) as typeof iterator.return;

    const failIterator = iterator.throw.bind(iterator);
    iterator.throw = ((err?: any) => {
      pendingRead.cancel?.();
      return failIterator(err);
    }) as typeof iterator.throw;

    return iterator;
  }

  async *#asyncValues(
    pendingRead: PendingRead,
    stopAction?: (value: ValueType, index: number) => boolean,
    options?: {signal?: AbortSignalLike},
  ) {
    retain(this, VALUE);
    this.#activeAsyncValuesCount += 1;
    // ASYNC-005: this iterator's own cursor into the shared retained slot.
    // 0 accepts whatever is in the slot right now — a second iterator
    // joining a running one still starts with the current value, as before —
    // and from then on the same generation is never handed out twice.
    const cursor = {generation: 0};
    try {
      let i = 0;
      while (!this.isDestroyed) {
        try {
          const next = await this.#nextValue(cursor, options, pendingRead);
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
        // MEM-004 (the retain policy, not the queue handles at the top of
        // this file): `unretain`, not `retainClear`. The one clears the
        // slot, the other takes the policy with it — and only the policy is
        // the problem here. After a `retainClear()` VALUE stays retained:
        // every further propagated value lands in the slot with nobody
        // listening, and the next `on(this, VALUE, …)` — from
        // `nextValue()`, i.e. from this class's own contract — gets it
        // replayed synchronously inside the registration call instead of
        // waiting for the next one. `unretain` deletes the stored value
        // along the way (eventize: `keeper.remove()` calls `clear()`), so
        // this is one call instead of two.
        unretain(this, VALUE);
      }
    }
  }

  destroy() {
    if (this.isDestroyed) return;

    // BUG-002: flag first, teardown second — same rule and the same
    // reason as `EffectImpl.destroy()`'s "flag first, unsubscribe second".
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
      collect(releaseErrors, unsubscribe);
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
    collect(releaseErrors, () => emit(this, DESTROY, this));

    // No `unretain(this, VALUE)` (and no `retainClear()`, which used to
    // stand here) — `off(obj)` without a listener argument runs
    // `keeper.removeAll()`, dropping every retain policy and every stored
    // value in one go. The line that was here cleared a slot that the next
    // line was about to remove outright.
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

      this.#emittedGeneration = generation;
      emit(this, VALUE, value);
      this.lastValue = value;
    }
  }
}

export class SignalLinkToSignal<
  ValueType = unknown,
> extends SignalLink<ValueType> {
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
  ValueType = unknown,
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
