import {clearBatch, getCurrentBatch, restoreBatch} from './batch.js';
import {clearBeQuiet, getBeQuietCount, restoreBeQuiet} from './be-quiet.js';
import {collect, throwCollectedErrors} from './collect-errors.js';
import {
  clearGlobalEffectStack,
  getGlobalEffectStackSnapshot,
  restoreGlobalEffectStack,
} from './global-effect-stack.js';
import type {NonThenable} from './types.js';

/**
 * Execute a callback in a "hibernation" state where all previous context states
 * from batch(), beQuiet(), or createEffect() are temporarily cleared.
 *
 * During hibernation, all API calls function as if they were called without any context.
 * After executing the callback (regardless of success or exception), all states
 * that were active before the callback are restored. If a batch was active, its
 * queued effects are flushed before the callback runs. A flush that throws does
 * not take the callback with it: the failure is held, the callback runs, and it
 * is reported once the three contexts are restored — alone and unchanged, or
 * together with a failing callback as an `AggregateError` with the flush error
 * first.
 *
 * This function is stackable - nested hibernate() calls work correctly.
 *
 * `callback` must be synchronous, and its signature rejects anything typed
 * to return a `Promise`/`PromiseLike` at `tsc` time: an `async` callback
 * returns its pending promise at the first `await`, the `finally` below
 * restores the saved batch, quiet counter and effect stack right there, and
 * everything past that `await` runs outside the hibernation it was written
 * inside. The same narrowing `batch()` and `beQuiet()` carry; as with
 * `beQuiet()`, there is no runtime check for a duck-typed thenable.
 *
 * @param callback - Synchronous function to execute in hibernation state
 * @throws {AggregateError} if the flush of the saved batch *and* `callback`
 *   fail — the flush's error as `errors[0]`, the callback's as `errors[1]`
 */
export function hibernate<T>(callback: () => NonThenable<T>): T {
  // Save current states
  const savedBatch = getCurrentBatch();
  const savedBeQuietCount = getBeQuietCount();
  const savedEffectStack = getGlobalEffectStackSnapshot();

  // Clear all context states
  clearBatch();
  clearBeQuiet();
  clearGlobalEffectStack();

  const errors: unknown[] = [];
  let result: T;

  try {
    // Flush the saved batch after clearing, so its effects actually run
    // instead of being re-batched — and inside the frame, so a throwing
    // effect costs neither the three `restore*` calls below nor the
    // callback the caller handed in. The failure waits in `errors`.
    if (savedBatch) {
      collect(errors, () => savedBatch.flush());
    }

    collect(errors, () => {
      result = callback();
    });
  } finally {
    // Restore all context states. Flat, not nested the way `Batch.run()`
    // nests its own `finally` (`batch.ts`): none of these three can throw.
    // Two are plain assignments to a module-level binding, the third is a
    // `length = 0` plus a spread `push` whose only conceivable failure is a
    // `RangeError` at a stack depth no reactive graph reaches. Nest them the
    // moment one of them grows a body.
    restoreBatch(savedBatch);
    restoreBeQuiet(savedBeQuietCount);
    restoreGlobalEffectStack(savedEffectStack);
  }

  // Reported after the restores, never before: whoever catches this finds
  // the three contexts exactly as they were. One failure is rethrown
  // unchanged, so the common case keeps the error's identity; a flush and
  // a callback that both fail arrive as an `AggregateError`, flush error
  // first — the order they happened in.
  throwCollectedErrors(errors, 'hibernating');

  // `result` is assigned whenever this line is reached: the only way to skip
  // the assignment above is for `callback` to throw, and that throw is what
  // `errors` holds and the line above just rethrew.
  return result;
}
