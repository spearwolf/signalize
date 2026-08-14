import {getSubscriptionCount} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './create-signal.js';
import type {EffectOptions} from './EffectImpl.js';
import {
  createEffect,
  getEffectsCount,
  onCreateEffect,
  onDestroyEffect,
} from './effects.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
// Through the entry point on purpose: the re-export is half of what the API
// promises, and only an import from here can witness it.
import {getMaxEffectDepth, setMaxEffectDepth} from './index.js';
import {SignalGroup} from './SignalGroup.js';
import {destroySignal} from './signal-core.js';

/** Give the promise of an async effect callback a chance to settle. */
const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('createEffect', () => {
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

  it('the effect cleanup callback is called like react:useEffect', () => {
    const {get: a, set: setA} = createSignal(123);

    let valA = 0;

    const effect = createEffect(() => {
      const val = a();
      return () => {
        valA = val;
      };
    });

    try {
      expect(a()).toBe(123);
      expect(valA).toBe(0);

      setA(666);

      expect(a()).toBe(666);
      expect(valA).toBe(123);

      setA(42);

      expect(a()).toBe(42);
      expect(valA).toBe(666);

      destroySignal(a);

      expect(valA).toBe(42);
    } finally {
      effect.destroy();
      destroySignal(a);
    }
  });

  it('async returned effect cleanup callback is called', async () => {
    const {get: a, set: setA} = createSignal(123);

    const cleanupValues: number[] = [];

    const effect = createEffect(async () => {
      const val = a();
      return () => {
        cleanupValues.push(val);
      };
    });

    try {
      expect(a()).toBe(123);
      expect(cleanupValues).toHaveLength(0);

      // The cleanup of an async run becomes eligible once its promise has
      // settled. Whether that run is still the current one decides *when* it
      // runs, not *whether*: see the superseded case twelve lines down.
      await settled();

      setA(666);

      expect(a()).toBe(666);
      expect(cleanupValues).toEqual([123]);

      // 667 supersedes the 666 run before its promise settled — the cleanup
      // of the 666 run still runs, just late, once its promise settles below
      //; it is not discarded.
      setA(667);

      expect(a()).toBe(667);
      expect(cleanupValues).toEqual([123]);

      await settled();

      expect(cleanupValues).toEqual([123, 666]);

      effect.destroy();

      expect(cleanupValues).toEqual([123, 666, 667]);
    } finally {
      effect.destroy();
      destroySignal(a);
    }
  });

  it('the effect callback is called synchronously and immediately', () => {
    const {get: a} = createSignal(123);
    const {get: b} = createSignal('abc');

    let valA: number;
    let valB: string;

    const effect = createEffect(() => {
      valA = a();
      valB = b();
    });

    try {
      expect(valA).toBe(123);
      expect(valB).toBe('abc');
    } finally {
      effect.destroy();
      destroySignal(a, b);
    }
  });

  it('dynamic effects only listen to the signals they actually read', () => {
    const {get: a, set: setA} = createSignal(123);
    const {get: b, set: setB} = createSignal('abc');

    let valA: number;
    let valB: string;
    let effectCallCount = 0;

    const effect = createEffect(() => {
      ++effectCallCount;
      valA = a();
      if (valA === 666) {
        valB = b();
      }
    });

    try {
      expect(effectCallCount).toBe(1);
      expect(valA).toBe(123);
      expect(valB).toBeUndefined();

      setB('def'); // no effect, because the signal was never read

      expect(effectCallCount).toBe(1);

      setA(666); // re-run effect

      expect(effectCallCount).toBe(2);
      expect(valA).toBe(666);
      expect(valB).toBe('def');

      setB('ghi'); // now the effect is executed

      expect(effectCallCount).toBe(3);
      expect(valB).toBe('ghi');
    } finally {
      effect.destroy();
      destroySignal(a, b);
    }
  });

  it('the effect callback is called again after calling a setter function', () => {
    const {get: a, set: setA} = createSignal(123);
    const {get: b, set: setB} = createSignal('abc');

    const valA = vi.fn();
    const valB = vi.fn();

    let effectCallCount = 0;

    const effect = createEffect(() => {
      ++effectCallCount;
      valA(a());
      a(); // yes, sure why not
      valB(b());
    });

    try {
      expect(effectCallCount).toBe(1);
      expect(valA).toHaveBeenCalledWith(123);
      expect(valB).toHaveBeenCalledWith('abc');

      setA(456);

      expect(effectCallCount).toBe(2); // well, just to be really sure
      expect(valA).toHaveBeenCalledWith(456);
      expect(valB).toHaveBeenCalledWith('abc');

      setB('def');

      expect(effectCallCount).toBe(3);
      expect(valA).toHaveBeenCalledWith(456);
      expect(valB).toHaveBeenCalledWith('def');

      setB('def'); // no change: no effect should be called here

      expect(effectCallCount).toBe(3);
    } finally {
      effect.destroy();
      destroySignal(a, b);
    }
  });

  it('the effect callback is called again after calling a setter function (with static dependencies)', () => {
    const {get: a, set: setA} = createSignal(0);
    const {get: b, set: setB} = createSignal('abc');

    const valA = vi.fn();
    const valB = vi.fn();

    let effectCallCount = 0;

    const effect = createEffect(() => {
      ++effectCallCount;
      valA(a());
      a(); // yes, sure why not
      valB(b());
    }, [a, b]);

    try {
      // IMPORTANT: we have a static dependency array, so when you create an effect, the effect callback is not called automatically
      expect(effectCallCount).toBe(0);

      setA(123);

      expect(effectCallCount).toBe(1);
      expect(valA).toHaveBeenCalledWith(123);
      expect(valB).toHaveBeenCalledWith('abc');

      setA(456);

      expect(effectCallCount).toBe(2); // well, just to be really sure
      expect(valA).toHaveBeenCalledWith(456);
      expect(valB).toHaveBeenCalledWith('abc');

      setB('def');

      expect(effectCallCount).toBe(3);
      expect(valA).toHaveBeenCalledWith(456);
      expect(valB).toHaveBeenCalledWith('def');

      setB('def'); // no change: no effect should be called here

      expect(effectCallCount).toBe(3);
    } finally {
      effect.destroy();
      destroySignal(a, b);
    }
  });

  it('skips a static dependency that is already destroyed at construction time', () => {
    const sigQueueBaseline = getSubscriptionCount(globalSignalQueue);
    const destroyQueueBaseline = getSubscriptionCount(globalDestroySignalQueue);

    const dead = createSignal(0);
    const alive = createSignal(0);
    dead.destroy();

    let runs = 0;
    let cleanupCalls = 0;
    const effect = createEffect(() => {
      runs += 1;
      return () => {
        cleanupCalls += 1;
      };
    }, [dead, alive]);

    try {
      // Only the live dependency is subscribed — a destroyed signal never
      // emits again, and its destroy event has already been and gone, so the
      // subscription would be unremovable short of destroy().
      expect(getSubscriptionCount(globalSignalQueue)).toBe(
        sigQueueBaseline + 1,
      );

      alive.set(1);
      expect(runs).toBe(1);

      // ... which is why losing the last live dependency still ends the
      // effect instead of leaving a deaf shell behind.
      alive.destroy();
      expect(cleanupCalls).toBe(1);
      assertEffectsCount(0, 'only dead deps left => effect destroyed');
      expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroyQueueBaseline,
      );
    } finally {
      effect.destroy();
      destroySignal(dead, alive);
    }
  });

  it('calling a setter from within an affect callback', () => {
    const {get: count, set: setCount} = createSignal(0);

    const effect = createEffect(() => {
      if (count() < 23) {
        setCount(count() + 1);
      }
    });

    try {
      expect(count()).toBe(23);
    } finally {
      effect.destroy();
      destroySignal(count);
    }
  });

  it('runaway self-triggering effect throws once maxDepth is exceeded', () => {
    const before = getMaxEffectDepth();
    // The default is quoted in five documents and asserted nowhere.
    expect(before).toBe(256);
    setMaxEffectDepth(8);

    const {get: count, set: setCount} = createSignal(0);

    try {
      expect(() => {
        createEffect(() => {
          setCount(count() + 1);
        });
      }).toThrow(/maxDepth=8/);
    } finally {
      setMaxEffectDepth(before);
      destroySignal(count);
    }
  });

  it('pins the maxDepth boundary exactly: N-1 recursive self-triggers pass, N throws', () => {
    const before = getMaxEffectDepth();
    const N = 5;
    setMaxEffectDepth(N);

    try {
      // N - 1 self-triggers: N total invocations, none of them ever see
      // #runDepth reach N at entry.
      const under = createSignal(0);
      let underRuns = 0;
      let underEffect: ReturnType<typeof createEffect> | undefined;
      try {
        expect(() => {
          underEffect = createEffect(() => {
            underRuns += 1;
            const c = under.get();
            if (c < N - 1) under.set(c + 1);
          });
        }).not.toThrow();
        expect(underRuns).toBe(N);
      } finally {
        underEffect?.destroy();
        destroySignal(under);
      }

      // Exactly N self-triggers: the (N+1)-th invocation sees #runDepth
      // reach N at entry, right on the boundary — with `>` instead of `>=`
      // this would not throw until N+1.
      const over = createSignal(0);
      try {
        expect(() => {
          createEffect(() => {
            const c = over.get();
            if (c < N) over.set(c + 1);
          });
        }).toThrow(/maxDepth=5/);
      } finally {
        destroySignal(over);
      }
    } finally {
      setMaxEffectDepth(before);
    }
  });

  it('setMaxEffectDepth() refuses a cap that is not a positive integer', () => {
    const before = getMaxEffectDepth();

    try {
      expect(() => setMaxEffectDepth(0)).toThrow(/integer >= 1/);
      expect(() => setMaxEffectDepth(1.5)).toThrow(/integer >= 1/);
      expect(() => setMaxEffectDepth(Number.POSITIVE_INFINITY)).toThrow(
        /integer >= 1/,
      );
      expect(getMaxEffectDepth()).toBe(before);
    } finally {
      setMaxEffectDepth(before);
    }
  });

  it('onCreateEffect/onDestroyEffect deliver in priority order', () => {
    // The promise `CHANGELOG.md` makes as a breaking change: priority sits in
    // second place, exactly where `onEffectError()` has it. Both
    // handlers of a pair subscribe in low-then-high order, so registration
    // order alone would produce `['low', 'high']` — only the priority
    // argument actually reaching `on()` flips it. Drop that argument in
    // `effects.ts`, or swap it into eventize's own `(cb, priority)` slot,
    // and these two assertions go red. Measured: they do.
    const created: string[] = [];
    const destroyed: string[] = [];

    const unsubCreateLow = onCreateEffect(() => created.push('low'));
    const unsubCreateHigh = onCreateEffect(() => created.push('high'), 10);
    const unsubDestroyLow = onDestroyEffect(() => destroyed.push('low'));
    const unsubDestroyHigh = onDestroyEffect(() => destroyed.push('high'), 10);

    try {
      const effect = createEffect(() => {}, {autorun: false});
      effect.destroy();

      expect(created).toEqual(['high', 'low']);
      expect(destroyed).toEqual(['high', 'low']);
    } finally {
      unsubCreateLow();
      unsubCreateHigh();
      unsubDestroyLow();
      unsubDestroyHigh();
    }
  });

  it('nested effects work as expected', () => {
    const {get: getA, set: setA} = createSignal(123);
    const {get: getB, set: setB} = createSignal('abc');
    const {get: getC, set: setC} = createSignal('A');
    const {get: getD, set: setD} = createSignal('foo');
    const {get: getE, set: setE} = createSignal(true);

    const a = vi.fn(getA);
    const b = vi.fn(getB);
    const c = vi.fn(getC);
    const d = vi.fn(getD);
    const e = vi.fn(getE);

    const destroyEffectMock = vi.fn();
    const unsubDestroy = onDestroyEffect(destroyEffectMock);

    let firstEffectCallCount = 0;
    let secondEffectCallCount = 0;
    let thirdEffectCallCount = 0;

    const clearAllMocks = () => {
      vi.clearAllMocks();
      firstEffectCallCount = 0;
      secondEffectCallCount = 0;
      thirdEffectCallCount = 0;
    };

    const effect = createEffect(() => {
      ++firstEffectCallCount;
      a();
      a();
      b();
      c();

      createEffect(() => {
        ++secondEffectCallCount;
        b();
        d();

        createEffect(() => {
          ++thirdEffectCallCount;
          a();
          c();
          e();
        });
      });
    });

    try {
      assertEffectsCount(3, 'after first effect run');
      expect(destroyEffectMock).toHaveBeenCalledTimes(0);

      expect(firstEffectCallCount).toBe(1);
      expect(secondEffectCallCount).toBe(1);
      expect(thirdEffectCallCount).toBe(1);
      expect(a).toHaveBeenCalledTimes(3);
      expect(b).toHaveBeenCalledTimes(2);
      expect(c).toHaveBeenCalledTimes(2);
      expect(d).toHaveBeenCalledTimes(1);
      expect(e).toHaveBeenCalledTimes(1);
      clearAllMocks();

      // When parent (first) effect re-runs due to signal A change:
      // 1. Child effects are destroyed (cleanup is called)
      // 2. New child effects are created and run
      setA(456);

      assertEffectsCount(3, 'after second effect run');
      // 2 child effects destroyed (second and third)
      expect(destroyEffectMock).toHaveBeenCalledTimes(2);

      expect(firstEffectCallCount).toBe(1);
      // Child effects are recreated and re-run
      expect(secondEffectCallCount).toBe(1);
      expect(thirdEffectCallCount).toBe(1);
      expect(a).toHaveBeenCalledTimes(3); // 2 in first + 1 in third
      expect(b).toHaveBeenCalledTimes(2); // 1 in first + 1 in second
      expect(c).toHaveBeenCalledTimes(2); // 1 in first + 1 in third
      expect(d).toHaveBeenCalledTimes(1); // 1 in second
      expect(e).toHaveBeenCalledTimes(1); // 1 in third
      clearAllMocks();

      // When first effect re-runs due to signal B change:
      // Child effects are destroyed and recreated
      setB('def');

      // 2 more child effects destroyed
      expect(destroyEffectMock).toHaveBeenCalledTimes(2);

      expect(firstEffectCallCount).toBe(1);
      // Child effects recreated
      expect(secondEffectCallCount).toBe(1);
      expect(thirdEffectCallCount).toBe(1);
      expect(a).toHaveBeenCalledTimes(3);
      expect(b).toHaveBeenCalledTimes(2);
      expect(c).toHaveBeenCalledTimes(2);
      expect(d).toHaveBeenCalledTimes(1);
      expect(e).toHaveBeenCalledTimes(1);
      clearAllMocks();

      // When first effect re-runs due to signal C change:
      // Child effects are destroyed and recreated
      setC('B');

      expect(destroyEffectMock).toHaveBeenCalledTimes(2);

      expect(firstEffectCallCount).toBe(1);
      expect(secondEffectCallCount).toBe(1);
      expect(thirdEffectCallCount).toBe(1);
      expect(a).toHaveBeenCalledTimes(3);
      expect(b).toHaveBeenCalledTimes(2);
      expect(c).toHaveBeenCalledTimes(2);
      expect(d).toHaveBeenCalledTimes(1);
      expect(e).toHaveBeenCalledTimes(1);
      clearAllMocks();

      // Signal D only affects second effect, which is now a child
      // When second effect re-runs, third effect (its child) is destroyed and recreated
      setD('bar');

      // Only third effect is destroyed (child of second)
      expect(destroyEffectMock).toHaveBeenCalledTimes(1);

      expect(firstEffectCallCount).toBe(0);
      expect(secondEffectCallCount).toBe(1);
      expect(thirdEffectCallCount).toBe(1); // Recreated when second re-runs
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
      expect(c).toHaveBeenCalledTimes(1);
      expect(d).toHaveBeenCalledTimes(1);
      expect(e).toHaveBeenCalledTimes(1);
      clearAllMocks();

      // Signal E only affects third effect, which has no children
      setE(false);

      expect(destroyEffectMock).toHaveBeenCalledTimes(0);

      expect(firstEffectCallCount).toBe(0);
      expect(secondEffectCallCount).toBe(0);
      expect(thirdEffectCallCount).toBe(1);
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(0);
      expect(c).toHaveBeenCalledTimes(1);
      expect(d).toHaveBeenCalledTimes(0);
      expect(e).toHaveBeenCalledTimes(1);

      effect.destroy();

      // 3 effects destroyed on final destroy
      expect(destroyEffectMock).toHaveBeenCalledTimes(3);
    } finally {
      unsubDestroy();
      effect.destroy();
      destroySignal(getA, getB, getC, getD, getE);
    }
  });

  // CreateEffect must not mutate a caller-supplied options object.
  it('does not mutate the caller-supplied options object (positional dependencies form)', () => {
    const {get} = createSignal(123);

    const shared: EffectOptions = {autorun: false};

    const effect = createEffect(
      () => {
        get();
      },
      [get],
      shared,
    );

    try {
      expect(shared).toEqual({autorun: false});
      expect('dependencies' in shared).toBe(false);
    } finally {
      effect.destroy();
      destroySignal(get);
    }
  });

  // An unresolvable string/symbol dependency must throw a
  // descriptive error naming the dependency, not an opaque TypeError.
  it('throws a descriptive error when a named dependency is not registered in the attached group', () => {
    const host = {};

    const countBefore = getEffectsCount();

    try {
      expect(() => {
        createEffect(() => {}, ['doesNotExist'], {attach: host});
      }).toThrow(/doesNotExist/);

      // The failed construction must not leave a half-built effect attached to
      // the group — otherwise the group's own teardown later destroys a
      // "zombie" that never went through `++EffectImpl.count`, and the global
      // counter drifts (permanently, potentially negative).
      expect(getEffectsCount()).toBe(countBefore);

      SignalGroup.findOrCreate(host).clear();

      expect(getEffectsCount()).toBe(countBefore);
    } finally {
      SignalGroup.findOrCreate(host).clear();
    }
  });

  it('throws a descriptive error when a named dependency is used without an attached group (bypassing the type check)', () => {
    // A JavaScript consumer without type checking can call this even though
    // the TS overloads require `attach` whenever dependencies contain
    // strings/symbols.
    const createEffectUntyped = createEffect as unknown as (
      callback: () => void,
      dependencies: unknown[],
      options?: unknown,
    ) => unknown;

    expect(() => {
      createEffectUntyped(() => {}, ['doesNotExist']);
    }).toThrow(/doesNotExist/);
  });
});
