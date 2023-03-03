import {getSubscriptionCount} from '@spearwolf/eventize';
import {createEffect} from './createEffect';
import {createMemo} from './createMemo';
import {createSignal, destroySignal} from './createSignal';
import {globalDestroySignalQueue, globalEffectQueue} from './globalQueues';

let g_initialEffectCount = 0;
let g_effectCount = 0;

const saveEffectsCount = (initial?: boolean) => {
  g_effectCount = getSubscriptionCount(globalEffectQueue);
  if (initial) {
    g_initialEffectCount = g_effectCount;
  }
  return g_effectCount;
}

function assertEffectsCountChange(deltaCount: number) {
  const beforeCount = g_effectCount;
  const count = saveEffectsCount();
  expect(
    count,
    `Effects count change delta should be ${deltaCount} but is ${(beforeCount - g_initialEffectCount) - (count - g_initialEffectCount)}`
  ).toBe(beforeCount + deltaCount);
};

function assertEffectsCount(count: number) {
  expect(
    saveEffectsCount() - g_initialEffectCount,
    `Effects count should be ${count} but is ${g_effectCount - g_initialEffectCount}`
  ).toBe(count);
};

let g_signalDestroySubscriptionsCount = 0;

const saveSignalDestroySubscriptionsCount = () => {
  g_signalDestroySubscriptionsCount = getSubscriptionCount(globalDestroySignalQueue);
  return g_signalDestroySubscriptionsCount;
}

function assertSignalDestroySubscriptionsCountChange(deltaCount: number) {
  const beforeCount = g_signalDestroySubscriptionsCount;
  const count = saveSignalDestroySubscriptionsCount();
  expect(count).toBe(beforeCount + deltaCount);
};

describe('destroySignal', () => {
  beforeEach(() => {
    saveEffectsCount(true);
    saveSignalDestroySubscriptionsCount();
  });

  afterEach(() => {
    // assertEffectsCount(0);
    // assertSignalDestroySubscriptionsCount(0);
  });

  it('destroy signal reader callback effect', () => {
    const [sigFoo, setFoo] = createSignal(666);

    let foo = 0;

    sigFoo((val) => {
      foo = val;
    });

    expect(foo).toBe(666);

    assertEffectsCountChange(1);
    assertSignalDestroySubscriptionsCountChange(1);

    setFoo(23);

    expect(foo).toBe(23);

    destroySignal(sigFoo);
    setFoo(512);

    expect(foo).toBe(23);

    assertEffectsCountChange(-1);
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

    assertEffectsCountChange(1);
    assertSignalDestroySubscriptionsCountChange(2);

    const plah = createMemo(() => {
      ++memoCallCount;
      return getFoo() + getBar();
    });

    assertEffectsCountChange(1);
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

    assertEffectsCountChange(0);
    // assertEffectsCount(2);
    assertSignalDestroySubscriptionsCountChange(-2);

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

    assertSignalDestroySubscriptionsCountChange(-2);

    destroySignal(plah);

    assertSignalDestroySubscriptionsCountChange(-1);
  });
});
