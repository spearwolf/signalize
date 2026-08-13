import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './create-signal.js';
import {createEffect} from './effects.js';
import {destroySignal, muteSignal, unmuteSignal} from './signal-core.js';

// Muting cuts the messenger, not the ledger: the value is written either way,
// only the horn that calls the effects stays silent.
describe('writes on muted or destroyed signals', () => {
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

  it('set() on a muted signal stores the value but does not notify', () => {
    const sig = createSignal(1);
    const onChange = vi.fn();
    const unsubscribe = sig.onChange(onChange);

    try {
      muteSignal(sig);
      sig.set(2);

      expect(onChange).not.toHaveBeenCalled();

      // the write itself happened — untracked and tracked reads both see it
      expect(sig.value).toBe(2);
      expect(sig.get()).toBe(2);
    } finally {
      unsubscribe();
      destroySignal(sig);
    }
  });

  it('an effect reading a muted signal sees the new value on its next run', () => {
    const sig = createSignal(1);
    const other = createSignal('a');

    const seen: Array<[number, string]> = [];
    const effect = createEffect(() => {
      seen.push([sig.get(), other.get()]);
    });

    try {
      expect(seen).toEqual([[1, 'a']]);

      muteSignal(sig);
      sig.set(2);

      // sig did not trigger a rerun ...
      expect(seen).toEqual([[1, 'a']]);

      // ... but when something else does, the value is already 2
      other.set('b');

      expect(seen).toEqual([
        [1, 'a'],
        [2, 'b'],
      ]);
    } finally {
      effect.destroy();
      destroySignal(sig, other);
    }
  });

  it('unmute does not replay the write that happened while muted', () => {
    const sig = createSignal(1);
    const onChange = vi.fn();
    const unsubscribe = sig.onChange(onChange);

    try {
      muteSignal(sig);
      sig.set(2);
      unmuteSignal(sig);

      expect(onChange).not.toHaveBeenCalled();

      // writing the same value again is equal to the stored 2 → still silent
      sig.set(2);
      expect(onChange).not.toHaveBeenCalled();

      // touch() is the way out
      sig.touch();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(2);

      // and a genuinely new value notifies normally again
      sig.set(3);
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith(3);
    } finally {
      unsubscribe();
      destroySignal(sig);
    }
  });

  it('set(fn, {lazy: true}) on a muted signal defers and does not notify', () => {
    const sig = createSignal('a');
    const onChange = vi.fn();
    const unsubscribe = sig.onChange(onChange);

    const lazyFn = vi.fn(() => 'b');

    try {
      muteSignal(sig);
      sig.set(lazyFn, {lazy: true});

      expect(onChange).not.toHaveBeenCalled();
      expect(lazyFn).not.toHaveBeenCalled();

      expect(sig.value).toBe('b');
      expect(lazyFn).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      destroySignal(sig);
    }
  });

  it('set() on a destroyed signal stores the value but does not notify', () => {
    const sig = createSignal(1);
    const onChange = vi.fn();
    const unsubscribe = sig.onChange(onChange);

    try {
      sig.set(2);
      expect(onChange).toHaveBeenCalledTimes(1);

      unsubscribe();
      destroySignal(sig);

      sig.set(99);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(sig.value).toBe(99);
      expect(sig.get()).toBe(99);

      // a destroyed signal stays destroyed — unmute cannot revive it
      unmuteSignal(sig);
      sig.set(100);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(sig.value).toBe(100);
    } finally {
      unsubscribe();
      destroySignal(sig);
    }
  });

  it('Signal#muted reads and writes the same flag as muteSignal()/unmuteSignal()', () => {
    const sig = createSignal(1);
    const onChange = vi.fn();
    const unsubscribe = sig.onChange(onChange);

    try {
      expect(sig.muted).toBe(false);

      sig.muted = true;
      expect(sig.muted).toBe(true);

      sig.set(2);
      sig.touch(); // touch() is suppressed on a muted signal too
      expect(onChange).not.toHaveBeenCalled();

      // the free functions and the accessor read and write the same flag
      unmuteSignal(sig);
      expect(sig.muted).toBe(false);
      muteSignal(sig);
      expect(sig.muted).toBe(true);

      sig.muted = false;
      expect(sig.muted).toBe(false);

      // now touch() gets through and pushes the value written while muted
      sig.touch();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(2);
    } finally {
      unsubscribe();
      destroySignal(sig);
    }
  });

  it('muteSignal() on a value that is not a signal is a no-op, not a throw (TEST-026)', () => {
    expect(() => muteSignal(undefined)).not.toThrow();
    expect(() => muteSignal(null)).not.toThrow();
  });

  it('unmuteSignal() on a value that is not a signal is a no-op, not a throw (TEST-026)', () => {
    expect(() => unmuteSignal(undefined)).not.toThrow();
    expect(() => unmuteSignal(null)).not.toThrow();
  });

  it('touch() on a destroyed signal does not notify', () => {
    const sig = createSignal(1);
    const onChange = vi.fn();
    const unsubscribe = sig.onChange(onChange);

    try {
      sig.set(2);
      expect(onChange).toHaveBeenCalledTimes(1);

      destroySignal(sig);

      sig.touch();
      expect(onChange).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      destroySignal(sig);
    }
  });
});
