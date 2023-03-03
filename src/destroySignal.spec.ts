import {
  assertEffectsCount,
  assertEffectSubscriptionsCount,
  assertEffectSubscriptionsCountChange,
  assertSignalDestroySubscriptionsCount,
  assertSignalDestroySubscriptionsCountChange,
  saveEffectSubscriptionsCount,
  saveSignalDestroySubscriptionsCount,
} from './assert-helpers';
import {createEffect} from './createEffect';
import {createMemo} from './createMemo';
import {createSignal, destroySignal} from './createSignal';

describe('destroySignal', () => {
  beforeEach(() => {
    assertEffectsCount(0);
    saveEffectSubscriptionsCount(true);
    saveSignalDestroySubscriptionsCount(true);
  });

  afterEach(() => {
    assertEffectsCount(0);
    assertEffectSubscriptionsCount(0);
    assertSignalDestroySubscriptionsCount(0);
  });

  it('destroy signal reader callback effect', () => {
    const [sigFoo, setFoo] = createSignal(666);

    let foo = 0;

    sigFoo((val) => {
      foo = val;
    });

    expect(foo).toBe(666);

    assertEffectsCount(1);
    assertEffectSubscriptionsCountChange(1);
    assertSignalDestroySubscriptionsCountChange(1);

    setFoo(23);

    expect(foo).toBe(23);

    destroySignal(sigFoo);
    setFoo(512);

    expect(foo).toBe(23);

    assertEffectsCount(0);
    assertEffectSubscriptionsCountChange(-1);
    assertSignalDestroySubscriptionsCountChange(-1);
  });

  it('destroy signal destroys effects and memos', () => {
    const [getFoo, setFoo] = createSignal(1);
    const [getBar, setBar] = createSignal(2);

    let foo = 0;
    let bar = 0;

    let effectCallCount = 0;
    let memoCallCount = 0;

    createEffect(() => {
      foo = getFoo();
      bar = getBar();
      ++effectCallCount;
    });

    assertEffectsCount(1);
    assertEffectSubscriptionsCountChange(1);
    assertSignalDestroySubscriptionsCountChange(2);

    const plah = createMemo(() => {
      ++memoCallCount;
      return getFoo() + getBar();
    });

    assertEffectsCount(2);
    assertEffectSubscriptionsCountChange(1);
    assertSignalDestroySubscriptionsCountChange(3);

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

    assertEffectsCount(2);
    assertEffectSubscriptionsCount(0);
    assertSignalDestroySubscriptionsCountChange(-2);

    setFoo(10);
    setBar(11);

    expect(foo).toBe(10);
    expect(bar).toBe(11);
    expect(plah()).toBe(21);
    expect(effectCallCount).toBe(4);
    expect(memoCallCount).toBe(4);

    assertEffectsCount(2);
    assertEffectSubscriptionsCount(0);

    destroySignal(getBar);

    setFoo(22);
    setBar(23);

    expect(foo).toBe(10);
    expect(bar).toBe(11);
    expect(plah()).toBe(21);
    expect(effectCallCount).toBe(4);
    expect(memoCallCount).toBe(4);

    assertEffectsCount(0);
    assertEffectSubscriptionsCount(0);
    assertSignalDestroySubscriptionsCountChange(-2);

    destroySignal(plah);

    assertEffectsCount(0);
    assertEffectSubscriptionsCount(0);
    assertSignalDestroySubscriptionsCountChange(-1);
  });
});
