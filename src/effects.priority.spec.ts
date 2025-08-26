import {assertEffectsCount} from './assert-helpers.js';
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  destroySignal,
} from './index.js';

describe('Effect priority', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
  });

  it('prioritized memos should run before others', () => {
    const a = createSignal(1);
    const c = createSignal(0);

    const callQueue: string[] = [];

    const memoCallback = jest.fn(() => {
      callQueue.push('m');
      return a.get() + 10;
    });
    const m = createMemo(memoCallback);

    const effectCallback = jest.fn(() => {
      callQueue.push('e');
      c.set(m() + a.get());
    });
    createEffect(effectCallback);

    expect(c.value).toBe(12);
    expect(memoCallback).toHaveBeenCalledTimes(1);
    expect(effectCallback).toHaveBeenCalledTimes(1);
    expect(callQueue).toEqual(['m', 'e']);

    callQueue.length = 0;
    effectCallback.mockClear();
    memoCallback.mockClear();

    a.set(2);

    expect(c.value).toBe(14);
    expect(memoCallback).toHaveBeenCalledTimes(1);
    // called 1x after a.set(2), 1x after m changed
    expect(effectCallback).toHaveBeenCalledTimes(2);
    expect(callQueue).toEqual(['m', 'e', 'e']);

    callQueue.length = 0;
    effectCallback.mockClear();
    memoCallback.mockClear();

    batch(() => {
      a.set(3);
    });

    expect(c.value).toBe(16);
    expect(memoCallback).toHaveBeenCalledTimes(1);
    expect(effectCallback).toHaveBeenCalledTimes(1);
    expect(callQueue).toEqual(['m', 'e']);

    destroySignal(a, c, m);
  });

  it('prioritized effects should run in order', () => {
    const a = createSignal(1);
    const c = createSignal(0);

    const callQueue: number[] = [];

    const effFn0 = jest.fn(() => {
      callQueue.push(0);
      c.set(a.get());
    });

    const effFn1 = jest.fn(() => {
      callQueue.push(1);
      c.set(a.get() + 10);
    });

    const effFn2 = jest.fn(() => {
      callQueue.push(2);
      c.set(a.get() + 100);
    });

    createEffect(effFn0, {priority: -100});
    createEffect(effFn1, {priority: 1000});
    createEffect(effFn2);

    expect(c.value).toBe(101);

    expect(callQueue).toEqual([0, 1, 2]);

    callQueue.length = 0;

    a.set(2);

    expect(c.value).toBe(2);
    expect(callQueue).toEqual([1, 2, 0]);

    destroySignal(a, c);
  });
});
