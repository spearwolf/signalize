import type {EffectCallback, VoidFunc} from './types.js';

import {EffectImpl} from './EffectImpl.js';

const globalEffectStack: EffectImpl[] = [];

export const getCurrentEffect = (): EffectImpl | undefined =>
  globalEffectStack.at(-1);

export const runWithinEffect = (
  effect: EffectImpl,
  callback: EffectCallback,
): VoidFunc => {
  globalEffectStack.push(effect);
  try {
    return callback() as VoidFunc;
  } finally {
    globalEffectStack.pop();
  }
};

export const getGlobalEffectStackSnapshot = (): EffectImpl[] =>
  globalEffectStack.slice();

export const clearGlobalEffectStack = (): void => {
  globalEffectStack.length = 0;
};

export const restoreGlobalEffectStack = (snapshot: EffectImpl[]): void => {
  globalEffectStack.length = 0;
  globalEffectStack.push(...snapshot);
};
