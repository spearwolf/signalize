import {EffectCallback, VoidCallback} from './types';

import {Effect} from './Effect';
import {getCurrentEffect} from './globalEffectStack';
import {$createEffect, globalEffectQueue} from './globalQueues';

// TODO createAsyncEffect() with trigger hook/function/signal: setTimeout, requestAnimationFrame, requestIdleCallback, IntersectionObserver, ResizeObserver, MutationObserver, etc.

// TODO createEffect() autorun: false
// TODO createEffect() function signature: [run, unsubscribe] = createEffect(..)

export function createEffect(callback: EffectCallback): VoidCallback {
  const effect = new Effect(callback);

  getCurrentEffect()?.addChild(effect);

  globalEffectQueue.emit($createEffect, effect);

  effect.run();

  return () => {
    effect.destroy();
  };
}

export const onCreateEffect = (
  callback: (effect: Effect) => void,
): (() => void) => globalEffectQueue.on($createEffect, callback);

export const getEffectsCount = (): number => Effect.count;
