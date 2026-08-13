import {throwIfThenable} from './thenable-guard.js';
import type {NonThenable} from './types.js';

let g_numberOfBeQuietRequests = 0;

const THENABLE_HINT =
  'beQuiet() closes its frame the moment an async action returns its pending ' +
  'promise at the first `await` — every read after that point is tracked again ' +
  'and every write loud again, and the promise handed back would resolve outside ' +
  'the frame that appeared to produce it. Do the awaiting outside of beQuiet(), ' +
  'and pass a synchronous action.';

/**
 * Execute an action in "quiet mode" where signal reads do not create
 * dependencies and signal writes do not trigger effects.
 *
 * Calls can be nested - quiet mode remains active until all nested calls complete.
 *
 * `action` must be synchronous. `beQuiet()` closes its frame the moment an
 * `async` action returns its pending promise at the first `await`, so every
 * read and write after that point is tracked and loud again — and the promise
 * handed back would resolve outside the frame that appeared to produce it.
 * Both sides are refused: the signature rejects anything typed to return a
 * `Promise`/`PromiseLike` at `tsc` time, and an action that hands back
 * something with a callable `then` throws a `TypeError`, as it does in
 * `batch()` and `hibernate()`. The frame is closed before that `TypeError`
 * reaches the caller.
 *
 * `docs/api.md`, "Context modes" → "beQuiet(action): T"
 *
 * @returns The action's return value
 * @throws {TypeError} if `action` returns a thenable
 */
export function beQuiet<T>(action: () => NonThenable<T>): T {
  g_numberOfBeQuietRequests++;
  try {
    const result = action();
    // Checked inside the frame: the `finally` below closes it before the
    // TypeError reaches the caller, so a refused action leaves the quiet
    // counter exactly where it found it.
    throwIfThenable(result, 'beQuiet', 'action', THENABLE_HINT);
    return result;
  } finally {
    g_numberOfBeQuietRequests--;
  }
}

/**
 * Check if the system is currently in quiet mode (inside a `beQuiet()` call).
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
