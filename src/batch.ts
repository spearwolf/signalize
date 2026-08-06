import {emit, on} from '@spearwolf/eventize';
import {RECALL} from './constants.js';
import {globalEffectCalledQueue, globalEffectQueue} from './global-queues.js';
import type {NonThenable, VoidFunc} from './types.js';

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

  flush() {
    this.run();
    this.delayedEffects.length = 0;
  }

  run() {
    const alreadyBeenCalled = new Set<symbol>();

    const unsubscribe: VoidFunc[] = [];
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
          emit(globalEffectQueue, effectId, effectId, RECALL);
        }
      }
    } finally {
      for (const unsub of unsubscribe) {
        unsub();
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
 * @param callback - Synchronous function containing signal updates to batch
 * @throws {TypeError} if `callback` returns a thenable
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
  } finally {
    if (curBatch) {
      Batch.current = undefined;
      curBatch.run();
    }
  }
}
