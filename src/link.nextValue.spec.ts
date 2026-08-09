import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal, destroySignal, link} from './index.js';

describe('link.nextValue', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  it('resolve to next value', async () => {
    const a = createSignal(23);
    const {get: getB} = createSignal(-77);

    try {
      const con = link(a, getB);

      expect(getB()).toBe(23);

      assertLinksCount(1, 'link(a, getB)');

      let nextValue = con.nextValue();

      a.set(42);

      await expect(nextValue).resolves.toBe(42);

      a.set(666);

      await expect(nextValue).resolves.toBe(42); // the value of the promise that has already been fulfilled should not change

      nextValue = con.nextValue(); /// 666 is past - we will wait for the next value

      a.set(100);

      await expect(nextValue).resolves.toBe(100);
    } finally {
      destroySignal(getB, a);
    }
  });

  it('reject next value when link is destroyed', async () => {
    const {get: getA} = createSignal(23);
    const b = createSignal(-77);

    try {
      const con = link(getA, b);

      expect(b.value).toBe(23);

      const nextValue = con.nextValue();

      assertLinksCount(1, 'link(getA, b) - before destroy');

      con.destroy();

      // ASYNC-004: a destroyed-while-pending nextValue() rejects with an
      // Error, not `undefined` — a caller catching it gets a message and a
      // stack instead of an unidentifiable rejection reason.
      await expect(nextValue).rejects.toThrow(
        'SignalLink destroyed before the next value arrived',
      );

      assertLinksCount(0, 'link(getA, b) - after destruction');
    } finally {
      destroySignal(b, getA);
    }
  });
});
