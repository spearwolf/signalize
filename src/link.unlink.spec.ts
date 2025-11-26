import {on} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './assert-helpers.js';
import {DESTROY} from './constants.js';
import {createSignal, destroySignal, link, unlink} from './index.js';

describe('unlink()', () => {
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

  it('unlink a specific link between two signals', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(-1);

    const con = link(sigA, sigB);

    assertLinksCount(1, 'after link');

    expect(sigB()).toBe(1);

    setA(42);

    expect(sigA()).toBe(42);
    expect(sigB()).toBe(42);

    unlink(sigA, sigB);

    assertLinksCount(0, 'after unlink');
    expect(con.isDestroyed).toBe(true);

    setA(100);

    expect(sigA()).toBe(100);
    expect(sigB()).toBe(42); // should not update

    destroySignal(sigA, sigB);
  });

  it('unlink a specific link between signal and callback', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const callbackMock = jest.fn();

    link(sigA, callbackMock);

    expect(callbackMock).toHaveBeenCalledWith(1);
    expect(callbackMock).toHaveBeenCalledTimes(1);

    assertLinksCount(1, 'after link');

    setA(42);

    expect(callbackMock).toHaveBeenCalledWith(42);
    expect(callbackMock).toHaveBeenCalledTimes(2);

    unlink(sigA, callbackMock);

    assertLinksCount(0, 'after unlink');

    setA(100);

    expect(callbackMock).toHaveBeenCalledTimes(2); // should not be called again

    destroySignal(sigA);
  });

  it('unlink all links from a source signal', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);
    const {get: sigC} = createSignal(-2);
    const callbackMock = jest.fn();

    link(sigA, sigB);
    link(sigA, sigC);
    link(sigA, callbackMock);

    assertLinksCount(3, 'after links');

    expect(sigB()).toBe(1);
    expect(sigC()).toBe(1);
    expect(callbackMock).toHaveBeenCalledTimes(1);

    setA(42);

    expect(sigB()).toBe(42);
    expect(sigC()).toBe(42);
    expect(callbackMock).toHaveBeenCalledWith(42);
    expect(callbackMock).toHaveBeenCalledTimes(2);

    unlink(sigA);

    assertLinksCount(0, 'after unlink all');

    setA(100);

    expect(sigA()).toBe(100);
    expect(sigB()).toBe(42); // should not update
    expect(sigC()).toBe(42); // should not update
    expect(callbackMock).toHaveBeenCalledTimes(2); // should not be called again

    destroySignal(sigA, sigB, sigC);
  });

  it('unlink emits DESTROY event', () => {
    const {get: sigA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

    const destroyMock = jest.fn();

    const con = link(sigA, sigB);

    on(con, DESTROY, destroyMock);

    expect(destroyMock).toHaveBeenCalledTimes(0);

    unlink(sigA, sigB);

    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(con.isDestroyed).toBe(true);

    destroySignal(sigA, sigB);
  });

  it('unlink all links emits DESTROY event for all links', () => {
    const {get: sigA} = createSignal(1);
    const {get: sigB} = createSignal(-1);
    const {get: sigC} = createSignal(-2);

    const destroyMock = jest.fn();

    const con1 = link(sigA, sigB);
    const con2 = link(sigA, sigC);

    on(con1, DESTROY, destroyMock);
    on(con2, DESTROY, destroyMock);

    expect(destroyMock).toHaveBeenCalledTimes(0);

    unlink(sigA);

    expect(destroyMock).toHaveBeenCalledTimes(2);
    expect(con1.isDestroyed).toBe(true);
    expect(con2.isDestroyed).toBe(true);

    destroySignal(sigA, sigB, sigC);
  });

  it('unlink on non-existent link is a no-op', () => {
    const sigA = createSignal(1);
    const sigB = createSignal(-1);

    assertLinksCount(0, 'before unlink');

    // unlink without any links should not throw
    unlink(sigA.get, sigB.get);

    assertLinksCount(0, 'after unlink');

    destroySignal(sigA.get, sigB.get);
  });

  it('unlink all on source with no links is a no-op', () => {
    const sigA = createSignal(1);

    assertLinksCount(0, 'before unlink');

    // unlink without any links should not throw
    unlink(sigA.get);

    assertLinksCount(0, 'after unlink');

    destroySignal(sigA.get);
  });

  it('unlink one link while others remain', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);
    const {get: sigC} = createSignal(-2);

    link(sigA, sigB);
    link(sigA, sigC);

    assertLinksCount(2, 'after links');

    expect(sigB()).toBe(1);
    expect(sigC()).toBe(1);

    unlink(sigA, sigB);

    assertLinksCount(1, 'after unlink sigB');

    setA(42);

    expect(sigA()).toBe(42);
    expect(sigB()).toBe(1); // should not update
    expect(sigC()).toBe(42); // should update

    destroySignal(sigA, sigB, sigC);
  });

  it('unlink with signal reader (get function)', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

    link(sigA, sigB);

    assertLinksCount(1, 'after link');

    setA(42);

    expect(sigB()).toBe(42);

    // unlink using the reader functions
    unlink(sigA, sigB);

    assertLinksCount(0, 'after unlink');

    setA(100);

    expect(sigA()).toBe(100);
    expect(sigB()).toBe(42); // should not update

    destroySignal(sigA, sigB);
  });

  it('repeated unlink calls are safe', () => {
    const {get: sigA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

    const con = link(sigA, sigB);

    assertLinksCount(1, 'after link');

    unlink(sigA, sigB);

    assertLinksCount(0, 'after first unlink');
    expect(con.isDestroyed).toBe(true);

    // unlinking again should be safe
    unlink(sigA, sigB);

    assertLinksCount(0, 'after second unlink');

    destroySignal(sigA, sigB);
  });

  it('unlink specific target when multiple targets exist', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    link(sigA, callback1);
    link(sigA, callback2);

    assertLinksCount(2, 'after links');

    expect(callback1).toHaveBeenCalledWith(1);
    expect(callback2).toHaveBeenCalledWith(1);

    setA(42);

    expect(callback1).toHaveBeenCalledWith(42);
    expect(callback2).toHaveBeenCalledWith(42);
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(2);

    unlink(sigA, callback1);

    assertLinksCount(1, 'after unlink callback1');

    setA(100);

    expect(callback1).toHaveBeenCalledTimes(2); // should not be called again
    expect(callback2).toHaveBeenCalledWith(100);
    expect(callback2).toHaveBeenCalledTimes(3);

    destroySignal(sigA);
  });
});
