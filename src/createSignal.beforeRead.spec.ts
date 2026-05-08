import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
import {createSignal, destroySignal} from './createSignal.js';

describe('createSignal({beforeRead})', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
  });

  it('fires before each plain read', () => {
    const beforeRead = jest.fn();
    const sig = createSignal(1, {beforeRead});

    expect(beforeRead).not.toHaveBeenCalled();

    sig.get();
    expect(beforeRead).toHaveBeenCalledTimes(1);

    sig.get();
    sig.get();
    expect(beforeRead).toHaveBeenCalledTimes(3);

    destroySignal(sig);
  });

  it('fires when reader is invoked with a callback (regression for #2.1)', () => {
    const beforeRead = jest.fn();
    const sig = createSignal(1, {beforeRead});

    expect(beforeRead).not.toHaveBeenCalled();

    // The reader-with-callback form must also trigger beforeRead.
    sig.get((_val) => {});

    expect(beforeRead).toHaveBeenCalledTimes(1);

    destroySignal(sig);
  });

  it('does NOT fire on .value property read (untracked)', () => {
    const beforeRead = jest.fn();
    const sig = createSignal(42, {beforeRead});

    // .value is the untracked path — beforeRead is a read-tracking concern,
    // and value() unwraps without going through the reader function.
    void sig.value;

    expect(beforeRead).not.toHaveBeenCalled();

    destroySignal(sig);
  });

  it('is cleared on destroy', () => {
    const beforeRead = jest.fn();
    const sig = createSignal(1, {beforeRead});

    sig.get();
    expect(beforeRead).toHaveBeenCalledTimes(1);

    destroySignal(sig);

    // After destroy the reader is a no-op; beforeRead must not be invoked.
    sig.get();
    expect(beforeRead).toHaveBeenCalledTimes(1);
  });
});
