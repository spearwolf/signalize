import {getSubscriptionCount} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './createSignal.js';
import type {Effect} from './Effect.js';
import {createEffect, getEffectsCount} from './effects.js';
import {globalDestroySignalQueue, globalEffectQueue} from './global-queues.js';
import {getLinksCount} from './link.js';
import {destroySignal, getSignalsCount} from './signal-core.js';

describe('unsubscribe as return function from effect callback', () => {
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

  it('should be called before recalling the effect callback', () => {
    const {get: a, set: setA} = createSignal(123);
    const {get: b, set: setB} = createSignal('abc');

    const valA = vi.fn();
    const valB = vi.fn();

    const unsubscribeA = vi.fn();
    const unsubscribeB = vi.fn();

    let effectCallCount0 = 0;
    let effectCallCount1 = 0;
    const subscriptionOrder: any[] = [];

    const clearAllMocks = () => {
      vi.clearAllMocks();
      effectCallCount0 = 0;
      effectCallCount1 = 0;
      subscriptionOrder.length = 0;
    };

    // The inner effect is created inside the outer callback and has no handle
    // of its own — destroying the outer one takes it with it.
    const outer = createEffect(() => {
      ++effectCallCount0;
      valA(a());

      createEffect(() => {
        ++effectCallCount1;
        valB(b());

        const _b = b();

        return () => {
          subscriptionOrder.push(_b);
          unsubscribeB(_b);
        };
      });

      const _a = a();

      return () => {
        subscriptionOrder.push(_a);
        unsubscribeA(_a);
      };
    });

    try {
      expect(effectCallCount0).toBe(1);
      expect(effectCallCount1).toBe(1);

      expect(valA).toHaveBeenCalledWith(123);
      expect(valB).toHaveBeenCalledWith('abc');

      expect(unsubscribeA).toHaveBeenCalledTimes(0);
      expect(unsubscribeB).toHaveBeenCalledTimes(0);

      clearAllMocks();

      setB('foo');

      expect(effectCallCount0).toBe(0);
      expect(effectCallCount1).toBe(1);

      expect(valA).toHaveBeenCalledTimes(0);
      expect(valB).toHaveBeenCalledWith('foo');

      expect(unsubscribeA).toHaveBeenCalledTimes(0);
      expect(unsubscribeB).toHaveBeenCalledWith('abc');

      expect(subscriptionOrder).toEqual(['abc']);

      clearAllMocks();

      setA(43);

      expect(effectCallCount0).toBe(1);
      // Inner effect is recreated and re-runs when parent re-runs
      expect(effectCallCount1).toBe(1);

      expect(valA).toHaveBeenCalledWith(43);
      expect(valB).toHaveBeenCalledWith('foo');

      expect(unsubscribeA).toHaveBeenCalledWith(123);
      // Inner effect cleanup is called when parent re-runs (before it's destroyed and recreated)
      expect(unsubscribeB).toHaveBeenCalledWith('foo');

      // Cleanup order: parent cleanup first, then child cleanup (child is destroyed before parent callback runs)
      expect(subscriptionOrder).toEqual([123, 'foo']);
    } finally {
      outer.destroy();
      destroySignal(a, b);
    }
  });

  it('leaves no trace: subscriptions and counters return to their snapshot after teardown (TEST-010)', () => {
    const effectSubscriptionsBefore = getSubscriptionCount(globalEffectQueue);
    const destroySubscriptionsBefore = getSubscriptionCount(
      globalDestroySignalQueue,
    );
    const effectsCountBefore = getEffectsCount();
    const signalsCountBefore = getSignalsCount();
    const linksCountBefore = getLinksCount();

    const {get: a, set: setA} = createSignal(123);
    const {get: b, set: setB} = createSignal('abc');

    let outerRunCount = 0;
    let innerRunCount = 0;

    const outerEffect: Effect = createEffect(() => {
      ++outerRunCount;
      a();

      createEffect(() => {
        ++innerRunCount;
        b();
      });
    });

    try {
      // The scenario is up and running: both counters and both queues grew
      // relative to the snapshot. A balance without a swing proves nothing.
      expect(getEffectsCount()).toBe(effectsCountBefore + 2);
      expect(getSubscriptionCount(globalEffectQueue)).toBeGreaterThan(
        effectSubscriptionsBefore,
      );
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBeGreaterThan(
        destroySubscriptionsBefore,
      );

      setB('foo');
      expect(innerRunCount).toBe(2);

      setA(456);
      expect(outerRunCount).toBe(2);
      // The inner effect is recreated on every outer rerun.
      expect(innerRunCount).toBe(3);

      // The teardown is the subject of this test, so it stays in the `try`
      // with the assertions that read it; the `finally` only repeats it as an
      // idempotent belt.
      outerEffect.destroy();
      destroySignal(a, b);

      expect(getEffectsCount()).toBe(effectsCountBefore);
      expect(getSignalsCount()).toBe(signalsCountBefore);
      expect(getLinksCount()).toBe(linksCountBefore);
      expect(getSubscriptionCount(globalEffectQueue)).toBe(
        effectSubscriptionsBefore,
      );
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroySubscriptionsBefore,
      );
    } finally {
      outerEffect.destroy();
      destroySignal(a, b);
    }
  });
});
