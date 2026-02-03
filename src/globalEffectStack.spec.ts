import {getCurrentEffect, runWithinEffect} from './globalEffectStack.js';

import {EffectImpl} from './EffectImpl.js';

const NOOP = () => {};

describe('globalEffectStack', () => {
  describe('getCurrentEffect()', () => {
    it('should return undefined if the method not called within an effect callback', () => {
      expect(getCurrentEffect()).toBeUndefined();
      runWithinEffect(new EffectImpl(NOOP), NOOP);
      expect(getCurrentEffect()).toBeUndefined();
    });

    it('should return the current effect if the method is called within an effect callback', () => {
      const effect = new EffectImpl(NOOP);
      runWithinEffect(effect, () => {
        expect(getCurrentEffect()).toBe(effect);

        const childEffect = new EffectImpl(NOOP);
        runWithinEffect(childEffect, () => {
          expect(getCurrentEffect()).toBe(childEffect);
        });

        expect(getCurrentEffect()).toBe(effect);
      });
    });
  });
});
