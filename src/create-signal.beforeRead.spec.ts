import type {MockInstance} from 'vitest';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {beQuiet} from './be-quiet.js';
import {createMemo} from './create-memo.js';
import {createSignal} from './create-signal.js';
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

  it('fires when reader is invoked with a callback', () => {
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

  it('hands the onChange callback a value the hook has refreshed', () => {
    let external = 1;
    const sig = createSignal(0, {
      beforeRead: () => {
        // A refresh at the read that announces nothing of its own — the
        // notification under test comes from the touch() below.
        beQuiet(() => {
          sig.set(external);
        });
      },
    });
    const seen: number[] = [];
    const unsubscribe = sig.onChange((v) => {
      seen.push(v);
    });

    try {
      external = 42;
      sig.touch();

      expect(seen).toEqual([42]);
    } finally {
      unsubscribe();
      destroySignal(sig);
    }
  });

  it('recomputes a lazy memo before the onChange callback reads it', () => {
    const a = createSignal(1);
    const memoReader = createMemo(() => a.get() * 2, {lazy: true});
    // The passthrough hands back the memo signal itself as a `Signal`
    // object — the way to reach `onChange()` on a memo.
    const memo = createSignal(memoReader);
    const seen: number[] = [];
    const unsubscribe = memo.onChange((v) => {
      seen.push(v);
    });

    try {
      a.set(5);
      memo.touch();

      expect(seen[0]).toBe(10);
    } finally {
      unsubscribe();
      destroySignal(a, memoReader);
    }
  });
});
