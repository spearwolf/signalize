import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
import {batch} from './batch.js';
import {beQuiet, isQuiet} from './bequiet.js';
import {createSignal, destroySignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {getCurrentEffect} from './globalEffectStack.js';
import {hibernate} from './hibernate.js';

describe('hibernate', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
  });

  describe('basic functionality', () => {
    it('executes the callback and returns its result', () => {
      const result = hibernate(() => 42);
      expect(result).toBe(42);
    });

    it('executes the callback and returns a complex result', () => {
      const result = hibernate(() => ({foo: 'bar', count: 123}));
      expect(result).toEqual({foo: 'bar', count: 123});
    });
  });

  describe('batch context isolation', () => {
    it('clears batch context within hibernate callback', () => {
      const {get: a, set: setA} = createSignal(0);

      let effectCallCount = 0;
      const effect = createEffect(() => {
        effectCallCount++;
        a();
      });

      expect(effectCallCount).toBe(1);

      batch(() => {
        setA(1);
        // Within batch, effect should not have been called yet
        expect(effectCallCount).toBe(1);

        // Within hibernate, a new batch context is started
        // Changes to signals should trigger effects immediately after hibernate
        hibernate(() => {
          setA(2);
          // Since we're not in a batch anymore, effect runs immediately
          expect(effectCallCount).toBe(2);
        });

        // After hibernate, we're back in the batch context
        setA(3);
        // Effect still delayed because we're in the outer batch
        expect(effectCallCount).toBe(2);
      });

      // After batch completes, the final effect should run
      expect(effectCallCount).toBe(3);
      expect(a()).toBe(3);

      effect.destroy();
      destroySignal(a);
    });

    it('does not interfere with batch when called outside batch', () => {
      const {get: a, set: setA} = createSignal(0);

      let effectCallCount = 0;
      const effect = createEffect(() => {
        effectCallCount++;
        a();
      });

      expect(effectCallCount).toBe(1);

      hibernate(() => {
        setA(1);
        // Without batch, effect runs immediately
        expect(effectCallCount).toBe(2);
      });

      expect(a()).toBe(1);
      expect(effectCallCount).toBe(2);

      effect.destroy();
      destroySignal(a);
    });
  });

  describe('beQuiet context isolation', () => {
    it('clears beQuiet context within hibernate callback', () => {
      const {get: a} = createSignal(0);
      const {get: b, set: setB} = createSignal(0);

      const effect = createEffect(() => {
        setB(a() + 1);
      });

      expect(b()).toBe(1);

      beQuiet(() => {
        expect(isQuiet()).toBe(true);

        hibernate(() => {
          // Within hibernate, beQuiet is cleared
          expect(isQuiet()).toBe(false);
        });

        // After hibernate, beQuiet is restored
        expect(isQuiet()).toBe(true);
      });

      expect(isQuiet()).toBe(false);

      effect.destroy();
      destroySignal(a, b);
    });

    it('preserves nested beQuiet count after hibernate', () => {
      beQuiet(() => {
        beQuiet(() => {
          expect(isQuiet()).toBe(true);

          hibernate(() => {
            expect(isQuiet()).toBe(false);
          });

          expect(isQuiet()).toBe(true);
        });
        expect(isQuiet()).toBe(true);
      });
      expect(isQuiet()).toBe(false);
    });
  });

  describe('effect stack isolation', () => {
    it('clears effect stack within hibernate callback', () => {
      const {get: a} = createSignal(0);

      const effect = createEffect(() => {
        a();

        // Inside an effect, getCurrentEffect should return the effect
        expect(getCurrentEffect()).toBeDefined();

        hibernate(() => {
          // Within hibernate, effect stack is cleared
          expect(getCurrentEffect()).toBeUndefined();
        });

        // After hibernate, we're back in the effect context
        expect(getCurrentEffect()).toBeDefined();
      });

      effect.destroy();
      destroySignal(a);
    });

    it('does not allow signal reads inside hibernate to create effect dependencies', () => {
      const {get: a, set: setA} = createSignal(0);
      const {get: b, set: setB} = createSignal(100);
      const {get: c, set: setC} = createSignal(0);

      let effectCallCount = 0;
      const effect = createEffect(() => {
        effectCallCount++;
        setC(a());

        hibernate(() => {
          // Reading b inside hibernate should NOT create a dependency
          b();
        });
      });

      expect(effectCallCount).toBe(1);
      expect(c()).toBe(0);

      // Changing b should NOT trigger the effect
      setB(200);
      expect(effectCallCount).toBe(1);

      // Changing a should trigger the effect
      setA(1);
      expect(effectCallCount).toBe(2);
      expect(c()).toBe(1);

      effect.destroy();
      destroySignal(a, b, c);
    });
  });

  describe('nested hibernate calls', () => {
    it('supports nested hibernate calls', () => {
      let outerHibernateExecuted = false;
      let innerHibernateExecuted = false;

      batch(() => {
        hibernate(() => {
          outerHibernateExecuted = true;

          hibernate(() => {
            innerHibernateExecuted = true;
          });

          expect(innerHibernateExecuted).toBe(true);
        });

        expect(outerHibernateExecuted).toBe(true);
      });

      expect(outerHibernateExecuted).toBe(true);
      expect(innerHibernateExecuted).toBe(true);
    });

    it('properly restores all contexts after nested hibernate', () => {
      beQuiet(() => {
        expect(isQuiet()).toBe(true);

        hibernate(() => {
          expect(isQuiet()).toBe(false);

          beQuiet(() => {
            expect(isQuiet()).toBe(true);

            hibernate(() => {
              expect(isQuiet()).toBe(false);
            });

            expect(isQuiet()).toBe(true);
          });

          expect(isQuiet()).toBe(false);
        });

        expect(isQuiet()).toBe(true);
      });

      expect(isQuiet()).toBe(false);
    });
  });

  describe('exception handling', () => {
    it('restores context even when callback throws', () => {
      beQuiet(() => {
        expect(isQuiet()).toBe(true);

        expect(() => {
          hibernate(() => {
            expect(isQuiet()).toBe(false);
            throw new Error('test error');
          });
        }).toThrow('test error');

        // Context should be restored even after exception
        expect(isQuiet()).toBe(true);
      });

      expect(isQuiet()).toBe(false);
    });

    it('restores batch context when callback throws', () => {
      const {get: a, set: setA} = createSignal(0);

      let effectCallCount = 0;
      const effect = createEffect(() => {
        effectCallCount++;
        a();
      });

      expect(effectCallCount).toBe(1);

      batch(() => {
        setA(1);
        expect(effectCallCount).toBe(1);

        expect(() => {
          hibernate(() => {
            setA(2);
            expect(effectCallCount).toBe(2);
            throw new Error('test error');
          });
        }).toThrow('test error');

        // Back in batch context after exception
        setA(3);
        expect(effectCallCount).toBe(2);
      });

      // Batch runs after completing
      expect(effectCallCount).toBe(3);
      expect(a()).toBe(3);

      effect.destroy();
      destroySignal(a);
    });

    it('restores effect stack when callback throws', () => {
      const {get: a} = createSignal(0);

      const effect = createEffect(() => {
        a();
        const currentEffectBefore = getCurrentEffect();
        expect(currentEffectBefore).toBeDefined();

        expect(() => {
          hibernate(() => {
            expect(getCurrentEffect()).toBeUndefined();
            throw new Error('test error');
          });
        }).toThrow('test error');

        // Effect context should be restored
        expect(getCurrentEffect()).toBe(currentEffectBefore);
      });

      effect.destroy();
      destroySignal(a);
    });
  });

  describe('complex scenarios', () => {
    it('works correctly with all contexts combined', () => {
      const {get: a, set: setA} = createSignal(0);
      const {get: b, set: setB} = createSignal(0);
      const {get: c, set: setC} = createSignal(0);

      let effectCallCount = 0;
      let hibernateWasExecuted = false;

      const effect = createEffect(() => {
        effectCallCount++;
        a();

        hibernate(() => {
          hibernateWasExecuted = true;
          // All contexts should be cleared
          expect(isQuiet()).toBe(false);
          expect(getCurrentEffect()).toBeUndefined();

          // Changes should trigger effects immediately (no batch)
          setB(b() + 1);

          // Reading c should not create dependencies for outer effect
          c();
        });
      });

      expect(effectCallCount).toBe(1);
      expect(hibernateWasExecuted).toBe(true);
      expect(b()).toBe(1);

      // Changing c should NOT trigger the effect (read inside hibernate)
      setC(100);
      expect(effectCallCount).toBe(1);

      // Changing a should trigger the effect
      setA(1);
      expect(effectCallCount).toBe(2);
      expect(b()).toBe(2);

      effect.destroy();
      destroySignal(a, b, c);
    });

    it('createEffect inside hibernate creates independent effect', () => {
      const {get: a, set: setA} = createSignal(0);
      const {get: b, set: setB} = createSignal(0);

      let outerEffectCount = 0;
      let innerEffectCount = 0;
      const innerEffects: ReturnType<typeof createEffect>[] = [];

      const outerEffect = createEffect(() => {
        outerEffectCount++;
        a();

        hibernate(() => {
          const innerEffect = createEffect(() => {
            innerEffectCount++;
            b();
          });
          innerEffects.push(innerEffect);
        });
      });

      expect(outerEffectCount).toBe(1);
      expect(innerEffectCount).toBe(1);
      expect(innerEffects.length).toBe(1);

      // Changing a should trigger outer effect
      setA(1);
      expect(outerEffectCount).toBe(2);
      // A new inner effect is created each time outer runs
      expect(innerEffectCount).toBe(2);
      expect(innerEffects.length).toBe(2);

      // Changing b should trigger all inner effects (both are subscribed)
      setB(1);
      expect(outerEffectCount).toBe(2);
      // All inner effects respond to b change
      expect(innerEffectCount).toBe(4);

      outerEffect.destroy();
      // Cleanup all inner effects
      innerEffects.forEach((e) => {
        e.destroy();
      });
      destroySignal(a, b);
    });
  });
});
