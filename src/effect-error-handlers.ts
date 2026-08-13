// Leaf module — it may import `./constants.js`, `./global-queues.js` and,
// **type-only**, `./types.js`. Nothing else, and `./effects.js` or
// `./EffectImpl.js` least of all: both read from this module (the counter it
// keeps replaces the linear scan `emitEffectError()` used to run), and
// `effects.ts` → `EffectImpl.ts` → `SignalGroup.ts` → `signalize-error.ts` is
// already a chain of value imports — a value import back into either of them
// from here would close a ring. Measured on a prototype that put the counter
// directly in `effects.ts` instead: `tsc --noEmit` stays silent, `pnpm
// compile` succeeds, and `pnpm bundle` fails with `Circular dependency: lib/
// effects.js -> lib/EffectImpl.js -> lib/effects.js` (`rollup.config.mjs`'s
// `CIRCULAR_DEPENDENCY` branch).

let handlerCount = 0;

/** @internal */
export const hasEffectErrorHandler = (): boolean => handlerCount > 0;

/** @internal */
export const getEffectErrorHandlerCount = (): number => handlerCount;

/**
 * Wrap an `on(globalEffectQueue, $effectError, …)` unsubscribe function so
 * the module-local handler counter tracks it.
 *
 * Two things keep the counter honest instead of drifting:
 *
 * - **The `released` guard.** eventize's own unsubscribe is idempotent — a
 *   second call leaves the subscription count unchanged (measured). Without
 *   a guard here, a handler unsubscribed twice would decrement the counter
 *   twice, silencing a handler that is still registered.
 * - **Decrement, then unsubscribe.** If `unsubscribe()` ever throws, the
 *   safer failure direction is an undercount: the next report falls through
 *   to the fallback channel (`onSignalizeError()`, then `console.error`) —
 *   loud, but visible. An overcount would let `emit()` run with zero
 *   listeners and swallow the error silently.
 *
 * `handlerCount++` happens in the body, not at the call site, so a throwing
 * `on()` never gets counted.
 *
 * **Known boundary, not fixed here.** `EffectErrorCallback` is a function
 * type, so every call through `onEffectError()` that `tsc` accepts wraps a
 * function and stays honest. eventize itself also accepts an *object*
 * listener and calls `obj[$effectError](...)` on it — reachable only by a
 * caller in plain JS (or one that casts past the type), e.g.
 * `onEffectError(someEffectImplInstance as any)`. If that object is later
 * an `EffectImpl` that gets destroyed, `EffectImpl#destroy()`'s own
 * `off(globalEffectQueue, this)` — unrelated to error handling, it detaches
 * that effect's other subscriptions on the same queue — removes the
 * `$effectError` subscription too, by listener identity, without ever
 * calling the unsubscribe this module wrapped. The queue subscription is
 * gone; `handlerCount` does not know it. Measured: counter at 1, queue
 * subscriptions for `$effectError` at 0, the next report calls `emit()`
 * against nobody and is silently dropped — no `console.error`, no
 * `onSignalizeError()` fallback, which a probe of the queue itself would
 * have got right. Closing this would mean
 * tracking removal by listener identity, which needs a hook eventize does
 * not expose; the type system already blocks every caller that stays
 * inside `tsc`.
 *
 * @internal
 */
export const trackEffectErrorHandler = (
  unsubscribe: () => void,
): (() => void) => {
  handlerCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    handlerCount--;
    unsubscribe();
  };
};
