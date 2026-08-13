import {on} from '@spearwolf/eventize';
import {$createEffect, $destroyEffect, $effectError} from './constants.js';
import type {Effect} from './Effect.js';
import {EffectImpl} from './EffectImpl.js';
import {trackEffectErrorHandler} from './effect-error-handlers.js';
import {setCreateEffectHook} from './effect-hook.js';
import {globalEffectQueue} from './global-queues.js';
import type {EffectErrorCallback, FailingEffect} from './types.js';

/**
 * Create a reactive effect that automatically tracks signal dependencies
 * and re-runs when those signals change.
 *
 * By default, the effect runs immediately (autorun: true). Set autorun: false
 * to create a "static" effect that must be triggered manually via effect.run().
 *
 * If a callback writes to a signal it depends on, the effect re-enters
 * itself synchronously. The recursion depth is bounded by the global cap
 * (default 256); exceeding it throws instead of silently overflowing the
 * JS stack. Tune the cap via {@link setMaxEffectDepth} only if the
 * recursion is intentional — normally the cycle should be broken (e.g. by
 * guarding the write).
 *
 * A throw out of the very first run — the autorun this call performs itself —
 * is the one case in which an effect does not survive its own failure, and
 * one option decides it. Without `attach` the creation is taken back: the
 * effect is destroyed, nothing stays counted or subscribed, and the error
 * arrives here — that also holds where something else happened to be holding
 * the effect, such as the parent whose callback this call ran inside. With
 * `attach` it survives, keeps its dependencies and runs again on the next
 * change, exactly as after any later failing run. The error arrives here
 * either way. A rollback that fails on top of that (a throwing
 * `onDestroyEffect()` handler, a throwing cleanup) is reported next to the
 * original error as an `AggregateError`, never in its place.
 *
 * The second position takes either shape: the options object
 * (`createEffect(cb, {…})`) or the dependency array (`createEffect(cb,
 * [a, b])`), which is shorthand for `{dependencies: [a, b]}` and leaves the
 * options to a third position. The overloads on `EffectImpl.createEffect`
 * spell out the combinations; the one condition they add beyond shape is
 * that a `string`/`symbol` dependency requires `attach`, because such a
 * dependency is a name looked up in a group.
 *
 * @param callback - The function to run reactively
 * @returns An Effect object with run() and destroy() methods
 */
// Delegate instead of aliasing: an alias would read EffectImpl at module-eval
// time, which turns import order into a load-bearing detail.
export const createEffect: typeof EffectImpl.createEffect = (
  ...args: any[]
): Effect => (EffectImpl.createEffect as any)(...args);

/**
 * Subscribe to effect creation events. Called whenever a new effect is created.
 *
 * What arrives is the real instance behind the `Effect` wrapper, typed down
 * to the two members an observer may touch — its id and the option to tear
 * it down. Anything beyond that is implementation, and a handler that asks
 * for more is refused rather than served.
 *
 * @param callback - Receives the created effect as a {@link FailingEffect}
 * @param priority - Optional eventize priority; higher runs first
 * @returns Unsubscribe function
 */
export const onCreateEffect = (
  callback: (effect: FailingEffect) => void,
  priority?: number,
): (() => void) =>
  priority == null
    ? on(globalEffectQueue, $createEffect, callback)
    : on(globalEffectQueue, $createEffect, priority, callback);

/**
 * Subscribe to effect destruction events. Called whenever an effect is destroyed.
 *
 * As with {@link onCreateEffect}, what arrives is the real instance typed
 * down to the two members an observer may touch. It is already destroyed by
 * the time the handler sees it — `run()` on it does nothing.
 *
 * @param callback - Receives the destroyed effect as a {@link FailingEffect}
 * @param priority - Optional eventize priority; higher runs first
 * @returns Unsubscribe function
 */
export const onDestroyEffect = (
  callback: (effect: FailingEffect) => void,
  priority?: number,
): (() => void) =>
  priority == null
    ? on(globalEffectQueue, $destroyEffect, callback)
    : on(globalEffectQueue, $destroyEffect, priority, callback);

/**
 * Subscribe to errors that an effect could not throw at anyone.
 *
 * Failures arrive here when there is no legitimate caller left to throw at —
 * most often because the call stack that triggered them is long gone: the
 * promise returned by an `async` effect callback rejected, or the promise
 * returned by an `async` cleanup callback did. A synchronous throw normally
 * keeps propagating to whoever triggered the run instead — except a stale
 * cleanup (one whose run was superseded, or whose effect is already
 * destroyed by the time it runs): that has no such caller left to throw at
 * even with a full stack still present, so it lands here too, with
 * `phase: 'cleanup'`.
 *
 * As long as no handler is registered, such an error falls through to the
 * general diagnostics channel — `onSignalizeError()` with `source: 'effect'`
 * — and from there, with nobody listening at all, to `console.error` with the
 * effect id. It never becomes an unhandled rejection, which since Node 15
 * would terminate the process. Registering a handler here takes precedence
 * over both, so no handler ever sees the same failure twice; what the general
 * channel lacks is the structure — `effect`, `effectId` and `phase` are
 * fields only here.
 *
 * **The handler must be synchronous or catch its own errors.** Nothing
 * awaits it, so a rejected promise coming out of it is an unhandled
 * rejection again — the very thing this channel exists to prevent. Reporting
 * to a remote service is the obvious use case and the obvious trap:
 *
 * ```js
 * onEffectError(async ({error}) => {          // ✗ a failing send() crashes
 *   await send(error);                        //   the process
 * });
 *
 * const unsubscribe = onEffectError(({error, effect, phase}) => {
 *   void send(error, {effect: effect.id, phase}).catch(ignore);   // ✓
 * });
 * ```
 *
 * A handler that throws *synchronously* is caught: its failure goes to
 * `console.error`, and the original error takes the fallback route above —
 * `onSignalizeError()`, then the console. But eventize stops the dispatch at
 * that point, so handlers registered with a lower priority never see the
 * event — keep handlers total, and give the one that must not be missed the
 * highest priority.
 *
 * @param callback - Receives one {@link EffectErrorPayload} per failure
 * @param priority - Optional eventize priority; higher runs first
 * @returns Unsubscribe function
 */
export const onEffectError = (
  callback: EffectErrorCallback,
  priority?: number,
): (() => void) =>
  trackEffectErrorHandler(
    priority == null
      ? on(globalEffectQueue, $effectError, callback)
      : on(globalEffectQueue, $effectError, priority, callback),
  );

/**
 * Raise or lower the re-entrancy cap of an effect run.
 *
 * An effect whose callback synchronously writes a signal it depends on
 * re-enters its own run. Beyond `n` levels the run throws a descriptive
 * `Error` naming the effect id and the limit, instead of dying in a native
 * stack overflow. The default is 256 — well above realistic fixpoint
 * iterations, well below the JS stack limit on common engines.
 *
 * The cap is global and applies from the next run on; it is not per effect.
 * Raise it only where the recursion is intentional — the usual repair is to
 * break the cycle.
 *
 * @param n - The new cap: a finite integer >= 1
 * @throws If `n` is not a finite integer >= 1
 */
export const setMaxEffectDepth = (n: number): void => {
  // A new function may be loud about a caller's mistake without breaking
  // anyone: `0` would make every run throw, `Infinity` would remove the very
  // cap this function administers. `Number.isInteger` settles NaN, Infinity
  // and fractions in one check.
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(
      `[signalize] setMaxEffectDepth: expected a finite integer >= 1, got ${String(n)}`,
    );
  }
  EffectImpl.maxDepth = n;
};

/**
 * The current re-entrancy cap of an effect run. See {@link setMaxEffectDepth}.
 */
export const getMaxEffectDepth = (): number => EffectImpl.maxDepth;

/**
 * Get the current count of active (non-destroyed) effects.
 * Useful for debugging and testing to detect effect leaks.
 * @returns The number of active effects
 */
export const getEffectsCount = (): number => EffectImpl.count;

// Fills the placeholder in `effect-hook.ts`, which is how `Signal.onChange()`
// and the deprecated `signalReader(callback)` reach `createEffect` without
// importing this module — an import that would drag `EffectImpl`,
// `SignalGroup` and `batch` into every bundle that only wanted `createSignal`.
// Load-bearing: without this line `requireCreateEffect()` throws. It belongs
// here, in the one module that knows `createEffect` without being imported for
// it. See docs/architecture.md, "The effect subsystem is reachable through a
// placeholder, not an import".
setCreateEffectHook(createEffect);
