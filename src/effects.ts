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
 * By default the effect runs immediately (`autorun: true`), unless static
 * `dependencies` are given — those skip the first run regardless. With
 * `{autorun: false}` it also stays idle until `effect.run()` is called.
 *
 * If a callback writes to a signal it depends on, the effect re-enters
 * itself synchronously; the recursion depth is bounded by the global cap
 * (default 256), and exceeding it throws. See {@link setMaxEffectDepth}.
 *
 * A throw out of the very first run — the autorun this call performs itself
 * — is the one case in which an effect does not survive its own failure,
 * and `attach` decides it: without it the creation is taken back and the
 * effect is destroyed, nothing stays counted or subscribed; with it the
 * effect survives, keeps its dependencies, and runs again on the next
 * change. Either way the error arrives here.
 *
 * The second position takes either shape — the options object
 * (`createEffect(cb, {…})`) or the dependency array (`createEffect(cb,
 * [a, b])`, shorthand for `{dependencies: [a, b]}`) — and a
 * `string`/`symbol` dependency in either shape requires `attach`, because
 * such a dependency is a name looked up in a group.
 *
 * `docs/api.md`, "Effects" → "createEffect(callback, options?)"
 */
// Delegate instead of aliasing: an alias would read EffectImpl at module-eval
// time, which turns import order into a load-bearing detail.
export const createEffect: typeof EffectImpl.createEffect = (
  ...args: any[]
): Effect => (EffectImpl.createEffect as any)(...args);

/**
 * Subscribe to effect creation events.
 *
 * The real instance behind the `Effect` wrapper arrives, typed down to
 * `{id, destroy()}` — a handler asking for more does not compile.
 *
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
 * Subscribe to effect destruction events.
 *
 * As with {@link onCreateEffect}, the real instance arrives, typed down to
 * `{id, destroy()}`. It is already destroyed by the time the handler sees
 * it — `run()` on it does nothing.
 *
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
 * Failures land here when there is no legitimate caller left to throw at: an
 * `async` effect callback or cleanup that rejected, or a stale synchronous
 * cleanup — one whose run was superseded, or whose effect is already
 * destroyed by the time it runs — reported with `phase: 'cleanup'`. Every
 * other synchronous throw keeps propagating to whoever triggered the run.
 *
 * As long as no handler is registered, the failure falls through to
 * `onSignalizeError()` with `source: 'effect'`, then to `console.error`
 * with the effect id.
 *
 * **The handler must be synchronous or catch its own errors.** Nothing
 * awaits it, so a rejected promise coming out of it is an unhandled
 * rejection again — the very thing this channel exists to prevent.
 * Reporting to a remote service is the obvious use case and the obvious
 * trap:
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
 * A handler that throws synchronously aborts the dispatch: handlers
 * registered with a lower priority never see the event. Keep handlers
 * total, and give the one that must not be missed the highest priority.
 *
 * `docs/api.md`, "Effects" → "onEffectError(cb, priority?): () => void"
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
 * re-enters its own run; beyond `n` levels the run throws a descriptive
 * `Error` naming the effect id and the limit. The default is 256.
 *
 * The cap is global and applies from the next run on, not per effect.
 *
 * `docs/recipes.md`, "Recursion guard"
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
 * The current count of active (non-destroyed) effects — useful for
 * detecting effect leaks in tests.
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
