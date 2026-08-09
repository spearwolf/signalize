import {
  getSubscribedEventNames,
  getSubscriptionCount,
  once,
} from '@spearwolf/eventize';
import {assertEffectsCount} from './__testing__/assert-helpers.js';
import {$effect, DESTROY} from './constants.js';
import {createSignal} from './createSignal.js';
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
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
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

    expect(runCount).toBe(0);

    const seen: EffectImpl[] = [];

    const unsubscribe = onDestroyEffect((impl: EffectImpl) => {
      seen.push(impl);
      impl.run();
    });

    effect.destroy();
    unsubscribe();

    expect(seen).toHaveLength(1);
    expect(runCount).toBe(0);

    destroySignal(a);
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

    expect(getEffectsCount()).toBe(1);

    impl.destroy();

    expect(cleanupCalls).toBe(1);
    expect(getEffectsCount()).toBe(0);

    destroySignal(a);
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

    const impl = effect[$effect];

    let seen: EffectImpl | undefined;

    once(impl, DESTROY, (destroyed: EffectImpl) => {
      seen = destroyed;
      destroyed.run();
    });

    impl.destroy();

    expect(seen).toBe(impl);
    expect(runCount).toBe(0);

    destroySignal(a);
  });

  it('destroy() re-entered from an onDestroyEffect handler decrements the effect counter exactly once', () => {
    const {get: a} = createSignal(1);

    const effect = createEffect(() => {
      a();
    });

    const impl = effect[$effect];

    let handlerCalls = 0;

    const unsubscribe = onDestroyEffect((destroyed: EffectImpl) => {
      ++handlerCalls;
      destroyed.destroy();
    });

    impl.destroy();
    unsubscribe();

    // The re-entrant destroy() is a no-op, so it emits no second event.
    expect(handlerCalls).toBe(1);
    expect(getEffectsCount()).toBe(0);

    destroySignal(a);
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

    destroySignal(a, b);
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

    destroySignal(a, b);
  });

  it('an effect that destroys itself mid-callback stops tracking (MEM-003)', () => {
    const signalSubscriptions = getSubscriptionCount(globalSignalQueue);
    const destroySubscriptions = getSubscriptionCount(globalDestroySignalQueue);

    const {get: a} = createSignal(1);
    const {get: b, set: setB} = createSignal(2);

    let runs = 0;
    let effect: Effect;

    // autorun:false, damit `effect` beim Lauf des Callbacks schon zugewiesen ist.
    effect = createEffect(
      () => {
        a();
        ++runs;
        effect.destroy();
        // Der Rest des Callbacks läuft weiter — der tote Effect steht
        // immer noch auf dem globalen Effect-Stack.
        b();
      },
      {autorun: false},
    );

    effect.run();

    expect(runs).toBe(1);
    expect(getEffectsCount()).toBe(0);

    // Kein Abo, das niemand mehr abbestellen kann.
    expect(getSubscriptionCount(globalSignalQueue)).toBe(signalSubscriptions);
    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      destroySubscriptions,
    );

    setB(3);
    expect(runs).toBe(1);

    destroySignal(a, b);
  });

  it('an effect destroyed while it is being created never saves its static deps (MEM-003)', () => {
    const signalSubscriptions = getSubscriptionCount(globalSignalQueue);
    const destroySubscriptions = getSubscriptionCount(globalDestroySignalQueue);

    const {get: c} = createSignal(3);

    let runs = 0;

    const unsubscribe = onCreateEffect((impl: EffectImpl) => {
      impl.destroy();
    });
    try {
      createEffect(() => {
        ++runs;
        c();
      }, [c]);
    } finally {
      // Must run even if createEffect() throws — otherwise this handler
      // stays registered and destroys every effect the other tests in this
      // file go on to create.
      unsubscribe();
    }

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

    destroySignal(c);
  });

  it('a cleanup returned after a mid-callback self-destroy still runs (MEM-004)', () => {
    const {get: a, set: setA} = createSignal(0);

    let acquired = 0;
    let released = 0;
    let effect: Effect;

    effect = createEffect(() => {
      const value = a();
      acquired += 1;
      // Zweiter Lauf: der Effect zerstört sich mitten im Callback. run()
      // läuft trotzdem bis zum Ende durch und reicht den Cleanup an
      // storeCleanupCallback() weiter — destroy() hat sein
      // runCleanupCallback() da längst hinter sich.
      if (value === 1) effect.destroy();
      return () => {
        released += 1;
      };
    });

    setA(1);

    expect(acquired).toBe(2);
    expect(released).toBe(2);
    assertEffectsCount(0, 'after mid-callback self-destroy');

    destroySignal(a);
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
    createEffect(() => {
      a.get();
      a.destroy();
      b.get();
      return () => {
        cleanupCalls += 1;
      };
    });

    expect(cleanupCalls).toBe(0);

    // Outside of any run: the last live dependency dies. Nothing left that
    // could ever trigger this effect again.
    b.destroy();

    expect(cleanupCalls).toBe(1);
    assertEffectsCount(0, 'after last live dependency hard-destroyed');
  });

  describe('Effect#onDestroy() (internal)', () => {
    it('returns an unsubscribe function that cancels the subscription', () => {
      const a = createSignal(0);
      const onDestroyed = vi.fn();

      const effect = createEffect(() => {
        a.get();
      });

      const unsubscribe = effect.onDestroy(onDestroyed);
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      effect.destroy();

      expect(onDestroyed).not.toHaveBeenCalled();

      destroySignal(a);
    });

    it('runs the callback right away and returns a no-op when the effect is already gone', () => {
      const a = createSignal(0);
      const onDestroyed = vi.fn();

      const effect = createEffect(() => {
        a.get();
      });
      effect.destroy();

      const unsubscribe = effect.onDestroy(onDestroyed);

      expect(onDestroyed).toHaveBeenCalledTimes(1);
      expect(() => unsubscribe()).not.toThrow();
      expect(onDestroyed).toHaveBeenCalledTimes(1);

      destroySignal(a);
    });
  });
});
