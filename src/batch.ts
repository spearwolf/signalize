import {emit, on} from '@spearwolf/eventize';
import {
  beginIsolatedDelivery,
  collectDeliveryError,
  endIsolatedDelivery,
  throwCollectedErrors,
} from './collect-errors.js';
import {RECALL} from './constants.js';
import {globalEffectCalledQueue, globalEffectQueue} from './global-queues.js';
import type {NonThenable, VoidFunc} from './types.js';

/*
 * How deep we are inside `Batch#run()`.
 *
 * A counter, not a flag, and it brackets *more* than the two temporary
 * subscriptions below, not less: an effect callback may open a batch of
 * its own, whose flush is a second, nested `run()` with its own dedup
 * set — while the outer flush's subscription is still live. A flag would
 * report "no flush" the moment the inner one closed, and every effect
 * that ran directly after that would go unrecorded and be run a second
 * time by the outer flush. A superfluous emit is free; a missing one is
 * a duplicate effect run.
 */
let g_flushDepth = 0;

/**
 * Whether a batch flush is currently delivering.
 *
 * The one reason `EffectImpl` emits on `globalEffectCalledQueue` at all:
 * that queue has exactly one subscriber, installed by `Batch#run()` for
 * the duration of a flush. Outside one, the emit walks eventize's
 * dispatch for zero listeners, on the hottest path in the library.
 * @internal
 */
export const isFlushingBatch = (): boolean => g_flushDepth > 0;

class Batch {
  static current?: Batch;

  readonly delayedEffects: Array<[number, Set<symbol>]> = [];

  batch(effectId: symbol, priority: number) {
    const len = this.delayedEffects.length;
    for (let i = 0; i < len; i++) {
      const [prio, effects] = this.delayedEffects[i];
      if (prio > priority) {
        continue;
      }
      if (prio === priority) {
        effects.add(effectId);
        return;
      }
      this.delayedEffects.splice(i, 0, [priority, new Set([effectId])]);
      return;
    }
    this.delayedEffects.push([priority, new Set([effectId])]);
  }

  /**
   * Take an effect id back out of the queue.
   *
   * The counterpart of {@link batch}, for the one run that cannot be
   * deferred: a memo whose value is being read right now runs past the
   * batch gate, and the entry an earlier write left for it is
   * then a duplicate of a run that has already happened. A later write
   * re-queues the effect through `batch()` as before — this takes the
   * pending run away, not the effect's place in the priority order.
   */
  unbatch(effectId: symbol, priority: number) {
    const len = this.delayedEffects.length;
    for (let i = 0; i < len; i++) {
      const [prio, effects] = this.delayedEffects[i];
      if (prio === priority) {
        effects.delete(effectId);
        return;
      }
    }
  }

  flush() {
    // The queue is spent either way: `run()` delivers a RECALL to every id
    // in it and only then re-raises what the effects handed in, so a throw
    // is never "we stopped halfway". Clearing after `run()` instead of in a
    // `finally` used to leave the whole queue standing — and `hibernate()`,
    // its only caller, then restored a batch that recalled every one of
    // them a second time when it closed: two runs of the same callback for
    // one write, and the same failure reported at two different callers.
    //
    // The argument covers the delivery, not `run()`'s own setup: a throw out
    // of `beginIsolatedDelivery()` or the two `on()` subscriptions ahead of
    // the loop would clear a queue nothing was delivered from. Neither can
    // throw today (an array push and two subscribes), which is why this is a
    // note and not a second `try`.
    try {
      this.run();
    } finally {
      this.delayedEffects.length = 0;
    }
  }

  /**
   * Deliver a RECALL to every effect id in the queue, deduplicated, in
   * priority order.
   *
   * The early return is exactly equivalent to running the body on an empty
   * queue: the loop iterates zero times, so between `beginIsolatedDelivery()`
   * and `endIsolatedDelivery()` only the two `on()` calls and their
   * unsubscribe would happen. Nothing can be collected in a frame nothing is
   * delivered from, and a subscription that is installed and removed without
   * an emit in between is not observable from the outside.
   *
   * It is here because an empty queue is the normal case for every batch
   * whose writes did not reach a single effect: `SignalAutoMap.update()` on
   * unobserved props, a `{batchWrites: true}` memo without a downstream
   * effect, and every defensive `batch()` in application code. Without it
   * each of those pays for a `Set`, an array and two subscriptions to
   * deliver nothing.
   */
  run() {
    if (this.delayedEffects.length === 0) return;

    const alreadyBeenCalled = new Set<symbol>();

    const unsubscribe: VoidFunc[] = [];
    // Raised before the first subscription exists and lowered after the last
    // one is gone — deliberately wider than the subscription window, see
    // `g_flushDepth` above. Outside the `try`, with only
    // `beginIsolatedDelivery()` in between: that is an array push and cannot
    // throw today, the same argument `flush()` makes for its own frame. If it
    // ever can, the increment moves inside.
    g_flushDepth++;
    const outerErrors = beginIsolatedDelivery();
    try {
      unsubscribe.push(
        on(globalEffectQueue, (effectId, actionType) => {
          if (actionType === RECALL) {
            alreadyBeenCalled.add(effectId);
          }
        }),
        on(globalEffectCalledQueue, (effectId) => {
          alreadyBeenCalled.add(effectId);
        }),
      );

      for (const [, effects] of this.delayedEffects) {
        for (const effectId of effects) {
          if (alreadyBeenCalled.has(effectId)) {
            continue;
          }
          try {
            emit(globalEffectQueue, effectId, effectId, RECALL);
          } catch (err) {
            // The effect's own failure never gets this far — `[RECALL]`
            // parked it in the frame opened above. This catches whatever
            // else sits on the queue under that id, so one foreign listener
            // cannot cost the rest of the batch its flush.
            collectDeliveryError(err);
          }
        }
      }
    } finally {
      try {
        for (const unsub of unsubscribe) {
          unsub();
        }
      } finally {
        // Nested, because closing the frame is not optional: an `unsub()`
        // that threw would otherwise leave the module state one level deep
        // for the rest of the process. The depth counter gets the same
        // treatment one level further out, for the same reason.
        try {
          endIsolatedDelivery(outerErrors, 'flushing a batch of signal writes');
        } finally {
          g_flushDepth--;
        }
      }
    }
  }
}

export const getCurrentBatch = (): Batch | undefined => Batch.current;

export const clearBatch = (): void => {
  Batch.current = undefined;
};

export const restoreBatch = (batch: Batch | undefined): void => {
  Batch.current = batch;
};

// XXX `batch()` is a _hint_ not a _guarantee_ to run all effects in just _one_ strike.

// duplicated on purpose, not imported from `EffectImpl.ts`: `batch.ts` sits
// below `EffectImpl.ts` in the module graph and importing it back would
// create the cycle `rollup.config.mjs` rejects (see CLAUDE.md).
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  value != null && typeof (value as PromiseLike<unknown>).then === 'function';

/**
 * Batch multiple signal updates together to defer effect execution.
 * Effects are deduplicated and run once after the callback completes,
 * improving performance when updating multiple signals at once.
 *
 * Batches can be nested - the effects only run when the outermost batch completes.
 *
 * `callback` must be synchronous. `batch()` only sees signal writes that
 * happen on the current call stack — an `async` callback returns a pending
 * `Promise` at its first `await`, at which point `batch()` has nothing left
 * to wait for and closes the batch. Everything the callback does after that
 * `await` then runs completely unbatched, indistinguishable from working
 * code. To catch this early, `batch()` throws `TypeError` if `callback`
 * returns a thenable (checked structurally at runtime, and rejected by
 * `tsc` for anything typed as `Promise`/`PromiseLike` before that). This is
 * a hard error at the call site (unlike an async *effect* callback, whose
 * rejection cannot be thrown at any caller and goes to `onEffectError()`
 * instead) — `batch()`'s caller is still on the stack and can catch it
 * directly.
 *
 * An effect that throws during the flush no longer holds up the other
 * delayed effects; its error — or an `AggregateError`, if several of them
 * failed — arrives at the `batch()` caller once the flush is complete.
 *
 * If `callback` *and* the flush fail, both errors arrive together as an
 * `AggregateError`, callback error first — the flush no longer replaces what
 * the callback threw. A single failure, from either side, is rethrown
 * unchanged, including the `TypeError` of the thenable guard above.
 *
 * @param callback - Synchronous function containing signal updates to batch
 * @throws {TypeError} if `callback` returns a thenable and the flush succeeds
 * @throws {AggregateError} if both sides fail — the callback's error (or the
 *   `TypeError` above) as `errors[0]`, the flush's as `errors[1]`
 */
export function batch<T>(callback: () => NonThenable<T>): void {
  // if there is a current batch context, we use it, otherwise we just create a new one.
  // the batch is executed after the callback, but only if we have created the batch ourselves.
  let curBatch = Batch.current;
  if (!curBatch) {
    curBatch = Batch.current = new Batch();
  } else {
    curBatch = undefined;
  }
  // Created on the first failure, never on the happy path: `batch()` sits in
  // front of every grouped write and the overwhelming majority of calls
  // collect nothing. Same reasoning as the delivery frame's array.
  //
  // Worth a good deal more since `run()` returns early on an empty queue: the
  // eager version (a `const errors: unknown[] = []` plus an unconditional
  // `throwCollectedErrors()`) measured about 10 % slower on an empty
  // `batch()` — 18.6 against 16.6 Mops/s, median of six interleaved runs —
  // where before that early return the same allocation disappeared in the
  // flush's own cost.
  let errors: unknown[] | undefined;

  try {
    const result = callback();
    if (isThenable(result)) {
      throw new TypeError(
        '[signalize] batch: callback must be synchronous, but it returned a thenable. ' +
          'batch() only sees writes made on the current call stack — an async callback ' +
          'stops being batched at its first `await`, so every write after that runs ' +
          'unbatched without any error. Move the async work outside of batch(), or split ' +
          'it into several synchronous batch() calls.',
      );
    }
  } catch (err) {
    // Held, not rethrown: the flush below runs either way, and a failing
    // effect in it must not take this error's place.
    errors = [err];
  } finally {
    if (curBatch) {
      Batch.current = undefined;
      try {
        curBatch.run();
      } catch (err) {
        if (errors === undefined) {
          errors = [err];
        } else {
          errors.push(err);
        }
      }
    }
  }

  // One error is rethrown unchanged — the common case keeps its identity,
  // including the `TypeError` the thenable guard promises at the call site.
  // Two become an `AggregateError` in that order: callback first, flush
  // second. A flush that already bundled several failing effects arrives as
  // one nested `AggregateError`; nothing is flattened, exactly as everywhere
  // else this helper is used.
  if (errors !== undefined) {
    throwCollectedErrors(errors, 'running a batch');
  }
}
