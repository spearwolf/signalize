import {EffectCallback, VoidCallback} from './types';

import {Effect} from './Effect';
import {getCurrentEffect} from './globalEffectStack';
import {$createEffect, globalEffectQueue} from './globalQueues';

export function createEffect(callback: EffectCallback): VoidCallback {
  const effect = new Effect(callback);

  getCurrentEffect()?.addChild(effect);

  globalEffectQueue.emit($createEffect, effect);

  effect.run();

  return () => {
    effect.unsubscribe();
  };
}

export const onCreateEffect = (
  callback: (effect: Effect) => void,
): (() => void) => globalEffectQueue.on($createEffect, callback);
