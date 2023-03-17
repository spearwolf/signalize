import {connect, createSignal, destroySignal} from '.';
import {assertEffectsCount, assertSignalsCount} from './assert-helpers';

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

  it('connect a signal with another signal (with connect())', () => {
    const [sigA, setA] = createSignal(1);
    const [sigB, setB] = createSignal(-1);

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(-1);

    const conn = connect(sigA, sigB);

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(-1);

    setB(100);

    expect(sigB()).toBe(100);

    setA(2);

    expect(sigA()).toBe(2);
    expect(sigB()).toBe(2);

    conn.destroy();

    setA(3);

    expect(sigA()).toBe(3);
    expect(sigB()).toBe(2);

    setB(101);

    expect(sigB()).toBe(101);

    destroySignal(sigA, sigB);
  });
});

// TODO I would like to make a connection from a signal to ..
// - [x] another signal
// - [ ] a function

// TODO I would like to disconnect a signal connection without destroying the signal

// TODO If the signal is destroyed, all signal connections from this signal should be disconnected automatically

// TODO The target (another signal, function ..) of a signal connection should be dynamically changeable

// TODO A signal connection should be pausable (mute/unmute)

// TODO A signal connection should be able to optionally _filter_ and _map_ the signal values

// TODO A signal connection should have a touch() feature just like signal does

// TODO A signal connection should have an optionally _queued_ mode, like the autorun:false feature of effects

// see also: https://doc.qt.io/qt-6/signalsandslots.html
