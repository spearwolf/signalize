import {clearBatch, getCurrentBatch, restoreBatch} from './batch.js';
import {clearBeQuiet, getBeQuietCount, restoreBeQuiet} from './bequiet.js';
import {
  clearGlobalEffectStack,
  getGlobalEffectStackSnapshot,
  restoreGlobalEffectStack,
} from './globalEffectStack.js';
import type {NonThenable} from './types.js';

/**
 * Execute a callback in a "hibernation" state where all previous context states
 * from batch(), beQuiet(), or createEffect() are temporarily cleared.
 *
 * During hibernation, all API calls function as if they were called without any context.
 * After executing the callback (regardless of success or exception), all states
 * that were active before the callback are restored. That also covers the flush
 * of the saved batch, which happens inside the same frame: an effect that throws
 * in it costs nobody the restore.
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

  try {
    // Flush the saved batch after clearing (so effects actually run instead
    // of being re-batched) — inside the `try`, because an effect that throws
    // in there must not cost the three `restore*` calls below. It used to sit
    // in front of the `try`, and a failing flush then left the process with a
    // cleared batch, a quiet counter of 0 and an empty effect stack, in the
    // middle of frames that were still open (ASYNC-001).
    if (savedBatch) {
      savedBatch.flush();
    }

    return callback();
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
}
