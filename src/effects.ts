import {on} from '@spearwolf/eventize';
import {$createEffect, $destroyEffect} from './constants.js';
import {EffectImpl} from './EffectImpl.js';
import {globalEffectQueue} from './global-queues.js';

export const createEffect: typeof EffectImpl.createEffect = (...args) =>
  EffectImpl.createEffect(...args);

export const onCreateEffect = (...args: unknown[]) =>
  // @ts-ignore
  on(globalEffectQueue, $createEffect, ...args);

export const onDestroyEffect = (...args: unknown[]) =>
  // @ts-ignore
  on(globalEffectQueue, $destroyEffect, ...args);

export const getEffectsCount = (): number => EffectImpl.count;
