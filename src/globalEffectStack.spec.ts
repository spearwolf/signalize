import {Effect} from './Effect';
import {getCurrentEffect, runWithinEffectContext} from './globalEffectStack';

const NOOP = () => {};

describe('globalEffectStack', () => {
  describe('getCurrentEffect()', () => {
    it('should return undefined if the method not called within an effect callback context', () => {
      expect(getCurrentEffect()).toBeUndefined();
      runWithinEffectContext(new Effect(NOOP), NOOP);
      expect(getCurrentEffect()).toBeUndefined();
    });

    it('should return the current effect if the method is called within an effect callback context', (done) => {
      const effect = new Effect(NOOP);
      runWithinEffectContext(effect, () => {
        expect(getCurrentEffect()).toBe(effect);

        const childEffect = new Effect(NOOP);
        runWithinEffectContext(childEffect, () => {
          expect(getCurrentEffect()).toBe(childEffect);
        });

        expect(getCurrentEffect()).toBe(effect);
        done();
      });
    });
  });
});
