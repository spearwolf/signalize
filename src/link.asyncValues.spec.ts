/* eslint-disable no-async-promise-executor */
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './assert-helpers.js';
import {createSignal, destroySignal, link} from './index.js';

describe('link.asyncValues', () => {
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

  it('async values iteration', async () => {
    const a = createSignal(23);
    const b = createSignal(0);

    const con = link(a, b);

    expect(a.value).toBe(23);

    const result = new Promise(async (resolve) => {
      const values = [];

      for await (const val of con.asyncValues((_, i) => i >= 5)) {
        values.push(val);
        a.set(val + 1);
      }

      resolve(values);
    });

    a.set(1);

    await expect(result).resolves.toEqual([1, 2, 3, 4, 5]);

    destroySignal(a, b);
  });
});
