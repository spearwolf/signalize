import {$createEffect, $destroyEffect} from './constants.js';
import {Effect} from './Effect.js';
import {globalEffectQueue} from './global-queues.js';

export const createEffect: typeof Effect.createEffect = (...args) =>
  Effect.createEffect(...args);

export const onCreateEffect = (...args: unknown[]) =>
  // @ts-ignore
  globalEffectQueue.on($createEffect, ...args);

export const onDestroyEffect = (...args: unknown[]) =>
  // @ts-ignore
  globalEffectQueue.on($destroyEffect, ...args);

export const getEffectsCount = (): number => Effect.count;
