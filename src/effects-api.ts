import {
  DestroyEffectCallback,
  EffectCallback,
  RunEffectCallback,
} from './types';

import {$createEffect, $destroyEffect} from './constants';
import {Effect, EffectParams} from './Effect';
import {globalEffectQueue} from './global-queues';

export const createEffect = (
  ...args:
    | [callback: EffectCallback]
    | [callback: EffectCallback, options: EffectParams]
    | [options: EffectParams, callback: EffectCallback]
): [RunEffectCallback, DestroyEffectCallback] => Effect.createEffect(...args);

export const onCreateEffect = (...args: unknown[]) =>
  // @ts-ignore
  globalEffectQueue.on($createEffect, ...args);

export const onDestroyEffect = (...args: unknown[]) =>
  // @ts-ignore
  globalEffectQueue.on($destroyEffect, ...args);

export const getEffectsCount = (): number => Effect.count;
