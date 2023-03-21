import {connect, createSignal, destroySignal, touch, unconnect} from '.';
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

    // works great, but how can you disconnect these connections without destroying the signal?

    destroySignal(sigA, sigB, sigC);
  });

  it('connect a signal with another signal (with connect())', () => {
    const [sigA, setA] = createSignal(1);
    const [sigB, setB] = createSignal(-1);

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(-1);

    const con = connect(sigA, sigB);

    // when we create a connection between two signals, the value of the source signal is written to the target signal

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(1);

    setB(100);

    expect(sigB()).toBe(100);

    setA(2);

    expect(sigA()).toBe(2);
    expect(sigB()).toBe(2);

    con.destroy();

    setA(3);

    expect(sigA()).toBe(3);
    expect(sigB()).toBe(2);

    setB(101);

    expect(sigB()).toBe(101);

    destroySignal(sigA, sigB);
  });

  it('it should not be possible to connect two signals to each other more than once', () => {
    const [sigA, setA] = createSignal(1);
    const [sigB] = createSignal(-1);

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(-1);

    const con0 = connect(sigA, sigB);
    const con1 = connect(sigA, sigB);

    expect(con0).toBe(con1);

    setA(666);

    expect(sigB()).toBe(666);

    unconnect(sigA, sigB);

    setA(42);

    expect(sigA()).toBe(42);
    expect(sigB()).toBe(666);

    destroySignal(sigA, sigB);
  });

  it('a signal connection should be pausable (mute/unmute)', () => {
    const [sigA, setA] = createSignal(1);
    const [sigB] = createSignal(-1);

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(-1);

    const con = connect(sigA, sigB);

    expect(con.isMuted).toBe(false);

    setA(666);

    expect(sigB()).toBe(666);

    con.mute();

    setA(42);

    expect(sigA()).toBe(42);
    expect(sigB()).toBe(666);

    con.unmute();

    setA(123);

    expect(sigA()).toBe(123);
    expect(sigB()).toBe(123);

    con.toggle();

    setA(7);

    expect(sigA()).toBe(7);
    expect(sigB()).toBe(123);

    unconnect(sigA, sigB);
    destroySignal(sigA, sigB);
  });

  it('if the signal is destroyed, all signal connections from this signal should be disconnected automatically', () => {
    const [sigA, setA] = createSignal(1);
    const [sigB] = createSignal(-1);
    const [sigC] = createSignal(-1);

    const con0 = connect(sigA, sigB);
    const con1 = connect(sigA, sigC);

    setA(666);

    expect(sigA()).toBe(666);
    expect(sigB()).toBe(666);
    expect(sigC()).toBe(666);

    destroySignal(sigA);

    expect(con0.isDestroyed).toBe(true);
    expect(con1.isDestroyed).toBe(true);

    setA(42);

    expect(sigA()).toBe(42);
    expect(sigB()).toBe(666);
    expect(sigC()).toBe(666);

    destroySignal(sigB, sigC);
  });

  it('a signal connection should have a touch() feature just like signal does', () => {
    const [sigA, setA] = createSignal(1);
    const [sigB] = createSignal(-1);

    const callingB = jest.fn();
    sigB(callingB);

    expect(callingB).toHaveBeenCalledTimes(1);
    expect(callingB).toBeCalledWith(-1);

    const con = connect(sigA, sigB);

    expect(callingB).toHaveBeenCalledTimes(2);

    setA(666);

    expect(sigA()).toBe(666);
    expect(sigB()).toBe(666);
    expect(callingB).toHaveBeenCalledTimes(3);
    expect(callingB).toBeCalledWith(666);

    setA(666);

    expect(callingB).toHaveBeenCalledTimes(3);

    con.touch();

    expect(sigB()).toBe(666);
    expect(callingB).toHaveBeenCalledTimes(4);

    destroySignal(sigA, sigB);
  });

  it('if a signal is touched, then all connections should also be touched', () => {
    const [sigA, setA] = createSignal(1);
    const [sigB] = createSignal(-1);
    const [sigC] = createSignal(-1);

    const callingB = jest.fn();
    const callingC = jest.fn();

    sigB(callingB);
    sigB(callingC);

    expect(callingB).toHaveBeenCalledTimes(1);
    expect(callingC).toHaveBeenCalledTimes(1);
    expect(callingB).toBeCalledWith(-1);
    expect(callingC).toBeCalledWith(-1);

    connect(sigA, sigB);
    connect(sigA, sigC);

    expect(callingB).toHaveBeenCalledTimes(2);
    expect(callingC).toHaveBeenCalledTimes(2);

    setA(666);

    expect(sigA()).toBe(666);
    expect(sigB()).toBe(666);
    expect(sigC()).toBe(666);

    expect(callingB).toHaveBeenCalledTimes(3);
    expect(callingB).toBeCalledWith(666);

    expect(callingC).toHaveBeenCalledTimes(3);
    expect(callingC).toBeCalledWith(666);

    setA(666);

    expect(callingB).toHaveBeenCalledTimes(3);
    expect(callingC).toHaveBeenCalledTimes(3);

    touch(sigA);

    expect(sigB()).toBe(666);
    expect(callingB).toHaveBeenCalledTimes(4);

    expect(sigC()).toBe(666);
    expect(callingC).toHaveBeenCalledTimes(4);

    destroySignal(sigA, sigB, sigC);
  });
});
