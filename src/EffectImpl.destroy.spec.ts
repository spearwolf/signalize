import {
  getSubscribedEventNames,
  getSubscriptionCount,
  off,
  on,
  once,
} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {$effect, DESTROY} from './constants.js';
import {createSignal} from './create-signal.js';
import type {Effect} from './Effect.js';
import type {EffectImpl} from './EffectImpl.js';
import {
  createEffect,
  getEffectsCount,
  onCreateEffect,
  onDestroyEffect,
} from './effects.js';
import {
  globalDestroySignalQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './global-queues.js';
import {destroySignal, signalImpl} from './signal-core.js';

describe('EffectImpl.destroy() teardown order', () => {
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

  it('a cleanup that writes to a dependency does not trigger another run (MEM-007)', () => {
    const signalSubscriptions = getSubscriptionCount(globalSignalQueue);
    const effectSubscriptions = getSubscriptionCount(globalEffectQueue);
    const destroySubscriptions = getSubscriptionCount(globalDestroySignalQueue);

    const {get: a, set: setA} = createSignal(0);

    const log: string[] = [];

    const effect = createEffect(() => {
      const val = a();
      log.push(`run:${val}`);
      return () => {
        log.push(`cleanup:${val}`);
        // A cleanup that resets state it depends on is an everyday pattern.
        setA(99);
      };
    });

    try {
      expect(log).toEqual(['run:0']);

      effect.destroy();

      // No re-entrant run, hence no cleanup that could never be called.
      expect(log).toEqual(['run:0', 'cleanup:0']);

      // The effect is fully detached: later writes reach nobody.
      setA(7);
      expect(log).toEqual(['run:0', 'cleanup:0']);

      expect(getEffectsCount()).toBe(0);

      destroySignal(a);

      expect(getSubscriptionCount(globalSignalQueue)).toBe(signalSubscriptions);
      expect(getSubscriptionCount(globalEffectQueue)).toBe(effectSubscriptions);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroySubscriptions,
      );
    } finally {
      effect.destroy();
      destroySignal(a);
    }
  });

  it('an onDestroyEffect handler sees an effect that no longer runs (BUG-008)', () => {
    const {get: a} = createSignal(1);

    let runCount = 0;

    // autorun:false keeps shouldRun true, so run() is only blocked by the
    // destroyed flag — exactly what this test is about.
    const effect = createEffect(
      () => {
        a();
        ++runCount;
      },
      {autorun: false},
    );

    let unsubscribe: () => void;

    try {
      expect(runCount).toBe(0);

      const seen: EffectImpl[] = [];

      unsubscribe = onDestroyEffect((effect) => {
        const impl = effect as EffectImpl;
        seen.push(impl);
        impl.run();
      });

      effect.destroy();
      unsubscribe();

      expect(seen).toHaveLength(1);
      expect(runCount).toBe(0);
    } finally {
      unsubscribe?.();
      effect.destroy();
      destroySignal(a);
    }
  });

  it('destroy() re-entered from the cleanup decrements the effect counter exactly once', () => {
    const {get: a} = createSignal(1);

    let impl: EffectImpl;
    let cleanupCalls = 0;

    const effect = createEffect(() => {
      a();
      return () => {
        ++cleanupCalls;
        impl.destroy();
      };
    });

    impl = effect[$effect];

    try {
      expect(getEffectsCount()).toBe(1);

      impl.destroy();

      expect(cleanupCalls).toBe(1);
      expect(getEffectsCount()).toBe(0);
    } finally {
      effect.destroy();
      destroySignal(a);
    }
  });

  it('a DESTROY listener on the effect itself sees an effect that no longer runs', () => {
    const {get: a} = createSignal(1);

    let runCount = 0;

    const effect = createEffect(
      () => {
        a();
        ++runCount;
      },
      {autorun: false},
    );

    try {
      const impl = effect[$effect];

      let seen: EffectImpl | undefined;

      once(impl, DESTROY, (destroyed: EffectImpl) => {
        seen = destroyed;
        destroyed.run();
      });

      impl.destroy();

      expect(seen).toBe(impl);
      expect(runCount).toBe(0);
    } finally {
      effect.destroy();
      destroySignal(a);
    }
  });

  it('destroy() re-entered from an onDestroyEffect handler decrements the effect counter exactly once', () => {
    const {get: a} = createSignal(1);

    const effect = createEffect(() => {
      a();
    });

    const impl = effect[$effect];

    let handlerCalls = 0;

    const unsubscribe = onDestroyEffect((destroyed) => {
      ++handlerCalls;
      destroyed.destroy();
    });

    try {
      impl.destroy();
      unsubscribe();

      // The re-entrant destroy() is a no-op, so it emits no second event.
      expect(handlerCalls).toBe(1);
      expect(getEffectsCount()).toBe(0);
    } finally {
      unsubscribe();
      effect.destroy();
      destroySignal(a);
    }
  });

  it('a throwing cleanup still tears the effect down completely', () => {
    const signalSubscriptions = getSubscriptionCount(globalSignalQueue);
    const effectSubscriptions = getSubscriptionCount(globalEffectQueue);
    const destroySubscriptions = getSubscriptionCount(globalDestroySignalQueue);

    const {get: a} = createSignal(0);
    const {get: b, set: setB} = createSignal(0);

    let childRuns = 0;

    const effect = createEffect(() => {
      a();

      createEffect(() => {
        b();
        ++childRuns;
      });

      return () => {
        throw new Error('cleanup boom');
      };
    });

    try {
      expect(getEffectsCount()).toBe(2);
      expect(childRuns).toBe(1);

      // The error reaches the caller — it is not swallowed.
      expect(() => effect.destroy()).toThrow('cleanup boom');

      // ...and the teardown completed anyway.
      expect(getEffectsCount()).toBe(0);

      setB(1);
      expect(childRuns).toBe(1);

      destroySignal(a, b);

      expect(getSubscriptionCount(globalSignalQueue)).toBe(signalSubscriptions);
      expect(getSubscriptionCount(globalEffectQueue)).toBe(effectSubscriptions);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroySubscriptions,
      );
    } finally {
      // The cleanup throws by design, and destroy() re-raises it. Left
      // unguarded here it would replace the failure the test is reporting
      // (rule (d)) — and swallow destroySignal() with it.
      try {
        effect.destroy();
      } catch {
        // already reported by the assertion above, or irrelevant
      }
      destroySignal(a, b);
    }
  });

  it('a throwing child cleanup does not orphan its siblings', () => {
    const signalSubscriptions = getSubscriptionCount(globalSignalQueue);
    const effectSubscriptions = getSubscriptionCount(globalEffectQueue);
    const destroySubscriptions = getSubscriptionCount(globalDestroySignalQueue);

    const {get: a} = createSignal(0);
    const {get: b, set: setB} = createSignal(0);

    const runs = [0, 0, 0];

    const effect = createEffect(() => {
      a();

      for (const slot of [0, 1, 2]) {
        createEffect(() => {
          b();
          runs[slot] += 1;
          return () => {
            // Only the first sibling explodes — the other two must still die.
            if (slot === 0) {
              throw new Error('child boom');
            }
          };
        });
      }
    });

    try {
      expect(getEffectsCount()).toBe(4);
      expect(runs).toEqual([1, 1, 1]);

      expect(() => effect.destroy()).toThrow('child boom');

      expect(getEffectsCount()).toBe(0);

      // No zombie: a write reaches none of the siblings.
      setB(1);
      expect(runs).toEqual([1, 1, 1]);

      destroySignal(a, b);

      expect(getSubscriptionCount(globalSignalQueue)).toBe(signalSubscriptions);
      expect(getSubscriptionCount(globalEffectQueue)).toBe(effectSubscriptions);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroySubscriptions,
      );
    } finally {
      try {
        effect.destroy();
      } catch {
        // see above: a throwing cleanup must not eat the real failure
      }
      destroySignal(a, b);
    }
  });

  it('several throwing child cleanups are bundled into an AggregateError', () => {
    const {get: a} = createSignal(0);
    const {get: b} = createSignal(0);

    const effect = createEffect(() => {
      a();

      for (const name of ['one', 'two', 'three']) {
        createEffect(() => {
          b();
          return () => {
            if (name !== 'two') {
              throw new Error(`child ${name} boom`);
            }
          };
        });
      }
    });

    try {
      expect(getEffectsCount()).toBe(4);

      let caught: unknown;
      try {
        effect.destroy();
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect(
        (caught as AggregateError).errors.map((err: Error) => err.message),
      ).toEqual(['child one boom', 'child three boom']);

      expect(getEffectsCount()).toBe(0);
    } finally {
      try {
        effect.destroy();
      } catch {
        // see above: a throwing cleanup must not eat the real failure
      }
      destroySignal(a, b);
    }
  });

  it('a parent cleanup and a child cleanup that both throw are reported together', () => {
    const {get: a} = createSignal(0);
    const {get: b} = createSignal(0);

    const effect = createEffect(() => {
      a();

      createEffect(() => {
        b();
        return () => {
          throw new Error('child boom');
        };
      });

      return () => {
        throw new Error('parent boom');
      };
    });

    try {
      expect(getEffectsCount()).toBe(2);

      let caught: unknown;
      try {
        effect.destroy();
      } catch (err) {
        caught = err;
      }

      // The parent error must not be swallowed by the child error.
      expect(caught).toBeInstanceOf(AggregateError);
      expect(
        (caught as AggregateError).errors.map((err: Error) => err.message),
      ).toEqual(['parent boom', 'child boom']);

      expect(getEffectsCount()).toBe(0);
    } finally {
      try {
        effect.destroy();
      } catch {
        // see above: a throwing cleanup must not eat the real failure
      }
      destroySignal(a, b);
    }
  });

  it('an effect that destroys itself mid-callback stops tracking (MEM-003)', () => {
    const signalSubscriptions = getSubscriptionCount(globalSignalQueue);
    const destroySubscriptions = getSubscriptionCount(globalDestroySignalQueue);

    const {get: a} = createSignal(1);
    const {get: b, set: setB} = createSignal(2);

    let runs = 0;
    let effect: Effect;

    // autorun:false, so that `effect` is already assigned when the callback runs.
    effect = createEffect(
      () => {
        a();
        ++runs;
        effect.destroy();
        // The rest of the callback keeps running — the dead effect is still
        // on the global effect stack.
        b();
      },
      {autorun: false},
    );

    try {
      effect.run();

      expect(runs).toBe(1);
      expect(getEffectsCount()).toBe(0);

      // No subscription that nobody can unsubscribe any more.
      expect(getSubscriptionCount(globalSignalQueue)).toBe(signalSubscriptions);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroySubscriptions,
      );

      setB(3);
      expect(runs).toBe(1);
    } finally {
      effect.destroy();
      destroySignal(a, b);
    }
  });

  it('an effect destroyed while it is being created never saves its static deps (MEM-003)', () => {
    const signalSubscriptions = getSubscriptionCount(globalSignalQueue);
    const destroySubscriptions = getSubscriptionCount(globalDestroySignalQueue);

    const {get: c} = createSignal(3);

    let runs = 0;

    const unsubscribe = onCreateEffect((impl) => {
      impl.destroy();
    });
    try {
      createEffect(() => {
        ++runs;
        c();
      }, [c]);

      expect(runs).toBe(0);
      expect(getEffectsCount()).toBe(0);
      expect(getSubscriptionCount(globalSignalQueue)).toBe(signalSubscriptions);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroySubscriptions,
      );

      // `runs` proves nothing here, in either direction: a static-deps effect
      // never runs at creation, and a later write cannot reach the callback
      // either, because RECALL sets shouldRun and run() then bails on the
      // destroyed flag. Only the subscription state tells
      // "saveSignalsFromDeps() was skipped" apart from "it ran and subscribed
      // anyway" — the two baselines above, and, naming the culprit directly,
      // the absence of `c`'s id on both queues.
      expect(getSubscribedEventNames(globalSignalQueue)).not.toContain(
        signalImpl(c).id,
      );
      expect(getSubscribedEventNames(globalDestroySignalQueue)).not.toContain(
        signalImpl(c).id,
      );
    } finally {
      // unsubscribe() must run even if createEffect() throws — otherwise this
      // handler stays registered and destroys every effect the other tests in
      // this file go on to create.
      unsubscribe();
      destroySignal(c);
    }
  });

  it('a cleanup returned after a mid-callback self-destroy still runs (MEM-004)', () => {
    const {get: a, set: setA} = createSignal(0);

    let acquired = 0;
    let released = 0;
    let effect: Effect;

    effect = createEffect(() => {
      const value = a();
      acquired += 1;
      // Second run: the effect destroys itself in the middle of the callback.
      // run() still goes through to the end and hands the cleanup on to
      // storeCleanupCallback() — destroy() has long since put its own
      // runCleanupCallback() behind it.
      if (value === 1) effect.destroy();
      return () => {
        released += 1;
      };
    });

    try {
      setA(1);

      expect(acquired).toBe(2);
      expect(released).toBe(2);
      assertEffectsCount(0, 'after mid-callback self-destroy');
    } finally {
      effect.destroy();
      destroySignal(a);
    }
  });

  it('an effect is destroyed once its last live dependency dies, even when an earlier one was hard-destroyed mid-callback (MEM-006)', () => {
    const a = createSignal(0);
    const b = createSignal(0);

    let cleanupCalls = 0;

    // `a` is hard-destroyed from *inside* the callback, right after being
    // read. `whenSignalIsRead()` has already dropped it from `#lostSignals`,
    // so `cleanupLostSignals()` does not touch it, yet
    // `#destroyedSignals.clear()` at the end of this very run wipes the
    // marker the hard-destroy branch just set. The id survives in `#signals`,
    // unmarked and unsubscribed — which is why the untriggerable check reads
    // `#signalSubscriptions` rather than counting ids.
    const effect = createEffect(() => {
      a.get();
      a.destroy();
      b.get();
      return () => {
        cleanupCalls += 1;
      };
    });

    try {
      expect(cleanupCalls).toBe(0);

      // Outside of any run: the last live dependency dies. Nothing left that
      // could ever trigger this effect again.
      b.destroy();

      expect(cleanupCalls).toBe(1);
      assertEffectsCount(0, 'after last live dependency hard-destroyed');
    } finally {
      effect.destroy();
      destroySignal(a, b);
    }
  });

  describe('Effect#onDestroy() (internal)', () => {
    it('returns an unsubscribe function that cancels the subscription', () => {
      const a = createSignal(0);
      const onDestroyed = vi.fn();

      const effect = createEffect(() => {
        a.get();
      });

      try {
        const unsubscribe = effect.onDestroy(onDestroyed);
        expect(typeof unsubscribe).toBe('function');

        unsubscribe();
        effect.destroy();

        expect(onDestroyed).not.toHaveBeenCalled();
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('runs the callback right away and returns a no-op when the effect is already gone', () => {
      const a = createSignal(0);
      const onDestroyed = vi.fn();

      const effect = createEffect(() => {
        a.get();
      });
      try {
        effect.destroy();

        const unsubscribe = effect.onDestroy(onDestroyed);

        expect(onDestroyed).toHaveBeenCalledTimes(1);
        expect(() => unsubscribe()).not.toThrow();
        expect(onDestroyed).toHaveBeenCalledTimes(1);
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });
  });

  describe('every teardown step is guarded on its own (MEM-008)', () => {
    it('runs the cleanup callback even when an onDestroyEffect handler throws', () => {
      // The finding's own scenario, reachable through fully public API: the
      // four steps used to share one `try`, so a throwing reporter took the
      // cleanup — the one place userland releases its resources — with it,
      // on an effect that counts as destroyed and gets no second attempt.
      const {get: a} = createSignal(0);
      let cleanupRuns = 0;

      const effect = createEffect(() => {
        a();
        return () => {
          ++cleanupRuns;
        };
      });

      const unsubscribe = onDestroyEffect(() => {
        throw new Error('reporter boom');
      });

      try {
        expect(
          () => effect.destroy(),
          'the reporter failure still reaches the caller',
        ).toThrow('reporter boom');

        expect(cleanupRuns, 'the cleanup ran all the same').toBe(1);
        expect(getEffectsCount()).toBe(0);
      } finally {
        unsubscribe();
        effect.destroy();
        destroySignal(a);
      }
    });

    it('unsubscribes, reports and cleans up even when a DESTROY listener throws', () => {
      // The first of the four steps. It used to skip the other three: the
      // instance kept its own listeners (`off(this)` never ran), no
      // `onDestroyEffect()` handler was ever told, and the cleanup did not
      // run.
      const {get: a} = createSignal(0);
      let cleanupRuns = 0;
      let reported = 0;

      const effect = createEffect(() => {
        a();
        return () => {
          ++cleanupRuns;
        };
      });
      const impl = effect[$effect] as EffectImpl;

      on(impl, DESTROY, () => {
        throw new Error('listener boom');
      });
      const unsubscribe = onDestroyEffect(() => {
        ++reported;
      });

      try {
        expect(() => effect.destroy()).toThrow('listener boom');

        expect(
          getSubscriptionCount(impl),
          'off(this) ran: no listener is left on the instance',
        ).toBe(0);
        expect(reported, 'the destroy was still reported').toBe(1);
        expect(cleanupRuns, 'and the cleanup still ran').toBe(1);
        expect(getEffectsCount()).toBe(0);
      } finally {
        unsubscribe();
        off(impl);
        effect.destroy();
        destroySignal(a);
      }
    });

    it('reports every failing step, in teardown order', () => {
      // Three failures in one teardown — listener, reporter, cleanup — plus
      // a child. Before the split only the first of the four steps could
      // ever be reported, so the two behind it vanished without a trace.
      const {get: a} = createSignal(0);
      const {get: b} = createSignal(0);

      const effect = createEffect(() => {
        a();
        createEffect(() => {
          b();
          return () => {
            throw new Error('child boom');
          };
        });
        return () => {
          throw new Error('cleanup boom');
        };
      });
      const impl = effect[$effect] as EffectImpl;

      on(impl, DESTROY, () => {
        throw new Error('listener boom');
      });
      const unsubscribe = onDestroyEffect(() => {
        throw new Error('reporter boom');
      });

      try {
        let caught: unknown;
        try {
          effect.destroy();
        } catch (err) {
          caught = err;
        }

        expect(caught).toBeInstanceOf(AggregateError);
        const errors = (caught as AggregateError).errors;

        expect(errors, 'three own steps plus the child').toHaveLength(4);
        expect(
          errors.slice(0, 3).map((err) => (err as Error).message),
          'the four steps report in teardown order',
        ).toEqual(['listener boom', 'reporter boom', 'cleanup boom']);

        // The child fails in the same three ways and hands its report over
        // whole: nested, not flattened, exactly as everywhere else this
        // helper is used. Its own `emit(this, DESTROY)` has no listener, so
        // two of the three steps fail there.
        expect(errors[3]).toBeInstanceOf(AggregateError);
        expect(
          (errors[3] as AggregateError).errors.map(
            (err) => (err as Error).message,
          ),
        ).toEqual(['reporter boom', 'child boom']);

        expect(getEffectsCount()).toBe(0);
      } finally {
        unsubscribe();
        off(impl);
        try {
          effect.destroy();
        } catch {
          // thrown by design
        }
        destroySignal(a, b);
      }
    });

    it('rethrows a lone failing step unchanged, with its identity intact', () => {
      // The counter-probe: one failure must not become an `AggregateError`.
      // `toBe` on the instance — a wrapper with the same message would pass
      // a `toThrow()`.
      const {get: a} = createSignal(0);
      const boom = new Error('cleanup boom');

      const effect = createEffect(() => {
        a();
        return () => {
          throw boom;
        };
      });

      try {
        let caught: unknown;
        try {
          effect.destroy();
        } catch (err) {
          caught = err;
        }

        expect(caught, 'the same object, not a wrapper').toBe(boom);
        expect(getEffectsCount()).toBe(0);
      } finally {
        try {
          effect.destroy();
        } catch {
          // thrown by design
        }
        destroySignal(a);
      }
    });
  });

  describe('Effect#destroyed (API-008)', () => {
    it('flips once the wrapper tears its effect down', () => {
      const {get: a} = createSignal(0);
      const effect = createEffect(() => {
        a();
      });

      try {
        expect(effect.destroyed, 'a live effect').toBe(false);

        effect.destroy();

        // First branch: `destroy()` cleared `[$effect]`, so the getter
        // answers from the missing reference alone.
        expect(effect[$effect]).toBeUndefined();
        expect(effect.destroyed, 'and a dead one').toBe(true);
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('is true for a wrapper whose effect died before it was handed out', () => {
      const {get: a} = createSignal(0);
      const unsubscribe = onCreateEffect((eff) => {
        eff.destroy();
      });
      let effect: Effect;

      try {
        effect = createEffect(() => {
          a();
        });

        // Second branch: the `once(effect, DESTROY, …)` in the `Effect`
        // constructor is installed *after* DESTROY already fired, so it
        // never runs and `[$effect]` stays occupied — the getter has to ask
        // the implementation.
        expect(effect[$effect], 'the reference survived').toBeDefined();
        expect(effect.destroyed, 'the effect did not').toBe(true);
      } finally {
        unsubscribe();
        effect?.destroy();
        destroySignal(a);
      }
    });
  });
});
