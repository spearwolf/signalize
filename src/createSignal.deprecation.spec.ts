import type {MockInstance} from 'vitest';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './createSignal.js';
import {destroySignal} from './signal-core.js';

describe('signalReader(callback) deprecation warning', () => {
  let warnSpy: MockInstance;

  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  it('warns exactly once and recommends Signal.onChange', () => {
    const sig = createSignal(1);
    try {
      sig.get(() => {});

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const message = warnSpy.mock.calls[0][0] as string;
      expect(message).toMatch(/deprecated/i);
      expect(message).toMatch(/Signal\.onChange/);
    } finally {
      destroySignal(sig);
    }
  });

  it('does not warn again on subsequent invocations (module-level once)', () => {
    // The previous test already triggered the once-only warning at module
    // scope. A fresh signal in this test must NOT warn again.
    const sig = createSignal('foo');
    try {
      sig.get(() => {});
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      destroySignal(sig);
    }
  });

  it('does not warn when the reader is invoked without a callback', () => {
    const sig = createSignal(42);
    try {
      void sig.get();
      void sig.get();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      destroySignal(sig);
    }
  });

  it('does not warn for Signal.onChange (the recommended path)', () => {
    const sig = createSignal(1);
    let unsubscribe: () => void = () => {};
    try {
      unsubscribe = sig.onChange(() => {});
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
      destroySignal(sig);
    }
  });
});
