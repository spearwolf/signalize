import {Effect} from './Effect';
import {getCurrentEffect, runWithinEffectContext} from './globalEffectStack';
import {EffectCallback} from './types';

export function createEffect(callback: EffectCallback): () => void {
  const effect = new Effect(callback);

  getCurrentEffect()?.addChild(effect);

  runWithinEffectContext(effect, callback);

  return () => {
    effect.unsubscribe();
  };
}
