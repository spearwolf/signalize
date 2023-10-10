import type {
  DestroyEffectCallback,
  EffectCallback,
  RunEffectCallback,
} from './types.js';

import {$createEffect, $destroyEffect} from './constants.js';
import {Effect, EffectParams} from './Effect.js';
import {globalEffectQueue} from './global-queues.js';

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
