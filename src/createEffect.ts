import {EffectCallback, VoidCallback} from './types';

import {Effect} from './Effect';
import {getCurrentEffect} from './globalEffectStack';
import globalSignals from './globalSignals';

const EVENT_CREATE_EFFECT = Symbol('createEffect');

export function createEffect(callback: EffectCallback): VoidCallback {
  const effect = new Effect(callback);

  getCurrentEffect()?.addChild(effect);

  globalSignals.emit(EVENT_CREATE_EFFECT, effect);

  effect.run();

  return () => {
    effect.unsubscribe();
  };
}

export const onCreateEffect = (
  callback: (effect: Effect) => void,
): (() => void) => globalSignals.on(EVENT_CREATE_EFFECT, callback);
