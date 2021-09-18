import {Effect} from './Effect';
import {getCurrentEffect} from './globalEffectStack';
import {EffectCallback, VoidCallback} from './types';

export function createEffect(callback: EffectCallback): VoidCallback {
  const effect = new Effect(callback);

  getCurrentEffect()?.addChild(effect);

  effect.run();

  return () => {
    effect.unsubscribe();
  };
}
