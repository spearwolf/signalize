import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {batch, getCurrentBatch} from './batch.js';
import {beQuiet, clearBeQuiet, getBeQuietCount, isQuiet} from './be-quiet.js';
import {createSignal} from './create-signal.js';
import {EffectImpl} from './EffectImpl.js';
import {createEffect} from './effects.js';
import {getCurrentEffect, runWithinEffect} from './global-effect-stack.js';
import {hibernate} from './hibernate.js';
import {destroySignal} from './signal-core.js';

describe('hibernate', () => {
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

      try {
        expect(effectCallCount).toBe(1);

        batch(() => {
          setA(1);
          // Within batch, effect should not have been called yet
          expect(effectCallCount).toBe(1);

          // When hibernate is called, it flushes the current batch first
          // Then clears the batch context and executes the callback
          hibernate(() => {
            // The batch was flushed before hibernate callback, so effect already ran for setA(1)
            expect(effectCallCount).toBe(2);
            setA(2);
            // Since we're not in a batch anymore, effect runs immediately
            expect(effectCallCount).toBe(3);
          });

          // After hibernate, we're back in the batch context
          setA(3);
          // Effect still delayed because we're in the outer batch
          expect(effectCallCount).toBe(3);
        });

        // After batch completes, the final effect should run
        expect(effectCallCount).toBe(4);
        expect(a()).toBe(3);
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('does not interfere with batch when called outside batch', () => {
      const {get: a, set: setA} = createSignal(0);

      let effectCallCount = 0;
      const effect = createEffect(() => {
        effectCallCount++;
        a();
      });

      try {
        expect(effectCallCount).toBe(1);

        hibernate(() => {
          setA(1);
          // Without batch, effect runs immediately
          expect(effectCallCount).toBe(2);
        });

        expect(a()).toBe(1);
        expect(effectCallCount).toBe(2);
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('flushes batched effects before hibernate callback executes', () => {
      const {get: a, set: setA} = createSignal(0);
      const {get: b, set: setB} = createSignal(0);

      let effectCallCount = 0;
      const effectValues: number[] = [];
      const effect = createEffect(() => {
        effectCallCount++;
        effectValues.push(a());
      });

      try {
        expect(effectCallCount).toBe(1);
        expect(effectValues).toEqual([0]);

        batch(() => {
          setA(1);
          setA(2);
          setA(3);
          // All changes are batched, effect not yet called
          expect(effectCallCount).toBe(1);

          hibernate(() => {
            // Batch was flushed before callback - effect ran once for the latest value (3)
            expect(effectCallCount).toBe(2);
            expect(effectValues).toEqual([0, 3]);

            // Changes inside hibernate are immediate (no batch context)
            setB(100); // Different signal, no effect
            expect(effectCallCount).toBe(2);
          });

          // Back in batch context, batch is restored (but was flushed, so it's empty now)
          setA(4);
          expect(effectCallCount).toBe(2); // Still batched
        });

        // After batch completes, final effect runs
        expect(effectCallCount).toBe(3);
        expect(effectValues).toEqual([0, 3, 4]);
      } finally {
        effect.destroy();
        destroySignal(a, b);
      }
    });
  });

  describe('beQuiet context isolation', () => {
    it('clears beQuiet context within hibernate callback', () => {
      const {get: a} = createSignal(0);
      const {get: b, set: setB} = createSignal(0);

      const effect = createEffect(() => {
        setB(a() + 1);
      });

      try {
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
      } finally {
        effect.destroy();
        destroySignal(a, b);
      }
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

      // The assertions of this test live inside the callback, so the creation
      // belongs inside the try.
      let effect: ReturnType<typeof createEffect> | undefined;

      try {
        effect = createEffect(() => {
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
      } finally {
        effect?.destroy();
        destroySignal(a);
      }
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

      try {
        expect(effectCallCount).toBe(1);
        expect(c()).toBe(0);

        // Changing b should NOT trigger the effect
        setB(200);
        expect(effectCallCount).toBe(1);

        // Changing a should trigger the effect
        setA(1);
        expect(effectCallCount).toBe(2);
        expect(c()).toBe(1);
      } finally {
        effect.destroy();
        destroySignal(a, b, c);
      }
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

      try {
        expect(effectCallCount).toBe(1);

        batch(() => {
          setA(1);
          expect(effectCallCount).toBe(1);

          expect(() => {
            hibernate(() => {
              // The batch was flushed before hibernate callback, so effect already ran for setA(1)
              expect(effectCallCount).toBe(2);
              setA(2);
              expect(effectCallCount).toBe(3);
              throw new Error('test error');
            });
          }).toThrow('test error');

          // Back in batch context after exception
          setA(3);
          expect(effectCallCount).toBe(3);
        });

        // Batch runs after completing
        expect(effectCallCount).toBe(4);
        expect(a()).toBe(3);
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('restores effect stack when callback throws', () => {
      const {get: a} = createSignal(0);

      // Same as above: the assertions are inside the callback, so the
      // creation belongs inside the try.
      let effect: ReturnType<typeof createEffect> | undefined;

      try {
        effect = createEffect(() => {
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
      } finally {
        effect?.destroy();
        destroySignal(a);
      }
    });

    it('restores all three contexts when the flushed batch throws (ASYNC-001)', () => {
      // The flush used to sit *before* the `try`, so an effect that threw in
      // it skipped all three `restore*` calls. Two of the three repair
      // themselves on the way out (`batch()` resets `Batch.current`,
      // `runWithinEffect()` pops the stack) — the quiet counter does not, and
      // is left one below where it started, for the rest of the process.
      //
      // Not a single `expect()` runs inside the batch callback: an assertion
      // failure in there is thrown away by `Batch.run()` in `batch()`'s
      // `finally` (BUG-012, fixed in the same package). The observations are
      // recorded and asserted afterwards, where nothing can overwrite them.
      const {get: a, set: setA} = createSignal(0);
      let boomRuns = 0;
      const boom = createEffect(() => {
        if (a() > 0) {
          boomRuns++;
          throw new Error('effect boom');
        }
      });
      const host = new EffectImpl(() => {});

      const seen: Record<string, unknown> = {hibernateCallbackRan: false};
      let escaped: unknown;

      try {
        try {
          batch(() => {
            setA(1); // queues `boom`, which throws on the next flush

            beQuiet(() => {
              runWithinEffect(host, () => {
                seen.batchBefore = getCurrentBatch();
                seen.quietBefore = getBeQuietCount();
                seen.effectBefore = getCurrentEffect();

                try {
                  hibernate(() => {
                    seen.hibernateCallbackRan = true;
                  });
                } catch (err) {
                  seen.thrown = err;
                }

                seen.batchAfter = getCurrentBatch();
                seen.quietAfter = getBeQuietCount();
                seen.effectAfter = getCurrentEffect();

                return () => {};
              });
            });

            seen.quietAfterFrame = getBeQuietCount();
          });
        } catch (err) {
          escaped = err;
        }

        // preconditions: all three contexts were set when hibernate() was called
        expect(seen.batchBefore).toBeDefined();
        expect(seen.quietBefore).toBe(1);
        expect(seen.effectBefore).toBe(host);

        // the flush throws before the hibernate callback gets to run
        expect((seen.thrown as Error)?.message).toBe('effect boom');
        expect(seen.hibernateCallbackRan).toBe(false);

        // ASYNC-001: the three restores must have run anyway
        expect(seen.batchAfter, 'the batch context is back').toBe(
          seen.batchBefore,
        );
        expect(seen.quietAfter, 'the quiet frame is back').toBe(1);
        expect(seen.effectAfter, 'the effect stack is back').toBe(host);

        // and the quiet counter closes at zero instead of going negative
        expect(seen.quietAfterFrame, 'the quiet frame closed cleanly').toBe(0);

        // `flush()` empties the queue in a `finally` now, so the restored
        // batch has nothing left to recall: one write, one run, one report —
        // at the `hibernate()` caller, which is the frame that asked for the
        // flush. It used to leave `boom` in the queue (`delayedEffects.length
        // = 0` sat *after* the throwing `run()`), run its callback a second
        // time when the outer batch closed, and hand the same failure to a
        // second caller.
        expect(boomRuns, 'the failed flush took its queue with it').toBe(1);
        expect(
          escaped,
          'and nothing is left for the outer batch to rethrow',
        ).toBeUndefined();
      } finally {
        // The quiet counter is module state and no counter guard can see it:
        // without the fix this test leaves it at -1, and every later
        // `beQuiet()` in this file would then count 0 and report `isQuiet()`
        // as false. The test takes its own damage back.
        clearBeQuiet();
        host.destroy();
        boom.destroy();
        destroySignal(a);
      }
    });
  });

  describe('complex scenarios', () => {
    it('works correctly with all contexts combined', () => {
      const {get: a, set: setA} = createSignal(0);
      const {get: b, set: setB} = createSignal(0);
      const {get: c, set: setC} = createSignal(0);

      let effectCallCount = 0;
      let hibernateWasExecuted = false;

      // The hibernate() callback asserts, and it runs while createEffect() is
      // still autorunning — so the creation belongs inside the try, as in the
      // two effect-stack tests above.
      let effect: ReturnType<typeof createEffect> | undefined;

      try {
        effect = createEffect(() => {
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
      } finally {
        effect?.destroy();
        destroySignal(a, b, c);
      }
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

      try {
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
      } finally {
        outerEffect.destroy();
        // Cleanup all inner effects
        innerEffects.forEach((e) => {
          e.destroy();
        });
        destroySignal(a, b);
      }
    });
  });
});
