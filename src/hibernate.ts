import {clearBatch, getCurrentBatch, restoreBatch} from './batch.js';
import {clearBeQuiet, getBeQuietCount, restoreBeQuiet} from './bequiet.js';
import {
  clearGlobalEffectStack,
  getGlobalEffectStackSnapshot,
  restoreGlobalEffectStack,
} from './globalEffectStack.js';

/**
 * Execute a callback in a "hibernation" state where all previous context states
 * from batch(), beQuiet(), or createEffect() are temporarily cleared.
 *
 * During hibernation, all API calls function as if they were called without any context.
 * After executing the callback (regardless of success or exception), all states
 * that were active before the callback are restored.
 *
 * This function is stackable - nested hibernate() calls work correctly.
 *
 * @param callback - The function to execute in hibernation state
 */
export function hibernate<T>(callback: () => T): T {
  // Save current states
  const savedBatch = getCurrentBatch();
  const savedBeQuietCount = getBeQuietCount();
  const savedEffectStack = getGlobalEffectStackSnapshot();

  // Clear all context states
  clearBatch();
  clearBeQuiet();
  clearGlobalEffectStack();

  // Flush the saved batch after clearing (so effects actually run instead of being re-batched)
  if (savedBatch) {
    savedBatch.flush();
  }

  try {
    return callback();
  } finally {
    // Restore all context states
    restoreBatch(savedBatch);
    restoreBeQuiet(savedBeQuietCount);
    restoreGlobalEffectStack(savedEffectStack);
  }
}
