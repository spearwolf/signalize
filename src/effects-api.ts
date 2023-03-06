import {EffectCallback, VoidCallback} from './types';

import {$createEffect, $destroyEffect} from './constants';
import {Effect} from './Effect';
import {globalEffectQueue} from './global-queues';

// TODO createAsyncEffect() with trigger hook/function/signal: setTimeout, requestAnimationFrame, requestIdleCallback, IntersectionObserver, ResizeObserver, MutationObserver, etc.

// TODO createEffect() autorun: false
// TODO createEffect() function signature: [run, unsubscribe] = createEffect(..)

export const createEffect = (callback: EffectCallback): VoidCallback =>
  Effect.createEffect(callback);

export const onCreateEffect = (...args: unknown[]) =>
  // @ts-ignore
  globalEffectQueue.on($createEffect, ...args);

export const onDestroyEffect = (...args: unknown[]) =>
  // @ts-ignore
  globalEffectQueue.on($destroyEffect, ...args);

export const getEffectsCount = (): number => Effect.count;
