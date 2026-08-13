// Leaf module — imports nothing, not even from this package. It sits
// beside `collect-errors.ts` at the bottom of the layering, so every
// level may reach down to it without risking the cycle
// `rollup.config.mjs` fails the bundle on (CIRCULAR_DEPENDENCY).

/**
 * Whether `value` has a callable `then`.
 *
 * Structural on purpose: a userland promise implementation closes a
 * context frame just as thoroughly as a native one.
 * @internal
 */
export const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  value != null && typeof (value as PromiseLike<unknown>).then === 'function';

/**
 * Refuse a callback that handed back a thenable.
 *
 * `batch()`, `beQuiet()` and `hibernate()` are each closed by a `finally`
 * that fires the moment an `async` callback returns its pending promise at
 * the first `await`. Everything past that `await` runs outside the frame it
 * was written inside, and looks exactly like working code. `NonThenable<T>`
 * refuses that at `tsc` time; this is the same refusal for an untyped
 * caller, and for a synchronous callback that merely returns something
 * thenable-shaped.
 *
 * The message is assembled inside the `if`, so a frame on the hot path
 * pays one call and one `typeof` per invocation.
 *
 * @param fnName - the frame's own name, e.g. `'batch'`
 * @param paramName - what that frame calls its callback, e.g. `'action'`
 * @param consequence - what goes silently wrong in this particular frame,
 *   and what to do instead
 * @throws {TypeError} if `result` has a callable `then`
 * @internal
 */
export const throwIfThenable = (
  result: unknown,
  fnName: string,
  paramName: string,
  consequence: string,
): void => {
  if (isThenable(result)) {
    throw new TypeError(
      `[signalize] ${fnName}: ${paramName} must be synchronous, but it returned a thenable. ${consequence}`,
    );
  }
};
