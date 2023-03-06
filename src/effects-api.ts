import {
  DestroyEffectCallback,
  EffectCallback,
  RunEffectCallback,
} from './types';

import {$createEffect, $destroyEffect} from './constants';
import {Effect} from './Effect';
import {globalEffectQueue} from './global-queues';

// TODO createAsyncEffect() with trigger hook/function/signal: setTimeout, requestAnimationFrame, requestIdleCallback, IntersectionObserver, ResizeObserver, MutationObserver, etc.

// TODO createEffect() autorun: false

export const createEffect = (
  callback: EffectCallback,
): [RunEffectCallback, DestroyEffectCallback] => Effect.createEffect(callback);

export const onCreateEffect = (...args: unknown[]) =>
  // @ts-ignore
  globalEffectQueue.on($createEffect, ...args);

export const onDestroyEffect = (...args: unknown[]) =>
  // @ts-ignore
  globalEffectQueue.on($destroyEffect, ...args);

export const getEffectsCount = (): number => Effect.count;
