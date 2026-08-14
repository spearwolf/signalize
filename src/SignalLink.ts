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
// promise.
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
   * Clearing the hook is precaution, not load bearing: a hook left behind
   * reaches only this read's own handles, which are spent by then (eventize
   * unsubscribes are idempotent), and it would reject a promise that has
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
 * the spelling to reach for, for callers as much as for this library:
 * `ValueType` is invariant, so `SignalLink<unknown>` accepts no concrete
 * link.
 *
 * `docs/api.md`, "Types"
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
  // `destroy()` runs all of them. Without it, the closures (routed
  // through `selfRef`, so they do not pin the link *from the queues* — see
  // the weak self-reference below; `src/link.ts` covers what still does) stay
  // subscribed on a queue that lives as long as the process, until the
  // *other* side's signal is destroyed too — which for a link torn down well
  // before its signals is never.
  //
  // `destroy()` is not the only reader. `src/link.ts` registers
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

  // How many `asyncValues()` generators are currently iterating
  // this link. `unretain(this, VALUE)` in that generator's `finally` block
  // only runs once this drops back to 0.
  #activeAsyncValuesCount = 0;

  // Bumped once per `updateValue()` frame, before control goes
  // to `action()`. Only ever compared for equality — the absolute value
  // carries no meaning, and no path reads it from outside this class.
  #propagationGeneration = 0;

  // The generation of the most recent VALUE emit — assigned on
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
   * The signal this link reads from, as a deliberately narrow view:
   * {@link LinkSource} exposes `id`, `value`, `muted` and `destroyed` and
   * nothing else. At runtime this *is* the signal implementation, only typed
   * down — a link is a one-way read connection, and whoever needs to write
   * holds the `Signal` the link was made from.
   *
   * `docs/api.md`, "Links" → "What `source.value` shows"
   */
  readonly source: LinkSource<ValueType>;

  /**
   * The last value this link announced — the value of the most recent
   * propagation frame that ran to completion.
   *
   * Two frames deliberately leave it alone: one whose propagation destroyed
   * this link, and one that a nested, re-entrant frame superseded — there,
   * the nested frame's newer value is the one that stays.
   *
   * `docs/api.md`, "Links" → "Re-entrant propagation"
   */
  lastValue?: ValueType;

  isDestroyed = false;

  constructor(source: SignalLike<ValueType>) {
    eventize(this);

    this.source = signalImpl(source);

    // Weak self-reference: these two callbacks subscribe on
    // module-level global queues that live for the whole process. A plain
    // `this` closure here would keep the link (and everything it reaches —
    // the source signal, the target, a callback's closure) permanently
    // reachable *from those queues*, on top of whatever else already holds
    // it. Going through a WeakRef stops the queues from being one more
    // pinning path; once a link is genuinely collected, the dereffed
    // callbacks are silent no-ops.
    //
    // It does not, on its own, make an orphaned link collectible:
    // `src/link.ts`'s `gLinks` registry holds every link on a live source
    // signal in an ordinary, strongly-referencing `Map`, for as long as that
    // source lives — see the comment there. This WeakRef only rules out the
    // queues as an *additional* permanent root; the registry is still one.
    //
    // It is load-bearing twice over: the unsubscribe handles collected
    // below are handed to `link.ts`'s
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
   * Register an unsubscribe handle for release. A subclass that adds its own
   * subscription on a permanent global queue (see `SignalLinkToSignal`) goes
   * through this instead of touching the field directly.
   *
   * Anything registered here is released by **both** teardown routes:
   * `destroy()` runs it, and so does the link registry's
   * `FinalizationRegistry` if the link is merely collected instead. Which
   * means the handle must survive being called on a link that no longer
   * exists — eventize's handles do, and a subclass handing over anything
   * else has to.
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
   * an already-aborted one rejects immediately, without waiting for the next
   * value or a destroy.
   *
   * `docs/api.md`, "Links" → "nextValue(options?) / asyncValues(stop?,
   * options?)"
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
   * over and over. Without one (`null`, i.e. every public
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
      // VALUE. If VALUE were subscribed first, its own replay
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
        // for as long as that signal lives.
        read.add(() => signal.removeEventListener('abort', onAbort));
      }

      // `on`, not `once`: a retained VALUE is replayed synchronously inside
      // this very call (see the K1 block above), and a replay of a generation
      // this caller has already consumed is not a next value: it has to be
      // ignored *while staying subscribed*. A `once` is spent by the replay,
      // so ignoring it would leave this promise pending for good.
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
        // it. Release it here instead — the one thing a `once` would do by
        // itself, since a spent obligation removes itself.
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
   * so a later replay of that same generation is refused. A plain
   * `nextValue()` passes no cursor and therefore settles on the replay.
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
   * An `AsyncIterable` of the values propagated through this link. It ends
   * when `stopAction(value, index)` returns `true`, or when the link is
   * destroyed — either way `for await` sees a normal completion.
   *
   * An *abort* ends it differently. `options.signal` is forwarded to every
   * internal `nextValue()` call, and an abort **throws** the reason out of
   * the loop instead of ending quietly: destruction is this link's own
   * lifecycle, an abort is the caller cancelling from the outside, and the
   * two are meant to be told apart.
   *
   * Only the **last** propagated value is retained — a sampler, not a
   * lossless stream — and each iterator sees each propagated value at most
   * once: a read that finds nothing new waits for the next propagation
   * rather than taking the retained value again. A plain `nextValue()` goes
   * the other way and settles on whatever is in the slot. Several iterators
   * may run over the same link concurrently and share that one slot.
   *
   * Caveat, shared with every JS async generator: the bookkeeping that gives
   * the retained slot back sits in a `finally`, and a `finally` only runs
   * once the generator is driven to completion or closed — `.return()`,
   * `.throw()`, or the implicit `.return()` a `for await` issues on `break`
   * or an exception. Drive the iterator by hand and then drop it without
   * closing it, and the active-iterator count never comes back to 0, so
   * `unretain()` never runs again for this link and VALUE stays retained
   * until the link is destroyed. Closing what you open is the contract, and
   * it is possible at any time — including while the iterator waits for a
   * value that never comes.
   *
   * `docs/api.md`, "Links" → "nextValue(options?) / asyncValues(stop?,
   * options?)"
   */
  asyncValues(
    stopAction?: (value: ValueType, index: number) => boolean,
    options?: {signal?: AbortSignalLike},
  ) {
    // W1: an async generator suspended in an `await` — which is where this
    // one spends every idle phase, inside `#nextValue()` — cannot be closed
    // from the outside: `.return()`/`.throw()` are queued behind the pending
    // read and only run once it settles. A read that finds nothing new
    // waits for the next propagation, so that queue can
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
    // This iterator's own cursor into the shared retained slot.
    // 0 accepts whatever is in the slot right now — a second iterator
    // joining a running one starts with the current value — and from then on
    // the same generation is never handed out twice.
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
        // The retain policy, not the queue handles at the top of this
        // file: `unretain`, not `retainClear`. The one clears the
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

    // Flag first, teardown second — same rule and the same reason as
    // `EffectImpl.destroy()`'s "flag first, unsubscribe second".
    // Everything below reaches application code: `emit(this, DESTROY,
    // this)` serves every listener, and an `on()` listener — unlike a
    // `once()` one — is still subscribed while it runs. One that calls
    // `destroy()` again would walk into an unguarded teardown and recurse
    // until the stack blew; the guard above catches it. It
    // also makes `isDestroyed` tell the truth *inside* a DESTROY
    // listener, which is what `updateValue()`'s post-`action()` check
    // relies on when the callback destroys the link.
    this.isDestroyed = true;

    // Release every global-queue subscription this link (and its
    // subclass, if any) registered — the `globalSignalQueue` one included,
    // inside the collecting pattern rather than beside it. Safe to call
    // even for an obligation
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

    // `emit()` reaches application code too, and with the flag set up front
    // a throwing DESTROY listener gets no second chance from a later
    // `destroy()` — that call returns at the guard. An escaping error would
    // leave a
    // link that reports `isDestroyed === true` while still being subscribed,
    // unfrozen and holding its last value, permanently. So the emit joins the
    // same collect-and-carry-on pattern as the release loop above.
    collect(releaseErrors, () => emit(this, DESTROY, this));

    // No `unretain(this, VALUE)` and no `retainClear()` — `off(obj)` without
    // a listener argument runs `keeper.removeAll()`, dropping every retain
    // policy and every stored value in one go.
    collect(releaseErrors, () => off(this));

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
      // Claim a generation *before* handing control over. Every
      // line below the `action()` call can have been re-entered by then;
      // this counter is how the outer frame finds out that it was.
      const generation = ++this.#propagationGeneration;

      const {value} = this.source;

      action(value);

      // `action()` is application code — the link callback, or
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

      // A nested `updateValue()` ran to completion while
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
    // Weak self-reference, same reasoning as the base constructor:
    // `globalDestroySignalQueue` is a permanent module-level root, so a
    // plain `this` closure here would pin this link — and through it
    // `source`/`target` — for the process lifetime.
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
