import {on} from '@spearwolf/eventize';
import {$createEffect, $destroyEffect} from './constants.js';
import type {Effect} from './Effect.js';
import {EffectImpl} from './EffectImpl.js';
import {globalEffectQueue} from './global-queues.js';

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
 * Get the current count of active (non-destroyed) effects.
 * Useful for debugging and testing to detect effect leaks.
 * @returns The number of active effects
 */
export const getEffectsCount = (): number => EffectImpl.count;
