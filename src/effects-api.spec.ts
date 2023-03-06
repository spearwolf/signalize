import {createEffect, onDestroyEffect} from './effects-api';
import {createSignal, destroySignal} from './createSignal';
import {assertEffectsCount} from './assert-helpers';

describe('createEffect', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
  });

  it('the effect cleanup callback is called like react:useEffect', () => {
    const [a, setA] = createSignal(123);

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

  it('the effect callback is called synchronously and immediately', () => {
    const [a] = createSignal(123);
    const [b] = createSignal('abc');

    let valA: number;
    let valB: string;

    const [, unsubscribe] = createEffect(() => {
      valA = a();
      valB = b();
    });

    expect(valA).toBe(123);
    expect(valB).toBe('abc');

    unsubscribe();
  });

  it('the effect callback is called again after calling a setter function', () => {
    const [a, setA] = createSignal(123);
    const [b, setB] = createSignal('abc');

    const valA = jest.fn();
    const valB = jest.fn();

    let effectCallCount = 0;

    const [, unsubscribe] = createEffect(() => {
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

    unsubscribe();
  });

  it('calling a setter from within an affect callback', () => {
    const [count, setCount] = createSignal(0);

    const [, unsubscribe] = createEffect(() => {
      if (count() < 23) {
        setCount(count() + 1);
      }
    });

    expect(count()).toBe(23);

    unsubscribe();
  });

  it('nested effects work as expected', () => {
    const [getA, setA] = createSignal(123);
    const [getB, setB] = createSignal('abc');
    const [getC, setC] = createSignal('A');
    const [getD, setD] = createSignal('foo');
    const [getE, setE] = createSignal(true);

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

    const [, unsubscribe] = createEffect(() => {
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
    expect(secondEffectCallCount).toBe(1);
    expect(thirdEffectCallCount).toBe(2);
    expect(a).toBeCalledTimes(4);
    expect(b).toBeCalledTimes(2);
    expect(c).toBeCalledTimes(3);
    expect(d).toBeCalledTimes(1);
    expect(e).toBeCalledTimes(2);
    clearAllMocks();

    setB('def');

    expect(firstEffectCallCount).toBe(1);
    expect(secondEffectCallCount).toBe(2);
    expect(thirdEffectCallCount).toBe(2);
    expect(a).toBeCalledTimes(4);
    expect(b).toBeCalledTimes(3);
    expect(c).toBeCalledTimes(3);
    expect(d).toBeCalledTimes(2);
    expect(e).toBeCalledTimes(2);
    clearAllMocks();

    setC('B');

    expect(firstEffectCallCount).toBe(1);
    expect(secondEffectCallCount).toBe(1);
    expect(thirdEffectCallCount).toBe(2);
    expect(a).toBeCalledTimes(4);
    expect(b).toBeCalledTimes(2);
    expect(c).toBeCalledTimes(3);
    expect(d).toBeCalledTimes(1);
    expect(e).toBeCalledTimes(2);
    clearAllMocks();

    setD('bar');

    expect(firstEffectCallCount).toBe(0);
    expect(secondEffectCallCount).toBe(1);
    expect(thirdEffectCallCount).toBe(1);
    expect(a).toBeCalledTimes(1);
    expect(b).toBeCalledTimes(1);
    expect(c).toBeCalledTimes(1);
    expect(d).toBeCalledTimes(1);
    expect(e).toBeCalledTimes(1);
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

    unsubscribe();

    expect(destroyEffectMock).toBeCalledTimes(3);
  });
});
