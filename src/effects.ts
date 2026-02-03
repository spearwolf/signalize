import {on} from '@spearwolf/eventize';
import {$createEffect, $destroyEffect} from './constants.js';
import {EffectImpl} from './EffectImpl.js';
import {globalEffectQueue} from './global-queues.js';

/**
 * Create a reactive effect that automatically tracks signal dependencies
 * and re-runs when those signals change.
 *
 * By default, the effect runs immediately (autorun: true). Set autorun: false
 * to create a "static" effect that must be triggered manually via effect.run().
 *
 * @param callback - The function to run reactively
 * @param dependencies - Optional array of signals to explicitly depend on
 * @param options - Configuration options (autorun, priority, attach)
 * @returns An Effect object with run() and destroy() methods
 */
export const createEffect: typeof EffectImpl.createEffect = (...args) =>
  EffectImpl.createEffect(...args);

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
