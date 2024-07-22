import {on} from '@spearwolf/eventize';
import {$createEffect, $destroyEffect} from './constants.js';
import {Effect} from './Effect.js';
import {globalEffectQueue} from './global-queues.js';

export const createEffect: typeof Effect.createEffect = (...args) =>
  Effect.createEffect(...args);

// TODO remove from public API
export const onCreateEffect = (...args: unknown[]) =>
  // @ts-ignore
  on(globalEffectQueue, $createEffect, ...args);

// TODO remove from public API
export const onDestroyEffect = (...args: unknown[]) =>
  // @ts-ignore
  on(globalEffectQueue, $destroyEffect, ...args);

export const getEffectsCount = (): number => Effect.count;
