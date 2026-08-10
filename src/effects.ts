import {on} from '@spearwolf/eventize';
import {$createEffect, $destroyEffect, $effectError} from './constants.js';
import type {Effect} from './Effect.js';
import {EffectImpl} from './EffectImpl.js';
import {globalEffectQueue} from './global-queues.js';
import type {EffectErrorCallback} from './types.js';

/**
 * Create a reactive effect that automatically tracks signal dependencies
 * and re-runs when those signals change.
 *
 * By default, the effect runs immediately (autorun: true). Set autorun: false
 * to create a "static" effect that must be triggered manually via effect.run().
 *
 * If a callback writes to a signal it depends on, the effect re-enters
 * itself synchronously. The recursion depth is bounded by
 * `EffectImpl.maxDepth` (default 256); exceeding it throws instead of
 * silently overflowing the JS stack. Tune the cap via
 * `EffectImpl.maxDepth = N` only if the recursion is intentional —
 * normally the cycle should be broken (e.g. by guarding the write).
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
 * @param callback - The function to run reactively
 * @param dependencies - Optional array of signals to explicitly depend on
 * @param options - Configuration options (autorun, priority, attach)
 * @returns An Effect object with run() and destroy() methods
 */
// Delegate instead of aliasing: an alias would read EffectImpl at module-eval
// time, which turns import order into a load-bearing detail.
export const createEffect: typeof EffectImpl.createEffect = (
  ...args: any[]
): Effect => (EffectImpl.createEffect as any)(...args);

/**
 * Subscribe to effect creation events. Called whenever a new effect is created.
 * @param args - Event handler arguments (callback and optional priority)
 * @returns Unsubscribe function
 */
export const onCreateEffect = (...args: unknown[]) =>
  // @ts-ignore
  on(globalEffectQueue, $createEffect, ...args);

/**
 * Subscribe to effect destruction events. Called whenever an effect is destroyed.
 * @param args - Event handler arguments (callback and optional priority)
 * @returns Unsubscribe function
 */
export const onDestroyEffect = (...args: unknown[]) =>
  // @ts-ignore
  on(globalEffectQueue, $destroyEffect, ...args);

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
 * As long as no handler is registered, such an error is written to
 * `console.error` with the effect id — it never becomes an unhandled
 * rejection, which since Node 15 would terminate the process. Registering a
 * handler replaces that log.
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
 * A handler that throws *synchronously* is caught: both its failure and the
 * original error go to `console.error`. But eventize stops the dispatch at
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
  priority == null
    ? on(globalEffectQueue, $effectError, callback)
    : on(globalEffectQueue, $effectError, priority, callback);

/**
 * Get the current count of active (non-destroyed) effects.
 * Useful for debugging and testing to detect effect leaks.
 * @returns The number of active effects
 */
export const getEffectsCount = (): number => EffectImpl.count;
