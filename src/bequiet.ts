let g_numberOfBeQuietRequests = 0;

/**
 * Execute a callback in "quiet mode" where signal reads do not create dependencies
 * and signal writes do not trigger effects.
 *
 * Useful for reading signal values without subscribing to them,
 * or updating signals without triggering reactive updates.
 *
 * Calls can be nested - quiet mode remains active until all nested calls complete.
 *
 * @param action - Function to execute in quiet mode
 */
export function beQuiet(action: () => any): void {
  g_numberOfBeQuietRequests++;
  try {
    action();
  } finally {
    g_numberOfBeQuietRequests--;
  }
}

/**
 * Check if the system is currently in quiet mode (inside a beQuiet() call).
 * @returns True if in quiet mode, false otherwise
 */
export function isQuiet(): boolean {
  return g_numberOfBeQuietRequests > 0;
}

export function getBeQuietCount(): number {
  return g_numberOfBeQuietRequests;
}

export function clearBeQuiet(): void {
  g_numberOfBeQuietRequests = 0;
}

export function restoreBeQuiet(count: number): void {
  g_numberOfBeQuietRequests = count;
}
