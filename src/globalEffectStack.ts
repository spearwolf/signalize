import type {EffectCallback, VoidCallback} from './types';

import {Effect} from './Effect';

const globalEffectStack: Effect[] = [];

export const getCurrentEffect = (): Effect | undefined =>
  globalEffectStack.at(-1);

export const runWithinEffect = (
  effect: Effect,
  callback: EffectCallback,
): VoidCallback => {
  globalEffectStack.push(effect);
  try {
    return callback() as VoidCallback;
  } finally {
    globalEffectStack.pop();
  }
};
