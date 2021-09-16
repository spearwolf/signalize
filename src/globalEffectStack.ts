import {Effect} from './Effect';
import {EffectCallback} from './types';

const globalEffectStack: Effect[] = [];
let hasCurrentEffect = false;

export const getCurrentEffect = (): Effect | undefined => {
  const len = globalEffectStack.length;
  return hasCurrentEffect && len > 0 ? globalEffectStack[len - 1] : undefined;
};

export const runWithinEffectContext = (
  effect: Effect,
  callback: EffectCallback,
): void => {
  const hasCurrentEffectBefore = hasCurrentEffect;
  hasCurrentEffect = true;
  globalEffectStack.push(effect);
  callback();
  globalEffectStack.pop();
  hasCurrentEffect = hasCurrentEffectBefore;
};
