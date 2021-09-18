import {Effect} from './Effect';
import {getCurrentEffect, runWithinEffect} from './globalEffectStack';
import {EffectCallback} from './types';

export function createEffect(callback: EffectCallback): () => void {
  const effect = new Effect(callback);

  getCurrentEffect()?.addChild(effect);

  runWithinEffect(effect, callback);

  return () => {
    effect.unsubscribe();
  };
}
