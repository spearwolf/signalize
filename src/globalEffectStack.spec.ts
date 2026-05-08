import {assertEffectsCount} from './assert-helpers.js';
import {EffectImpl} from './EffectImpl.js';
import {getCurrentEffect, runWithinEffect} from './globalEffectStack.js';

const NOOP = () => {};

describe('globalEffectStack', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
  });

  describe('getCurrentEffect()', () => {
    it('should return undefined if the method not called within an effect callback', () => {
      expect(getCurrentEffect()).toBeUndefined();
      const effect = new EffectImpl(NOOP);
      runWithinEffect(effect, NOOP);
      expect(getCurrentEffect()).toBeUndefined();
      effect.destroy();
    });

    it('should return the current effect if the method is called within an effect callback', () => {
      const effect = new EffectImpl(NOOP);
      const childEffect = new EffectImpl(NOOP);
      runWithinEffect(effect, () => {
        expect(getCurrentEffect()).toBe(effect);

        runWithinEffect(childEffect, () => {
          expect(getCurrentEffect()).toBe(childEffect);
        });

        expect(getCurrentEffect()).toBe(effect);
      });
      childEffect.destroy();
      effect.destroy();
    });
  });
});
