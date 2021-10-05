import {getCurrentEffect, runWithinEffect} from './globalEffectStack';

import {Effect} from './Effect';

const NOOP = () => {};

describe('globalEffectStack', () => {
  describe('getCurrentEffect()', () => {
    it('should return undefined if the method not called within an effect callback', () => {
      expect(getCurrentEffect()).toBeUndefined();
      runWithinEffect(new Effect(NOOP), NOOP);
      expect(getCurrentEffect()).toBeUndefined();
    });

    it('should return the current effect if the method is called within an effect callback', (done) => {
      const effect = new Effect(NOOP);
      runWithinEffect(effect, () => {
        expect(getCurrentEffect()).toBe(effect);

        const childEffect = new Effect(NOOP);
        runWithinEffect(childEffect, () => {
          expect(getCurrentEffect()).toBe(childEffect);
        });

        expect(getCurrentEffect()).toBe(effect);
        done();
      });
    });
  });
});
