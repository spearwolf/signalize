import {
  assertEffectsCount,
  assertEffectSubscriptionsCount,
  assertEffectSubscriptionsCountChange,
  assertSignalDestroySubscriptionsCount,
  assertSignalDestroySubscriptionsCountChange,
  saveEffectSubscriptionsCount,
  saveSignalDestroySubscriptionsCount,
} from './assert-helpers.js';
import {batch} from './batch.js';
import {createMemo} from './createMemo.js';
import {createSignal, destroySignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {touch} from './touch.js';

describe('destroySignal', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    saveEffectSubscriptionsCount(true);
    saveSignalDestroySubscriptionsCount(true);
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertEffectSubscriptionsCount(0, 'afterEach');
    assertSignalDestroySubscriptionsCount(0, 'afterEach');
  });

  it('destroy signal reader callback effect', () => {
    const {get: sigFoo, set: setFoo} = createSignal(666);

    let foo = 0;

    sigFoo((val) => {
      foo = val;
    });

    expect(foo).toBe(0);

    touch(sigFoo);

    expect(foo).toBe(666);

    assertEffectsCount(1, 'step-a');
    assertEffectSubscriptionsCountChange(1, 'step-a');
    assertSignalDestroySubscriptionsCountChange(1);

    setFoo(23);

    expect(foo).toBe(23);

    destroySignal(sigFoo);
    setFoo(512);

    expect(foo).toBe(23);

    assertEffectsCount(0, 'end');
    assertEffectSubscriptionsCountChange(-1, 'end');
    assertSignalDestroySubscriptionsCountChange(-1);
  });

  it('destroy signal destroys effects and memos', () => {
    const {get: getFoo, set: setFoo} = createSignal(1);
    const {get: getBar, set: setBar} = createSignal(2);

    let foo = 0;
    let bar = 0;

    let effectCallCount = 0;
    let memoCallCount = 0;

    createEffect(() => {
      foo = getFoo();
      bar = getBar();
      ++effectCallCount;
    });

    assertEffectsCount(1, 'step-a');
    assertEffectSubscriptionsCountChange(1, 'step-a');
    assertSignalDestroySubscriptionsCountChange(2, 'step-a');

    const plah = createMemo(() => {
      ++memoCallCount;
      return getFoo() + getBar();
    });

    assertEffectsCount(2, 'step-b');
    assertEffectSubscriptionsCountChange(1, 'step-b');
    assertSignalDestroySubscriptionsCountChange(3, 'step-b');

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

    assertEffectsCount(2, 'step-c');
    assertEffectSubscriptionsCount(2, 'step-c');
    // assertSignalDestroySubscriptionsCountChange(-2, 'step-c');

    batch(() => {
      setFoo(10);
      setBar(11);
    });

    expect(foo).toBe(10);
    expect(bar).toBe(11);
    expect(plah()).toBe(21);
    expect(effectCallCount).toBe(4);
    expect(memoCallCount).toBe(4);

    assertEffectsCount(2, 'step-d');
    assertEffectSubscriptionsCount(2, 'step-d');

    destroySignal(getBar);

    batch(() => {
      setFoo(22);
      setBar(23);
    });

    expect(foo).toBe(10);
    expect(bar).toBe(11);
    expect(plah()).toBe(21);
    expect(effectCallCount).toBe(4);
    expect(memoCallCount).toBe(4);

    assertEffectsCount(0, 'step-e');
    assertEffectSubscriptionsCount(0, 'step-e');
    // assertSignalDestroySubscriptionsCountChange(-2, 'step-e');

    destroySignal(plah);

    assertEffectsCount(0, 'end');
    assertEffectSubscriptionsCount(0, 'end');
    // assertSignalDestroySubscriptionsCountChange(-1, 'end');
  });
});
