import {emit, eventize, onceAsync} from '@spearwolf/eventize';
import {assertEffectsCount} from './assert-helpers.js';
import {createSignal, destroySignal} from './createSignal.js';
import {createEffect, onDestroyEffect} from './effects-api.js';

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
    const ctrl = eventize();

    createEffect(async () => {
      const val = a();
      return () => {
        cleanupValues.push(val);
        emit(ctrl, `cleanup[${cleanupValues.length}]`);
      };
    });

    expect(a()).toBe(123);
    expect(cleanupValues).toHaveLength(0);

    setA(666);

    expect(a()).toBe(666);
    expect(cleanupValues).toHaveLength(0);

    await onceAsync(ctrl, 'cleanup[1]');

    expect(cleanupValues).toEqual([123]);
    cleanupValues.length = 0;

    setA(667);
    expect(a()).toBe(667);
    expect(cleanupValues).toHaveLength(0);

    setA(668);
    expect(a()).toBe(668);
    expect(cleanupValues).toHaveLength(0);

    await onceAsync(ctrl, 'cleanup[2]');

    expect(cleanupValues).toEqual([666, 667]);

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

    const valA = jest.fn();
    const valB = jest.fn();

    let effectCallCount = 0;

    const effect = createEffect(() => {
      ++effectCallCount;
      valA(a());
      a(); // yes, sure why not
      valB(b());
    });

    expect(effectCallCount).toBe(1);
    expect(valA).toBeCalledWith(123);
    expect(valB).toBeCalledWith('abc');

    setA(456);

    expect(effectCallCount).toBe(2); // well, just to be really sure
    expect(valA).toBeCalledWith(456);
    expect(valB).toBeCalledWith('abc');

    setB('def');

    expect(effectCallCount).toBe(3);
    expect(valA).toBeCalledWith(456);
    expect(valB).toBeCalledWith('def');

    setB('def'); // no change: no effect should be called here

    expect(effectCallCount).toBe(3);

    effect.destroy();
  });

  it('the effect callback is called again after calling a setter function (with static dependencies)', () => {
    const {get: a, set: setA} = createSignal(0);
    const {get: b, set: setB} = createSignal('abc');

    const valA = jest.fn();
    const valB = jest.fn();

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
    expect(valA).toBeCalledWith(123);
    expect(valB).toBeCalledWith('abc');

    setA(456);

    expect(effectCallCount).toBe(2); // well, just to be really sure
    expect(valA).toBeCalledWith(456);
    expect(valB).toBeCalledWith('abc');

    setB('def');

    expect(effectCallCount).toBe(3);
    expect(valA).toBeCalledWith(456);
    expect(valB).toBeCalledWith('def');

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

  it('nested effects work as expected', () => {
    const {get: getA, set: setA} = createSignal(123);
    const {get: getB, set: setB} = createSignal('abc');
    const {get: getC, set: setC} = createSignal('A');
    const {get: getD, set: setD} = createSignal('foo');
    const {get: getE, set: setE} = createSignal(true);

    const a = jest.fn(getA);
    const b = jest.fn(getB);
    const c = jest.fn(getC);
    const d = jest.fn(getD);
    const e = jest.fn(getE);

    const destroyEffectMock = jest.fn();

    onDestroyEffect(destroyEffectMock);

    let firstEffectCallCount = 0;
    let secondEffectCallCount = 0;
    let thirdEffectCallCount = 0;

    const clearAllMocks = () => {
      jest.clearAllMocks();
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
    expect(destroyEffectMock).toBeCalledTimes(0);

    expect(firstEffectCallCount).toBe(1);
    expect(secondEffectCallCount).toBe(1);
    expect(thirdEffectCallCount).toBe(1);
    expect(a).toBeCalledTimes(3);
    expect(b).toBeCalledTimes(2);
    expect(c).toBeCalledTimes(2);
    expect(d).toBeCalledTimes(1);
    expect(e).toBeCalledTimes(1);
    clearAllMocks();

    setA(456);

    assertEffectsCount(3, 'after second effect run');
    expect(destroyEffectMock).toBeCalledTimes(0);

    expect(firstEffectCallCount).toBe(1);
    expect(secondEffectCallCount).toBe(0);
    expect(thirdEffectCallCount).toBe(1);
    expect(a).toBeCalledTimes(3);
    expect(b).toBeCalledTimes(1);
    expect(c).toBeCalledTimes(2);
    expect(d).toBeCalledTimes(0);
    expect(e).toBeCalledTimes(1);
    clearAllMocks();

    setB('def');

    expect(firstEffectCallCount).toBe(1);
    expect(secondEffectCallCount).toBe(1);
    expect(thirdEffectCallCount).toBe(0);
    expect(a).toBeCalledTimes(2);
    expect(b).toBeCalledTimes(2);
    expect(c).toBeCalledTimes(1);
    expect(d).toBeCalledTimes(1);
    expect(e).toBeCalledTimes(0);
    clearAllMocks();

    setC('B');

    expect(firstEffectCallCount).toBe(1);
    expect(secondEffectCallCount).toBe(0);
    expect(thirdEffectCallCount).toBe(1);
    expect(a).toBeCalledTimes(3);
    expect(b).toBeCalledTimes(1);
    expect(c).toBeCalledTimes(2);
    expect(d).toBeCalledTimes(0);
    expect(e).toBeCalledTimes(1);
    clearAllMocks();

    setD('bar');

    expect(firstEffectCallCount).toBe(0);
    expect(secondEffectCallCount).toBe(1);
    expect(thirdEffectCallCount).toBe(0);
    expect(a).toBeCalledTimes(0);
    expect(b).toBeCalledTimes(1);
    expect(c).toBeCalledTimes(0);
    expect(d).toBeCalledTimes(1);
    expect(e).toBeCalledTimes(0);
    clearAllMocks();

    setE(false);

    expect(firstEffectCallCount).toBe(0);
    expect(secondEffectCallCount).toBe(0);
    expect(thirdEffectCallCount).toBe(1);
    expect(a).toBeCalledTimes(1);
    expect(b).toBeCalledTimes(0);
    expect(c).toBeCalledTimes(1);
    expect(d).toBeCalledTimes(0);
    expect(e).toBeCalledTimes(1);

    effect.destroy();

    expect(destroyEffectMock).toBeCalledTimes(3);
  });
});
