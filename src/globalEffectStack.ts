import {EffectCallback, VoidCallback} from './types';

import {Effect} from './Effect';

const globalEffectStack: Effect[] = [];

export const getCurrentEffect = (): Effect | undefined => {
  const len = globalEffectStack.length;
  return len > 0 ? globalEffectStack[len - 1] : undefined;
};

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
