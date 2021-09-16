import {Effect} from './Effect';
import {EffectCallback} from './types';

const globalEffectStack: Effect[] = [];

export const getCurrentEffect = (): Effect | undefined => {
  const len = globalEffectStack.length;
  return len > 0 ? globalEffectStack[len - 1] : undefined;
};

export const runWithinEffectContext = (
  effect: Effect,
  callback: EffectCallback,
): void => {
  globalEffectStack.push(effect);
  callback();
  globalEffectStack.pop();
};
