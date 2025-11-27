import {on} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './assert-helpers.js';
import {DESTROY, MUTE, UNMUTE, VALUE} from './constants.js';
import {createSignal, destroySignal, link, touch, unlink} from './index.js';

describe('connect signals', () => {
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

  it('connect a signal with another signal (naive version)', () => {
    const {get: sigA, set: setA} = createSignal(0);
    const {get: sigB, set: setB} = createSignal('foo');
    const {get: sigC, set: setC} = createSignal(-1);

    expect(sigA()).toBe(0);
    expect(sigB()).toBe('foo');
    expect(sigC()).toBe(-1);

    sigA((value) => setB(`foo:${value}`));
    sigA(setC);

    expect(sigA()).toBe(0);
    expect(sigB()).toBe('foo');
    expect(sigC()).toBe(-1);

    setA(1);

    expect(sigB()).toBe('foo:1');
    expect(sigC()).toBe(1);

    setA(2);

    expect(sigB()).toBe('foo:2');
    expect(sigC()).toBe(2);

    // works great, but how can you disconnect these connections without destroying the signal?

    destroySignal(sigA, sigB, sigC);
  });

  it('connect a signal with another signal (this time with the link() api)', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB, set: setB} = createSignal(-1);

    const valueMock = jest.fn();
    const destroyMock = jest.fn();

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(-1);

    const con = link(sigA, sigB);

    on(con, {
      [VALUE]: valueMock,
      [DESTROY]: destroyMock,
    });

    // when we create a connection between two signals, the value of the source signal is immediately written to the target signal !!

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(1);

    expect(valueMock).toHaveBeenCalledTimes(0);
    // expect(valueMock).toHaveBeenCalledWith(1);
    // valueMock.mockClear();

    setB(100);

    expect(sigB()).toBe(100);
    expect(valueMock).toHaveBeenCalledTimes(0);

    setA(2);

    expect(sigA()).toBe(2);
    expect(sigB()).toBe(2);

    expect(valueMock).toHaveBeenCalledTimes(1);
    expect(valueMock).toHaveBeenCalledWith(2);
    expect(destroyMock).toHaveBeenCalledTimes(0);

    con.destroy();

    expect(con.isDestroyed).toBe(true);
    expect(destroyMock).toHaveBeenCalledTimes(1);

    setA(3);

    expect(sigA()).toBe(3);
    expect(sigB()).toBe(2);

    setB(101);

    expect(sigB()).toBe(101);

    destroySignal(sigA, sigB);
  });

  it('connect a signal with a function', () => {
    const {get: sigA, set: setA} = createSignal(1);

    const bMock = jest.fn();

    expect(sigA()).toBe(1);
    expect(bMock).toHaveBeenCalledTimes(0);

    link(sigA, bMock);
    expect(bMock).toHaveBeenCalledWith(1);

    expect(link(sigA, bMock)).toBe(link(sigA, bMock));
    expect(bMock).toHaveBeenCalledTimes(1);

    setA(2);

    expect(sigA()).toBe(2);
    expect(bMock).toHaveBeenCalledWith(2);

    destroySignal(sigA);
  });

  it('a link between two points is a singleton and cannot be created more than once', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(-1);

    const con0 = link(sigA, sigB);
    const con1 = link(sigA, sigB);

    expect(con0).toBe(con1);

    setA(666);

    expect(sigB()).toBe(666);

    unlink(sigA, sigB);

    setA(42);

    expect(sigA()).toBe(42);
    expect(sigB()).toBe(666);

    destroySignal(sigA, sigB);
  });

  it('a link should be pauseable (mute/unmute)', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

    const muteMock = jest.fn();
    const unmuteMock = jest.fn();

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(-1);

    const con = link(sigA, sigB);

    on(con, {
      [MUTE]: muteMock,
      [UNMUTE]: unmuteMock,
    });

    expect(con.isMuted).toBe(false);

    setA(666);

    expect(sigB()).toBe(666);

    con.mute();

    setA(42);

    expect(sigA()).toBe(42);
    expect(sigB()).toBe(666);

    expect(muteMock).toHaveBeenCalledTimes(1);
    expect(unmuteMock).toHaveBeenCalledTimes(0);

    con.unmute();

    setA(123);

    expect(sigA()).toBe(123);
    expect(sigB()).toBe(123);

    expect(muteMock).toHaveBeenCalledTimes(1);
    expect(unmuteMock).toHaveBeenCalledTimes(1);

    con.toggleMute();

    setA(7);

    expect(sigA()).toBe(7);
    expect(sigB()).toBe(123);

    expect(muteMock).toHaveBeenCalledTimes(2);
    expect(unmuteMock).toHaveBeenCalledTimes(1);

    destroySignal(sigA, sigB);
  });

  it('toggleMute() should toggle between muted and unmuted states', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

    const muteMock = jest.fn();
    const unmuteMock = jest.fn();

    const con = link(sigA, sigB);

    on(con, {
      [MUTE]: muteMock,
      [UNMUTE]: unmuteMock,
    });

    expect(con.isMuted).toBe(false);

    // Toggle from unmuted -> muted
    let result = con.toggleMute();
    expect(result).toBe(true);
    expect(con.isMuted).toBe(true);
    expect(muteMock).toHaveBeenCalledTimes(1);
    expect(unmuteMock).toHaveBeenCalledTimes(0);

    // Verify link is muted - changes should not propagate
    setA(100);
    expect(sigA()).toBe(100);
    expect(sigB()).toBe(1); // Should remain at initial synced value

    // Toggle from muted -> unmuted
    result = con.toggleMute();
    expect(result).toBe(false);
    expect(con.isMuted).toBe(false);
    expect(muteMock).toHaveBeenCalledTimes(1);
    expect(unmuteMock).toHaveBeenCalledTimes(1);

    // Verify link is unmuted - changes should propagate
    setA(200);
    expect(sigA()).toBe(200);
    expect(sigB()).toBe(200);

    // Multiple toggles in sequence
    con.toggleMute(); // muted
    con.toggleMute(); // unmuted
    con.toggleMute(); // muted
    expect(con.isMuted).toBe(true);
    expect(muteMock).toHaveBeenCalledTimes(3);
    expect(unmuteMock).toHaveBeenCalledTimes(2);

    destroySignal(sigA, sigB);
  });

  it('toggleMute() should do nothing when link is destroyed', () => {
    const {get: sigA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

    const muteMock = jest.fn();
    const unmuteMock = jest.fn();

    const con = link(sigA, sigB);

    on(con, {
      [MUTE]: muteMock,
      [UNMUTE]: unmuteMock,
    });

    con.destroy();

    expect(con.isDestroyed).toBe(true);

    // toggleMute should have no effect on destroyed link
    const result = con.toggleMute();
    expect(result).toBe(false); // Returns current muted state (false)
    expect(muteMock).toHaveBeenCalledTimes(0);
    expect(unmuteMock).toHaveBeenCalledTimes(0);

    destroySignal(sigA, sigB);
  });

  it('if the signal is destroyed, all connections from this signal should be disconnected automatically', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);
    const {get: sigC} = createSignal(-1);

    const con0 = link(sigA, sigB);
    const con1 = link(sigA, sigC);

    const destroyMock = jest.fn();

    on(con0, DESTROY, destroyMock);
    on(con1, DESTROY, destroyMock);

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

    expect(destroyMock).toHaveBeenCalledTimes(2);
  });

  it('a connection should have a touch() feature just like signal does', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB, set: setB} = createSignal(0);

    const valueMock = jest.fn();
    const callingB = jest.fn();

    sigB(callingB);

    expect(callingB).toHaveBeenCalledTimes(0);

    setB(-1);

    expect(callingB).toHaveBeenCalledTimes(1);
    expect(callingB).toHaveBeenCalledWith(-1);

    const con = link(sigA, sigB);

    on(con, VALUE, valueMock);

    expect(callingB).toHaveBeenCalledTimes(2);
    expect(valueMock).toHaveBeenCalledTimes(0);

    setA(666);

    expect(sigA()).toBe(666);
    expect(sigB()).toBe(666);
    expect(callingB).toHaveBeenCalledTimes(3);
    expect(callingB).toHaveBeenCalledWith(666);
    expect(valueMock).toHaveBeenCalledTimes(1);
    expect(valueMock).toHaveBeenCalledWith(666);

    setA(666);

    expect(callingB).toHaveBeenCalledTimes(3);
    expect(valueMock).toHaveBeenCalledTimes(1);

    con.touch();

    expect(sigB()).toBe(666);
    expect(callingB).toHaveBeenCalledTimes(4);
    expect(valueMock).toHaveBeenCalledTimes(2);

    destroySignal(sigA, sigB);
  });

  it('if a signal is touched, then all connections should also be touched', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);
    const {get: sigC} = createSignal(-1);

    const callingB = jest.fn();
    const callingC = jest.fn();

    sigB(callingB);
    sigB(callingC);

    expect(callingB).toHaveBeenCalledTimes(0);
    expect(callingC).toHaveBeenCalledTimes(0);

    link(sigA, sigB);
    link(sigA, sigC);

    expect(callingB).toHaveBeenCalledTimes(1);
    expect(callingC).toHaveBeenCalledTimes(1);

    setA(666);

    expect(sigA()).toBe(666);
    expect(sigB()).toBe(666);
    expect(sigC()).toBe(666);

    expect(callingB).toHaveBeenCalledTimes(2);
    expect(callingB).toHaveBeenCalledWith(666);

    expect(callingC).toHaveBeenCalledTimes(2);
    expect(callingC).toHaveBeenCalledWith(666);

    setA(666);

    expect(callingB).toHaveBeenCalledTimes(2);
    expect(callingC).toHaveBeenCalledTimes(2);

    touch(sigA);

    expect(sigB()).toBe(666);
    expect(callingB).toHaveBeenCalledTimes(3);

    expect(sigC()).toBe(666);
    expect(callingC).toHaveBeenCalledTimes(3);

    destroySignal(sigA, sigB, sigC);
  });
});
