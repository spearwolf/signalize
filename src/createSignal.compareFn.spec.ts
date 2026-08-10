import type {MockInstance} from 'vitest';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './createSignal.js';
import {destroySignal} from './signal-core.js';
import {touch} from './touch.js';

describe('create signal with custom compare function', () => {
  let warnSpy: MockInstance;

  beforeAll(() => {
    // Silence the deprecation warning for signalReader(callback) used below.
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    warnSpy.mockRestore();
  });

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

  it('works as expected', () => {
    const mock = vi.fn();

    const {get: signal, set: setSignal} = createSignal([0, 0, 0], {
      compare: (a: number[], b: number[]) => a.every((v, i) => v === b[i]),
    });

    try {
      signal(mock);

      expect(mock).toHaveBeenCalledTimes(0);

      touch(signal);

      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock).toHaveBeenCalledWith([0, 0, 0]);

      setSignal([0, 0, 0]);

      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock).toHaveBeenCalledWith([0, 0, 0]);

      setSignal([1, 2, 3]);

      expect(mock).toHaveBeenCalledTimes(2);
      expect(mock).toHaveBeenCalledWith([1, 2, 3]);

      setSignal([4, 5, 6], {compare: () => true});

      expect(mock).toHaveBeenCalledTimes(2);
      expect(mock).toHaveBeenCalledWith([1, 2, 3]);

      setSignal(null, {compare: () => true});

      expect(mock).toHaveBeenCalledTimes(2);
      expect(mock).toHaveBeenCalledWith([1, 2, 3]);
    } finally {
      destroySignal(signal);
    }
  });
});
