import {batch} from './batch.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects-api.js';

describe('batch', () => {
  it('delay the effect callback execution until the batch callback finished', () => {
    const {get: a, set: setA} = createSignal(123);
    const {get: b, set: setB} = createSignal('abc');

    const valA = jest.fn();
    const valB = jest.fn();

    let effectCallCount0 = 0;
    let effectCallCount1 = 0;

    createEffect(() => {
      ++effectCallCount0;
      valA(a());
      valB(b());
    });

    createEffect(() => {
      ++effectCallCount1;
      valB(b());
    });

    expect(effectCallCount0).toBe(1);
    expect(effectCallCount1).toBe(1);
    expect(valA).toBeCalledWith(123);
    expect(valB).toBeCalledWith('abc');

    effectCallCount0 = 0;
    effectCallCount1 = 0;
    let batchCallCount = 0;

    batch(() => {
      ++batchCallCount;
      setA(456);
      expect(a()).toBe(456);
      setB('def');
    });

    expect(batchCallCount).toBe(1);
    expect(effectCallCount0).toBe(1);
    expect(effectCallCount1).toBe(1);
    expect(valA).toBeCalledWith(456);
    expect(valB).toBeCalledWith('def');

    setB('plah!');

    expect(batchCallCount).toBe(1);
    expect(effectCallCount0).toBe(2);
    expect(effectCallCount1).toBe(2);
    expect(valA).toBeCalledWith(456);
    expect(valB).toBeCalledWith('plah!');
  });

  it('nested effects work as expected', () => {
    const {get: a, set: setA} = createSignal(123);
    const {get: b, set: setB} = createSignal('abc');
    const {get: c, set: setC} = createSignal(23);

    const valA = jest.fn();
    const valB = jest.fn();
    const valC = jest.fn();

    let effectCallCount = 0;

    createEffect(() => {
      ++effectCallCount;
      valA(a());
      valB(b());
      valC(c());
    });

    expect(effectCallCount).toBe(1);
    expect(valA).toBeCalledWith(123);
    expect(valB).toBeCalledWith('abc');
    expect(valC).toBeCalledWith(23);

    effectCallCount = 0;
    let batchCallCount0 = 0;
    let batchCallCount1 = 0;

    batch(() => {
      ++batchCallCount0;

      setA(456);
      expect(a()).toBe(456);
      expect(valA).toBeCalledWith(123);

      batch(() => {
        ++batchCallCount1;

        setB('aaa');
        expect(b()).toBe('aaa');
        expect(valB).toBeCalledWith('abc');

        setC(42);
        expect(c()).toBe(42);
        expect(valC).toBeCalledWith(23);
      });

      setB('def');
      expect(b()).toBe('def');
      expect(valB).toBeCalledWith('abc');
    });

    expect(batchCallCount0).toBe(1);
    expect(batchCallCount1).toBe(1);
    expect(effectCallCount).toBe(1);
    expect(valA).toBeCalledWith(456);
    expect(valB).toBeCalledWith('def');
    expect(valC).toBeCalledWith(42);

    effectCallCount = 0;

    setB('end');

    expect(effectCallCount).toBe(1);
    expect(valB).toBeCalledWith('end');
  });
});
