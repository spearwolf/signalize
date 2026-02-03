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
  });
});
