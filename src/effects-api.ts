import {on} from '@spearwolf/eventize';
import {$createEffect, $destroyEffect} from './constants.js';
import {EffectImpl} from './EffectImpl.js';
import {globalEffectQueue} from './global-queues.js';

export const createEffect: typeof EffectImpl.createEffect = (...args) =>
  EffectImpl.createEffect(...args);

// TODO remove from public API
export const onCreateEffect = (...args: unknown[]) =>
  // @ts-ignore
  on(globalEffectQueue, $createEffect, ...args);

// TODO remove from public API
export const onDestroyEffect = (...args: unknown[]) =>
  // @ts-ignore
  on(globalEffectQueue, $destroyEffect, ...args);

export const getEffectsCount = (): number => EffectImpl.count;
