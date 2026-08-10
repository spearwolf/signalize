import type {MockInstance} from 'vitest';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './createSignal.js';
import {destroySignal} from './signal-core.js';

describe('createSignal({beforeRead})', () => {
  let warnSpy: MockInstance;

  beforeAll(() => {
    // Silence the deprecation warning emitted by signalReader(callback) below.
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

  it('fires before each plain read', () => {
    const beforeRead = vi.fn();
    const sig = createSignal(1, {beforeRead});

    try {
      expect(beforeRead).not.toHaveBeenCalled();

      sig.get();
      expect(beforeRead).toHaveBeenCalledTimes(1);

      sig.get();
      sig.get();
      expect(beforeRead).toHaveBeenCalledTimes(3);
    } finally {
      destroySignal(sig);
    }
  });

  it('fires when reader is invoked with a callback (regression for #2.1)', () => {
    const beforeRead = vi.fn();
    const sig = createSignal(1, {beforeRead});

    try {
      expect(beforeRead).not.toHaveBeenCalled();

      // The reader-with-callback form must also trigger beforeRead.
      sig.get((_val) => {});

      expect(beforeRead).toHaveBeenCalledTimes(1);
    } finally {
      destroySignal(sig);
    }
  });

  it('does NOT fire on .value property read (untracked)', () => {
    const beforeRead = vi.fn();
    const sig = createSignal(42, {beforeRead});

    // .value is the untracked path — beforeRead is a read-tracking concern,
    // and value() unwraps without going through the reader function.
    try {
      void sig.value;

      expect(beforeRead).not.toHaveBeenCalled();
    } finally {
      destroySignal(sig);
    }
  });

  it('is cleared on destroy', () => {
    const beforeRead = vi.fn();
    const sig = createSignal(1, {beforeRead});

    try {
      sig.get();
      expect(beforeRead).toHaveBeenCalledTimes(1);

      destroySignal(sig);

      // After destroy the reader is a no-op; beforeRead must not be invoked.
      sig.get();
      expect(beforeRead).toHaveBeenCalledTimes(1);
    } finally {
      destroySignal(sig);
    }
  });
});
