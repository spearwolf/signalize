import {EffectCallback, VoidCallback} from './types';

import {Effect} from './Effect';
import {getCurrentEffect} from './globalEffectStack';
import {globalSignalQueue} from './globalQueues';

const EVENT_CREATE_EFFECT = Symbol('createEffect');

export function createEffect(callback: EffectCallback): VoidCallback {
  const effect = new Effect(callback);

  getCurrentEffect()?.addChild(effect);

  globalSignalQueue.emit(EVENT_CREATE_EFFECT, effect);

  effect.runFirstTime();

  return () => {
    effect.unsubscribe();
  };
}

export const onCreateEffect = (
  callback: (effect: Effect) => void,
): (() => void) => globalSignalQueue.on(EVENT_CREATE_EFFECT, callback);
