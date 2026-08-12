import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {EffectImpl} from './EffectImpl.js';
import {getCurrentEffect, runWithinEffect} from './global-effect-stack.js';

const NOOP = () => {};

describe('globalEffectStack', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  describe('getCurrentEffect()', () => {
    it('should return undefined if the method not called within an effect callback', () => {
      expect(getCurrentEffect()).toBeUndefined();
      const effect = new EffectImpl(NOOP);
      try {
        runWithinEffect(effect, NOOP);
        expect(getCurrentEffect()).toBeUndefined();
      } finally {
        effect.destroy();
      }
    });

    it('should return the current effect if the method is called within an effect callback', () => {
      const effect = new EffectImpl(NOOP);
      const childEffect = new EffectImpl(NOOP);
      try {
        runWithinEffect(effect, () => {
          expect(getCurrentEffect()).toBe(effect);

          runWithinEffect(childEffect, () => {
            expect(getCurrentEffect()).toBe(childEffect);
          });

          expect(getCurrentEffect()).toBe(effect);
        });
      } finally {
        childEffect.destroy();
        effect.destroy();
      }
    });
  });

  describe('runWithinEffect()', () => {
    it('pops the effect when the callback throws (TEST-016)', () => {
      // The stack is module state. An effect left on it after a throwing
      // callback is picked up by the next top-level signal read, which then
      // subscribes a corpse. Drop the `finally` in
      // `src/global-effect-stack.ts` and this test is one of the two that
      // notice.
      const effect = new EffectImpl(NOOP);

      try {
        expect(() =>
          runWithinEffect(effect, () => {
            throw new Error('boom');
          }),
        ).toThrow('boom');

        expect(
          getCurrentEffect(),
          'the throwing effect left the stack on the way out',
        ).toBeUndefined();
      } finally {
        effect.destroy();
      }
    });

    it('restores the enclosing effect when a nested callback throws (TEST-016)', () => {
      // Not the same claim as above: this one pins the *restore*, not the
      // empty stack. A nested effect that throws must hand the frame back
      // to its parent, which is what nested effects rely on.
      const outer = new EffectImpl(NOOP);
      const inner = new EffectImpl(NOOP);

      try {
        runWithinEffect(outer, () => {
          expect(() =>
            runWithinEffect(inner, () => {
              throw new Error('boom');
            }),
          ).toThrow('boom');

          expect(
            getCurrentEffect(),
            'the enclosing effect is current again',
          ).toBe(outer);
        });

        expect(getCurrentEffect()).toBeUndefined();
      } finally {
        inner.destroy();
        outer.destroy();
      }
    });
  });
});
