import {assertEffectsCount} from './assert-helpers.js';
import {createSignal} from './createSignal.js';
import {EffectImpl, type EffectOptions} from './EffectImpl.js';
import {
  createEffect,
  getEffectsCount,
  onCreateEffect,
  onDestroyEffect,
} from './effects.js';
import {SignalGroup} from './SignalGroup.js';
import {destroySignal} from './signal-core.js';

/** Give the promise of an async effect callback a chance to settle. */
const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('createEffect', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
  });

  it('the effect cleanup callback is called like react:useEffect', () => {
    const {get: a, set: setA} = createSignal(123);

    let valA = 0;

    createEffect(() => {
      const val = a();
      return () => {
        valA = val;
      };
    });

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

    expect(a()).toBe(123);
    expect(cleanupValues).toHaveLength(0);

    // The cleanup of an async run only becomes eligible once its promise has
    // settled — and only as long as that run is still the current one.
    await settled();

    setA(666);

    expect(a()).toBe(666);
    expect(cleanupValues).toEqual([123]);

    // 667 supersedes the 666 run before its promise settled — the cleanup
    // of the 666 run still runs, just late, once its promise settles below
    // (MEM-004); it is not discarded.
    setA(667);

    expect(a()).toBe(667);
    expect(cleanupValues).toEqual([123]);

    await settled();

    expect(cleanupValues).toEqual([123, 666]);

    effect.destroy();

    expect(cleanupValues).toEqual([123, 666, 667]);

    destroySignal(a);
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

    expect(valA).toBe(123);
    expect(valB).toBe('abc');

    effect.destroy();
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

    effect.destroy();
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

    effect.destroy();
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

    effect.destroy();
  });

  it('calling a setter from within an affect callback', () => {
    const {get: count, set: setCount} = createSignal(0);

    const effect = createEffect(() => {
      if (count() < 23) {
        setCount(count() + 1);
      }
    });

    expect(count()).toBe(23);

    effect.destroy();
  });

  it('runaway self-triggering effect throws once maxDepth is exceeded', () => {
    const originalMaxDepth = EffectImpl.maxDepth;
    EffectImpl.maxDepth = 8;

    const {get: count, set: setCount} = createSignal(0);

    // run() throws before the Effect wrapper escapes createEffect, so capture
    // the underlying EffectImpl via onCreateEffect to clean it up afterwards.
    let leaked: EffectImpl | undefined;
    const unsubCreate = onCreateEffect((eff: EffectImpl) => {
      leaked = eff;
    });

    try {
      expect(() => {
        createEffect(() => {
          setCount(count() + 1);
        });
      }).toThrow(/maxDepth=8/);
    } finally {
      unsubCreate();
      EffectImpl.maxDepth = originalMaxDepth;
      leaked?.destroy();
      destroySignal(count);
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

    unsubDestroy();
  });

  // BUG-005 — createEffect must not mutate a caller-supplied options object.
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

    expect(shared).toEqual({autorun: false});
    expect('dependencies' in shared).toBe(false);

    effect.destroy();
    destroySignal(get);
  });

  // BUG-003 — an unresolvable string/symbol dependency must throw a
  // descriptive error naming the dependency, not an opaque TypeError.
  it('throws a descriptive error when a named dependency is not registered in the attached group', () => {
    const host = {};

    const countBefore = getEffectsCount();

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
