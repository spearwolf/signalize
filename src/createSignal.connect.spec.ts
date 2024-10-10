import {on} from '@spearwolf/eventize';
import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
import {signal} from './decorators.js';
import {
  Connection,
  connect,
  createSignal,
  destroyObjectSignals,
  destroySignal,
  touch,
  unconnect,
} from './index.js';

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

  it('connect a signal with another signal (this time with the connect() api)', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB, set: setB} = createSignal(-1);

    const valueMock = jest.fn();
    const destroyMock = jest.fn();

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(-1);

    const con = connect(sigA, sigB);

    on(con, {
      [Connection.Value]: valueMock,
      [Connection.Destroy]: destroyMock,
    });

    // when we create a connection between two signals, the value of the source signal is immediately written to the target signal !!

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(1);

    expect(valueMock).toHaveBeenCalledTimes(1);
    expect(valueMock).toHaveBeenCalledWith(1);
    valueMock.mockClear();

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

  it('connect a signal with another object signal', () => {
    const {get: sigA, set: setA} = createSignal(1);

    class Foo {
      @signal() accessor b = -1;
    }

    const foo = new Foo();

    expect(sigA()).toBe(1);
    expect(foo.b).toBe(-1);

    connect(sigA, [foo, 'b']);

    expect(sigA()).toBe(1);
    expect(foo.b).toBe(1);

    foo.b = 100;

    expect(foo.b).toBe(100);

    setA(2);

    expect(sigA()).toBe(2);
    expect(foo.b).toBe(2);

    destroySignal(sigA);
    destroyObjectSignals(foo);
  });

  it('connect a signal with an object method', () => {
    const {get: sigA, set: setA} = createSignal(1);

    class Foo {
      b: (val: number) => void = jest.fn();
      c: (val: string) => void = jest.fn();
    }

    const foo = new Foo();

    expect(sigA()).toBe(1);
    expect(foo.b).toHaveBeenCalledTimes(0);

    connect(sigA, [foo, 'b']);
    // connect(sigA, [foo, 'c']);

    expect(sigA()).toBe(1);
    expect(foo.b).toHaveBeenCalledWith(1);
    expect(foo.b).toHaveBeenCalledTimes(1);

    expect(connect(sigA, [foo, 'b'])).toBe(connect(sigA, [foo, 'b']));
    expect(foo.b).toHaveBeenCalledTimes(1);

    setA(2);

    expect(sigA()).toBe(2);
    expect(foo.b).toHaveBeenCalledTimes(2);
    expect(foo.b).toHaveBeenCalledWith(2);

    destroySignal(sigA);
  });

  it('connect a signal with a function', () => {
    const {get: sigA, set: setA} = createSignal(1);

    const bMock = jest.fn();

    expect(sigA()).toBe(1);
    expect(bMock).toHaveBeenCalledTimes(0);

    connect(sigA, bMock);
    expect(bMock).toHaveBeenCalledWith(1);

    expect(connect(sigA, bMock)).toBe(connect(sigA, bMock));
    expect(bMock).toHaveBeenCalledTimes(1);

    setA(2);

    expect(sigA()).toBe(2);
    expect(bMock).toHaveBeenCalledWith(2);

    destroySignal(sigA);
  });

  it('connect an object signal with another signal', () => {
    class Foo {
      @signal() accessor a = 1;
    }

    const foo = new Foo();

    const {get: b} = createSignal(-1);

    expect(foo.a).toBe(1);
    expect(b()).toBe(-1);

    connect([foo, 'a'], b);

    expect(foo.a).toBe(1);
    expect(b()).toBe(1);

    foo.a = 2;

    expect(foo.a).toBe(2);
    expect(b()).toBe(2);

    destroySignal(b);
    destroyObjectSignals(foo);
  });

  it('connect an object signal with another object signal', () => {
    class Foo {
      @signal() accessor a = 1;
      @signal() accessor b = -1;
    }

    const foo = new Foo();

    expect(foo.a).toBe(1);
    expect(foo.b).toBe(-1);

    connect([foo, 'a'], [foo, 'b']);

    expect(foo.a).toBe(1);
    expect(foo.b).toBe(1);

    foo.a = 2;

    expect(foo.a).toBe(2);
    expect(foo.b).toBe(2);

    destroyObjectSignals(foo);
  });

  it('connect an object signal with an object method', () => {
    class Foo {
      @signal() accessor a = 1;

      b: (val: number) => void = jest.fn();
    }

    const foo = new Foo();

    expect(foo.a).toBe(1);
    expect(foo.b).toHaveBeenCalledTimes(0);

    connect([foo, 'a'], [foo, 'b']);

    expect(foo.b).toHaveBeenCalledWith(1);
    expect(foo.b).toHaveBeenCalledTimes(1);

    expect(connect([foo, 'a'], [foo, 'b'])).toBe(
      connect([foo, 'a'], [foo, 'b']),
    );
    expect(foo.b).toHaveBeenCalledTimes(1);

    foo.a = 2;

    expect(foo.a).toBe(2);
    expect(foo.b).toHaveBeenCalledTimes(2);
    expect(foo.b).toHaveBeenCalledWith(2);

    destroyObjectSignals(foo);
  });

  it('connect an object signal with a function', () => {
    class Foo {
      @signal() accessor a = 1;
    }

    const foo = new Foo();

    const bMock = jest.fn();

    expect(foo.a).toBe(1);
    expect(bMock).toHaveBeenCalledTimes(0);

    connect([foo, 'a'], bMock);
    expect(bMock).toHaveBeenCalledWith(1);

    expect(connect([foo, 'a'], bMock)).toBe(connect([foo, 'a'], bMock));
    expect(bMock).toHaveBeenCalledTimes(1);

    foo.a = 2;

    expect(foo.a).toBe(2);
    expect(bMock).toHaveBeenCalledWith(2);

    destroyObjectSignals(foo);
  });

  it('a connection between two points is a singleton and cannot be created more than once', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

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

  it('a connection should be pauseable (mute/unmute)', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

    const muteMock = jest.fn();
    const unmuteMock = jest.fn();

    expect(sigA()).toBe(1);
    expect(sigB()).toBe(-1);

    const con = connect(sigA, sigB);

    on(con, {
      [Connection.Mute]: muteMock,
      [Connection.Unmute]: unmuteMock,
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

    con.toggle();

    setA(7);

    expect(sigA()).toBe(7);
    expect(sigB()).toBe(123);

    expect(muteMock).toHaveBeenCalledTimes(2);
    expect(unmuteMock).toHaveBeenCalledTimes(1);

    unconnect(sigA, sigB);
    destroySignal(sigA, sigB);
  });

  it('if the signal is destroyed, all connections from this signal should be disconnected automatically', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);
    const {get: sigC} = createSignal(-1);

    const con0 = connect(sigA, sigB);
    const con1 = connect(sigA, sigC);

    const destroyMock = jest.fn();

    on(con0, Connection.Destroy, destroyMock);
    on(con1, Connection.Destroy, destroyMock);

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
    expect(callingB).toBeCalledWith(-1);

    const con = connect(sigA, sigB);

    on(con, Connection.Value, valueMock);

    expect(callingB).toHaveBeenCalledTimes(2);
    expect(valueMock).toHaveBeenCalledTimes(1);

    setA(666);

    expect(sigA()).toBe(666);
    expect(sigB()).toBe(666);
    expect(callingB).toHaveBeenCalledTimes(3);
    expect(callingB).toBeCalledWith(666);
    expect(valueMock).toHaveBeenCalledTimes(2);
    expect(valueMock).toBeCalledWith(666);

    setA(666);

    expect(callingB).toHaveBeenCalledTimes(3);
    expect(valueMock).toHaveBeenCalledTimes(2);

    con.touch();

    expect(sigB()).toBe(666);
    expect(callingB).toHaveBeenCalledTimes(4);
    expect(valueMock).toHaveBeenCalledTimes(3);

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

    connect(sigA, sigB);
    connect(sigA, sigC);

    expect(callingB).toHaveBeenCalledTimes(1);
    expect(callingC).toHaveBeenCalledTimes(1);

    setA(666);

    expect(sigA()).toBe(666);
    expect(sigB()).toBe(666);
    expect(sigC()).toBe(666);

    expect(callingB).toHaveBeenCalledTimes(2);
    expect(callingB).toBeCalledWith(666);

    expect(callingC).toHaveBeenCalledTimes(2);
    expect(callingC).toBeCalledWith(666);

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
