import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';

describe('unsubscribe as return function from effect callback', () => {
  it('should be called before recalling the effect callback', () => {
    const {get: a, set: setA} = createSignal(123);
    const {get: b, set: setB} = createSignal('abc');

    const valA = jest.fn();
    const valB = jest.fn();

    const unsubscribeA = jest.fn();
    const unsubscribeB = jest.fn();

    let effectCallCount0 = 0;
    let effectCallCount1 = 0;
    const subscriptionOrder: any[] = [];

    const clearAllMocks = () => {
      jest.clearAllMocks();
      effectCallCount0 = 0;
      effectCallCount1 = 0;
      subscriptionOrder.length = 0;
    };

    createEffect(() => {
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

    expect(effectCallCount0).toBe(1);
    expect(effectCallCount1).toBe(1);

    expect(valA).toBeCalledWith(123);
    expect(valB).toBeCalledWith('abc');

    expect(unsubscribeA).toBeCalledTimes(0);
    expect(unsubscribeB).toBeCalledTimes(0);

    clearAllMocks();

    setB('foo');

    expect(effectCallCount0).toBe(0);
    expect(effectCallCount1).toBe(1);

    expect(valA).toBeCalledTimes(0);
    expect(valB).toBeCalledWith('foo');

    expect(unsubscribeA).toBeCalledTimes(0);
    expect(unsubscribeB).toBeCalledWith('abc');

    expect(subscriptionOrder).toEqual(['abc']);

    clearAllMocks();

    setA(43);

    expect(effectCallCount0).toBe(1);
    expect(effectCallCount1).toBe(0);

    expect(valA).toBeCalledWith(43);
    // expect(valB).toBeCalledWith('foo');

    expect(unsubscribeA).toBeCalledWith(123);
    // expect(unsubscribeB).toBeCalledWith('foo');

    // expect(subscriptionOrder).toEqual([123, 'foo']);
    expect(subscriptionOrder).toEqual([123]);
  });
});
