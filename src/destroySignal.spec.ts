import {getSubscriptionCount} from '@spearwolf/eventize';
import {createEffect} from './createEffect';
import {createMemo} from './createMemo';
import {createSignal, destroySignal} from './createSignal';
import {globalDestroySignalQueue} from './globalQueues';

describe('destroySignal', () => {
  it('destroy signal reader callback effect', () => {
    const initialSignalQueueSubscriptionCount = getSubscriptionCount(
      globalDestroySignalQueue,
    );

    const [sigFoo, setFoo] = createSignal(666);

    let foo = 0;

    sigFoo((val) => {
      foo = val;
    });

    expect(foo).toBe(666);

    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      initialSignalQueueSubscriptionCount + 1,
    );

    setFoo(23);

    expect(foo).toBe(23);

    destroySignal(sigFoo);
    setFoo(512);

    expect(foo).toBe(23);

    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      initialSignalQueueSubscriptionCount,
    );
  });

  it('destroy signal destroys effects and memos', () => {
    const [getFoo, setFoo] = createSignal(1);
    const [getBar, setBar] = createSignal(2);

    let foo = 0;
    let bar = 0;

    let effectCallCount = 0;
    let memoCallCount = 0;

    const initialSignalQueueSubscriptionCount = getSubscriptionCount(
      globalDestroySignalQueue,
    );

    createEffect(() => {
      foo = getFoo();
      bar = getBar();
      ++effectCallCount;
    });

    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      initialSignalQueueSubscriptionCount + 2,
    );

    const plah = createMemo(() => {
      ++memoCallCount;
      return getFoo() + getBar();
    });

    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      initialSignalQueueSubscriptionCount + 4,
    );

    expect(foo).toBe(1);
    expect(bar).toBe(2);
    expect(plah()).toBe(3);
    expect(effectCallCount).toBe(1);
    expect(memoCallCount).toBe(1);

    setFoo(4);
    setBar(5);

    expect(foo).toBe(4);
    expect(bar).toBe(5);
    expect(plah()).toBe(9);
    expect(effectCallCount).toBe(3);
    expect(memoCallCount).toBe(3);

    destroySignal(getFoo);

    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      initialSignalQueueSubscriptionCount + 2,
    );

    setFoo(10);
    setBar(11);

    expect(foo).toBe(10);
    expect(bar).toBe(11);
    expect(plah()).toBe(21);
    expect(effectCallCount).toBe(4);
    expect(memoCallCount).toBe(4);

    destroySignal(getBar);
    setFoo(22);
    setBar(23);

    expect(foo).toBe(10);
    expect(bar).toBe(11);
    expect(plah()).toBe(21);
    expect(effectCallCount).toBe(4);
    expect(memoCallCount).toBe(4);

    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      initialSignalQueueSubscriptionCount,
    );
  });
});
