import {assertEffectsCount, assertSignalsCount} from './assert-helpers';
import {createSignal, destroySignal} from './createSignal';

describe('connect signals', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
  });

  it('connect a signal with another signal (naive version)', () => {
    const [sigA, setA] = createSignal(1);
    const [sigB, setB] = createSignal('foo');
    const [sigC, setC] = createSignal(-1);

    expect(sigA()).toBe(1);
    expect(sigB()).toBe('foo');
    expect(sigC()).toBe(-1);

    sigA((value) => setB(`foo:${value}`));
    sigA(setC);

    expect(sigB()).toBe('foo:1');
    expect(sigC()).toBe(1);

    setA(2);

    expect(sigB()).toBe('foo:2');
    expect(sigC()).toBe(2);

    // XXX works great, but how can you disconnect these connections without destroying the signal?

    destroySignal(sigA, sigB, sigC);
  });
});

// TODO I would like to make a connection from a signal to ..
// - another signal
// - a function

// TODO I would like to disconnect a signal connection without destroying the signal

// TODO If the signal is destroyed, all signal connections from this signal should be disconnected automatically

// TODO The target (another signal, function ..) of a signal connection should be dynamically changeable

// TODO A signal connection should be pausable (mute/unmute)
