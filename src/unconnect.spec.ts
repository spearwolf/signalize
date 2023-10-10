import {
  connect,
  createSignal,
  destroySignal,
  destroySignals,
  unconnect,
} from './index.js';
import {signal} from './decorators.js';
import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';

describe('unconnect', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
  });

  it('signal', () => {
    const [firstSignal, setFirstSignal] = createSignal(23);

    const [sig, setSig] = createSignal(-77);

    const c_ = connect(firstSignal, sig);

    expect(sig()).toBe(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect(sig, mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect(sig, otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect(sig, [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect(sig, [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(23);
    foo.plah.mockClear();

    setFirstSignal(42);

    expect(foo.bar).toBe(42);
    expect(otherSignal()).toBe(42);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(42);
    mockFn.mockClear();
    expect(foo.plah).toHaveBeenCalledWith(42);
    foo.plah.mockClear();

    unconnect(sig);

    expect(c_.isDestroyed).toBe(true);
    expect(c0.isDestroyed).toBe(true);
    expect(c1.isDestroyed).toBe(true);
    expect(c2.isDestroyed).toBe(true);
    expect(c3.isDestroyed).toBe(true);

    setSig(666);

    expect(sig()).toBe(666);
    expect(foo.bar).toBe(42);
    expect(otherSignal()).toBe(42);
    expect(mockFn).not.toHaveBeenCalled();
    expect(foo.plah).not.toHaveBeenCalled();

    destroySignal(sig, otherSignal, firstSignal);
    destroySignals(foo);
  });

  it('signal (without unconnect ;)', () => {
    const [sig, setSig] = createSignal(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect(sig, mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect(sig, otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect(sig, [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect(sig, [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(23);
    foo.plah.mockClear();

    setSig(42);

    expect(foo.bar).toBe(42);
    expect(otherSignal()).toBe(42);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(42);
    mockFn.mockClear();
    expect(foo.plah).toHaveBeenCalledWith(42);
    foo.plah.mockClear();

    // --- this is what we want to test ---

    destroySignal(sig);

    // ---

    expect(c0.isDestroyed).toBe(true);
    expect(c1.isDestroyed).toBe(true);
    expect(c2.isDestroyed).toBe(true);
    expect(c3.isDestroyed).toBe(true);

    // ------------------------------------

    setSig(666);

    expect(sig()).toBe(666);
    expect(foo.bar).toBe(42);
    expect(otherSignal()).toBe(42);
    expect(mockFn).not.toHaveBeenCalled();
    expect(foo.plah).not.toHaveBeenCalled();

    destroySignal(otherSignal);
    destroySignals(foo);
  });

  it('signal -> function', () => {
    const [sig, setSig] = createSignal(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect(sig, mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect(sig, otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect(sig, [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect(sig, [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(23);
    foo.plah.mockClear();

    setSig(42);

    expect(foo.bar).toBe(42);
    expect(otherSignal()).toBe(42);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(42);
    mockFn.mockClear();
    expect(foo.plah).toHaveBeenCalledWith(42);
    foo.plah.mockClear();

    // --- this is what we want to test ---

    unconnect(sig, mockFn);

    // ---

    expect(c0.isDestroyed).toBe(true);
    expect(c1.isDestroyed).toBe(false);
    expect(c2.isDestroyed).toBe(false);
    expect(c3.isDestroyed).toBe(false);

    // ------------------------------------

    setSig(666);

    expect(sig()).toBe(666);
    expect(foo.bar).toBe(666);
    expect(otherSignal()).toBe(666);
    expect(mockFn).not.toHaveBeenCalled();
    expect(foo.plah).toHaveBeenCalledWith(666);

    destroySignal(sig, otherSignal);
    destroySignals(foo);
  });

  it('signal -> signal', () => {
    const [sig, setSig] = createSignal(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect(sig, mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect(sig, otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect(sig, [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect(sig, [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(23);
    foo.plah.mockClear();

    setSig(42);

    expect(foo.bar).toBe(42);
    expect(otherSignal()).toBe(42);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(42);
    mockFn.mockClear();
    expect(foo.plah).toHaveBeenCalledWith(42);
    foo.plah.mockClear();

    // --- this is what we want to test ---

    unconnect(sig, otherSignal);

    // ---

    expect(c0.isDestroyed).toBe(false);
    expect(c1.isDestroyed).toBe(true);
    expect(c2.isDestroyed).toBe(false);
    expect(c3.isDestroyed).toBe(false);

    // ------------------------------------

    setSig(666);

    expect(sig()).toBe(666);
    expect(foo.bar).toBe(666);
    expect(otherSignal()).toBe(42);
    expect(mockFn).toHaveBeenCalledWith(666);
    expect(foo.plah).toHaveBeenCalledWith(666);

    destroySignal(sig, otherSignal);
    destroySignals(foo);
  });

  it('signal -> object', () => {
    const [sig, setSig] = createSignal(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;
      plah = jest.fn();
    }

    class Bar {
      @signal() accessor bar = -1;
      plah = jest.fn();
    }

    const foo = new Foo();
    const bar = new Bar();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();
    expect(bar.bar).toBe(-1);
    expect(bar.plah).not.toHaveBeenCalled();

    const c0 = connect(sig, mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect(sig, otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect(sig, [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect(sig, [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(23);
    foo.plah.mockClear();

    const c4 = connect(sig, [bar, 'bar']);

    expect(bar.bar).toBe(23);

    const c5 = connect(sig, [bar, 'plah']);

    expect(bar.plah).toHaveBeenCalledWith(23);
    foo.plah.mockClear();

    setSig(42);

    expect(foo.bar).toBe(42);
    expect(bar.bar).toBe(42);
    expect(otherSignal()).toBe(42);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(42);
    mockFn.mockClear();
    expect(foo.plah).toHaveBeenCalledWith(42);
    foo.plah.mockClear();
    expect(bar.plah).toHaveBeenCalledWith(42);
    bar.plah.mockClear();

    // --- this is what we want to test ---

    unconnect(sig, foo);

    // ---

    expect(c0.isDestroyed).toBe(false);
    expect(c1.isDestroyed).toBe(false);
    expect(c2.isDestroyed).toBe(true);
    expect(c3.isDestroyed).toBe(true);
    expect(c4.isDestroyed).toBe(false);
    expect(c5.isDestroyed).toBe(false);

    // ------------------------------------

    setSig(666);

    expect(sig()).toBe(666);
    expect(foo.bar).toBe(42);
    expect(bar.bar).toBe(666);
    expect(otherSignal()).toBe(666);
    expect(mockFn).toHaveBeenCalledWith(666);
    expect(foo.plah).not.toHaveBeenCalled();
    expect(bar.plah).toHaveBeenCalledWith(666);

    destroySignal(sig, otherSignal);
    destroySignals(foo);
    destroySignals(bar);
  });

  it('signal -> object.signal', () => {
    const [sig, setSig] = createSignal(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect(sig, mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect(sig, otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect(sig, [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect(sig, [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(23);
    foo.plah.mockClear();

    setSig(42);

    expect(foo.bar).toBe(42);
    expect(otherSignal()).toBe(42);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(42);
    mockFn.mockClear();
    expect(foo.plah).toHaveBeenCalledWith(42);
    foo.plah.mockClear();

    // --- this is what we want to test ---

    unconnect(sig, [foo, 'bar']);

    // ---

    expect(c0.isDestroyed).toBe(false);
    expect(c1.isDestroyed).toBe(false);
    expect(c2.isDestroyed).toBe(true);
    expect(c3.isDestroyed).toBe(false);

    // ------------------------------------

    setSig(666);

    expect(sig()).toBe(666);
    expect(foo.bar).toBe(42);
    expect(otherSignal()).toBe(666);
    expect(mockFn).toHaveBeenCalledWith(666);
    expect(foo.plah).toHaveBeenCalledWith(666);

    destroySignal(sig, otherSignal);
    destroySignals(foo);
  });

  it('signal -> object.method', () => {
    const [sig, setSig] = createSignal(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect(sig, mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect(sig, otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect(sig, [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect(sig, [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(23);
    foo.plah.mockClear();

    setSig(42);

    expect(foo.bar).toBe(42);
    expect(otherSignal()).toBe(42);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(42);
    mockFn.mockClear();
    expect(foo.plah).toHaveBeenCalledWith(42);
    foo.plah.mockClear();

    // --- this is what we want to test ---

    unconnect(sig, [foo, 'plah']);

    // ---

    expect(c0.isDestroyed).toBe(false);
    expect(c1.isDestroyed).toBe(false);
    expect(c2.isDestroyed).toBe(false);
    expect(c3.isDestroyed).toBe(true);

    // ------------------------------------

    setSig(666);

    expect(sig()).toBe(666);
    expect(foo.bar).toBe(666);
    expect(otherSignal()).toBe(666);
    expect(mockFn).toHaveBeenCalledWith(666);
    expect(foo.plah).not.toHaveBeenCalled();

    destroySignal(sig, otherSignal);
    destroySignals(foo);
  });

  it('object', () => {
    const [yetAnotherSignal, setYetAnotherSignal] = createSignal(23);

    class Source {
      @signal() accessor sigA = -1;
      @signal() accessor sigB = 25;
    }

    const source = new Source();

    const c_ = connect(yetAnotherSignal, [source, 'sigA']);

    expect(source.sigA).toBe(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect([source, 'sigA'], mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect([source, 'sigA'], otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect([source, 'sigA'], [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect([source, 'sigB'], [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(25);
    foo.plah.mockClear();

    setYetAnotherSignal(42);
    source.sigB = 43;

    expect(foo.bar).toBe(42);
    expect(otherSignal()).toBe(42);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(42);
    mockFn.mockClear();
    expect(foo.plah).toHaveBeenCalledWith(43);
    foo.plah.mockClear();

    // --- this is what we want to test ---

    unconnect(source);

    // ---

    expect(c_.isDestroyed).toBe(true);
    expect(c0.isDestroyed).toBe(true);
    expect(c1.isDestroyed).toBe(true);
    expect(c2.isDestroyed).toBe(true);
    expect(c3.isDestroyed).toBe(true);

    // ------------------------------------

    source.sigA = 666;
    source.sigB = 667;

    expect(source.sigA).toBe(666);
    expect(source.sigB).toBe(667);
    expect(foo.bar).toBe(42);
    expect(otherSignal()).toBe(42);
    expect(mockFn).not.toHaveBeenCalled();
    expect(foo.plah).not.toHaveBeenCalled();

    destroySignal(otherSignal, yetAnotherSignal);
    destroySignals(foo);
    destroySignals(source);
  });

  it('object -> function', () => {
    const [yetAnotherSignal, setYetAnotherSignal] = createSignal(23);

    class Source {
      @signal() accessor sigA = -1;
      @signal() accessor sigB = 25;
    }

    const source = new Source();

    const c_ = connect(yetAnotherSignal, [source, 'sigA']);

    expect(source.sigA).toBe(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect([source, 'sigA'], mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect([source, 'sigA'], otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect([source, 'sigA'], [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect([source, 'sigB'], [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(25);
    foo.plah.mockClear();

    setYetAnotherSignal(42);
    source.sigB = 43;

    expect(foo.bar).toBe(42);
    expect(otherSignal()).toBe(42);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(42);
    mockFn.mockClear();
    expect(foo.plah).toHaveBeenCalledWith(43);
    foo.plah.mockClear();

    // --- this is what we want to test ---

    unconnect(source, [foo, 'plah']);

    // ---

    expect(c_.isDestroyed).toBe(false);
    expect(c0.isDestroyed).toBe(false);
    expect(c1.isDestroyed).toBe(false);
    expect(c2.isDestroyed).toBe(false);
    expect(c3.isDestroyed).toBe(true);

    // ------------------------------------

    source.sigA = 666;
    source.sigB = 667;

    expect(source.sigA).toBe(666);
    expect(source.sigB).toBe(667);
    expect(foo.bar).toBe(666);
    expect(otherSignal()).toBe(666);
    expect(mockFn).toHaveBeenCalledWith(666);
    expect(foo.plah).not.toHaveBeenCalled();

    destroySignal(otherSignal, yetAnotherSignal);
    destroySignals(foo);
    destroySignals(source);
  });

  it('object -> signal', () => {
    const [yetAnotherSignal, setYetAnotherSignal] = createSignal(23);

    class Source {
      @signal() accessor sigA = -1;
      @signal() accessor sigB = 25;
    }

    const source = new Source();

    const c_ = connect(yetAnotherSignal, [source, 'sigA']);

    expect(source.sigA).toBe(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect([source, 'sigA'], mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect([source, 'sigA'], otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect([source, 'sigA'], [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect([source, 'sigB'], [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(25);
    foo.plah.mockClear();

    setYetAnotherSignal(42);
    source.sigB = 43;

    expect(otherSignal()).toBe(42);
    expect(foo.bar).toBe(42);
    expect(foo.plah).toHaveBeenCalledWith(43);
    expect(mockFn).toHaveBeenCalledWith(42);
    foo.plah.mockClear();
    mockFn.mockClear();

    // --- this is what we want to test ---

    unconnect(source, otherSignal);

    // ---

    expect(c_.isDestroyed).toBe(false);
    expect(c0.isDestroyed).toBe(false);
    expect(c1.isDestroyed).toBe(true);
    expect(c2.isDestroyed).toBe(false);
    expect(c3.isDestroyed).toBe(false);

    // ------------------------------------

    destroySignal(otherSignal, yetAnotherSignal);
    destroySignals(foo);
    destroySignals(source);
  });

  // TODO implement all unconnect tests
  it.skip('object -> object', () => {});

  it('object -> object.signal', () => {
    const [yetAnotherSignal, setYetAnotherSignal] = createSignal(23);

    class Source {
      @signal() accessor sigA = -1;
      @signal() accessor sigB = 25;
    }

    const source = new Source();

    const c_ = connect(yetAnotherSignal, [source, 'sigA']);

    expect(source.sigA).toBe(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect([source, 'sigA'], mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect([source, 'sigA'], otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect([source, 'sigA'], [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect([source, 'sigB'], [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(25);
    foo.plah.mockClear();

    setYetAnotherSignal(42);
    source.sigB = 43;

    expect(otherSignal()).toBe(42);
    expect(foo.bar).toBe(42);
    expect(foo.plah).toHaveBeenCalledWith(43);
    expect(mockFn).toHaveBeenCalledWith(42);
    foo.plah.mockClear();
    mockFn.mockClear();

    // --- this is what we want to test ---

    unconnect(source, [foo, 'bar']);

    // ---

    expect(c_.isDestroyed).toBe(false);
    expect(c0.isDestroyed).toBe(false);
    expect(c1.isDestroyed).toBe(false);
    expect(c2.isDestroyed).toBe(true);
    expect(c3.isDestroyed).toBe(false);

    // ------------------------------------

    destroySignal(otherSignal, yetAnotherSignal);
    destroySignals(foo);
    destroySignals(source);
  });

  it('object -> object.method', () => {
    const [yetAnotherSignal, setYetAnotherSignal] = createSignal(23);

    class Source {
      @signal() accessor sigA = -1;
      @signal() accessor sigB = 25;
    }

    const source = new Source();

    const c_ = connect(yetAnotherSignal, [source, 'sigA']);

    expect(source.sigA).toBe(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect([source, 'sigA'], mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect([source, 'sigA'], otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect([source, 'sigA'], [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect([source, 'sigB'], [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(25);
    foo.plah.mockClear();

    setYetAnotherSignal(42);
    source.sigB = 43;

    expect(otherSignal()).toBe(42);
    expect(foo.bar).toBe(42);
    expect(foo.plah).toHaveBeenCalledWith(43);
    expect(mockFn).toHaveBeenCalledWith(42);
    foo.plah.mockClear();
    mockFn.mockClear();

    // --- this is what we want to test ---

    unconnect(source, [foo, 'plah']);

    // ---

    expect(c_.isDestroyed).toBe(false);
    expect(c0.isDestroyed).toBe(false);
    expect(c1.isDestroyed).toBe(false);
    expect(c2.isDestroyed).toBe(false);
    expect(c3.isDestroyed).toBe(true);

    // ------------------------------------

    destroySignal(otherSignal, yetAnotherSignal);
    destroySignals(foo);
    destroySignals(source);
  });

  it('object.signal', () => {
    const [yetAnotherSignal, setYetAnotherSignal] = createSignal(23);

    class Source {
      @signal() accessor sigA = -1;
      @signal() accessor sigB = 25;
    }

    const source = new Source();

    const c_ = connect(yetAnotherSignal, [source, 'sigA']);

    expect(source.sigA).toBe(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect([source, 'sigA'], mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect([source, 'sigA'], otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect([source, 'sigA'], [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect([source, 'sigB'], [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(25);
    foo.plah.mockClear();

    setYetAnotherSignal(42);
    source.sigB = 43;

    expect(otherSignal()).toBe(42);
    expect(foo.bar).toBe(42);
    expect(foo.plah).toHaveBeenCalledWith(43);
    expect(mockFn).toHaveBeenCalledWith(42);
    foo.plah.mockClear();
    mockFn.mockClear();

    // --- this is what we want to test ---

    unconnect([source, 'sigA']);

    // ---

    expect(c_.isDestroyed).toBe(false);
    expect(c0.isDestroyed).toBe(true);
    expect(c1.isDestroyed).toBe(true);
    expect(c2.isDestroyed).toBe(true);
    expect(c3.isDestroyed).toBe(false);

    // ------------------------------------

    destroySignal(otherSignal, yetAnotherSignal);
    destroySignals(foo);
    destroySignals(source);
  });

  it('object.signal -> function', () => {
    const [yetAnotherSignal, setYetAnotherSignal] = createSignal(23);

    class Source {
      @signal() accessor sigA = -1;
      @signal() accessor sigB = 25;
    }

    const source = new Source();

    const c_ = connect(yetAnotherSignal, [source, 'sigA']);

    expect(source.sigA).toBe(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect([source, 'sigA'], mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect([source, 'sigA'], otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect([source, 'sigA'], [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect([source, 'sigB'], [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(25);
    foo.plah.mockClear();

    setYetAnotherSignal(42);
    source.sigB = 43;

    expect(otherSignal()).toBe(42);
    expect(foo.bar).toBe(42);
    expect(foo.plah).toHaveBeenCalledWith(43);
    expect(mockFn).toHaveBeenCalledWith(42);
    foo.plah.mockClear();
    mockFn.mockClear();

    // --- this is what we want to test ---

    unconnect([source, 'sigA'], mockFn);

    // ---

    expect(c_.isDestroyed).toBe(false);
    expect(c0.isDestroyed).toBe(true);
    expect(c1.isDestroyed).toBe(false);
    expect(c2.isDestroyed).toBe(false);
    expect(c3.isDestroyed).toBe(false);

    // ------------------------------------

    destroySignal(otherSignal, yetAnotherSignal);
    destroySignals(foo);
    destroySignals(source);
  });

  it('object.signal -> signal', () => {
    const [yetAnotherSignal, setYetAnotherSignal] = createSignal(23);

    class Source {
      @signal() accessor sigA = -1;
      @signal() accessor sigB = 25;
    }

    const source = new Source();

    const c_ = connect(yetAnotherSignal, [source, 'sigA']);

    expect(source.sigA).toBe(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect([source, 'sigA'], mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect([source, 'sigA'], otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect([source, 'sigA'], [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect([source, 'sigB'], [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(25);
    foo.plah.mockClear();

    setYetAnotherSignal(42);
    source.sigB = 43;

    expect(otherSignal()).toBe(42);
    expect(foo.bar).toBe(42);
    expect(foo.plah).toHaveBeenCalledWith(43);
    expect(mockFn).toHaveBeenCalledWith(42);
    foo.plah.mockClear();
    mockFn.mockClear();

    // --- this is what we want to test ---

    unconnect([source, 'sigA'], otherSignal);

    // ---

    expect(c_.isDestroyed).toBe(false);
    expect(c0.isDestroyed).toBe(false);
    expect(c1.isDestroyed).toBe(true);
    expect(c2.isDestroyed).toBe(false);
    expect(c3.isDestroyed).toBe(false);

    // ------------------------------------

    destroySignal(otherSignal, yetAnotherSignal);
    destroySignals(foo);
    destroySignals(source);
  });

  it('object.signal -> object', () => {
    const [yetAnotherSignal, setYetAnotherSignal] = createSignal(23);

    class Source {
      @signal() accessor sigA = -1;
      @signal() accessor sigB = 25;
    }

    const source = new Source();

    const c_ = connect(yetAnotherSignal, [source, 'sigA']);

    expect(source.sigA).toBe(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect([source, 'sigA'], mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect([source, 'sigA'], otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect([source, 'sigA'], [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect([source, 'sigB'], [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(25);
    foo.plah.mockClear();

    setYetAnotherSignal(42);
    source.sigB = 43;

    expect(otherSignal()).toBe(42);
    expect(foo.bar).toBe(42);
    expect(foo.plah).toHaveBeenCalledWith(43);
    expect(mockFn).toHaveBeenCalledWith(42);
    foo.plah.mockClear();
    mockFn.mockClear();

    // --- this is what we want to test ---

    unconnect([source, 'sigA'], foo);

    // ---

    expect(c_.isDestroyed).toBe(false);
    expect(c0.isDestroyed).toBe(false);
    expect(c1.isDestroyed).toBe(false);
    expect(c2.isDestroyed).toBe(true);
    expect(c3.isDestroyed).toBe(false);

    // ------------------------------------

    destroySignal(otherSignal, yetAnotherSignal);
    destroySignals(foo);
    destroySignals(source);
  });

  it('object.signal -> object.signal', () => {
    const [yetAnotherSignal, setYetAnotherSignal] = createSignal(23);

    class Source {
      @signal() accessor sigA = -1;
      @signal() accessor sigB = 25;
    }

    const source = new Source();

    const c_ = connect(yetAnotherSignal, [source, 'sigA']);

    expect(source.sigA).toBe(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect([source, 'sigA'], mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect([source, 'sigA'], otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect([source, 'sigA'], [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect([source, 'sigB'], [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(25);
    foo.plah.mockClear();

    setYetAnotherSignal(42);
    source.sigB = 43;

    expect(otherSignal()).toBe(42);
    expect(foo.bar).toBe(42);
    expect(foo.plah).toHaveBeenCalledWith(43);
    expect(mockFn).toHaveBeenCalledWith(42);
    foo.plah.mockClear();
    mockFn.mockClear();

    // --- this is what we want to test ---

    unconnect([source, 'sigA'], [foo, 'bar']);

    // ---

    expect(c_.isDestroyed).toBe(false);
    expect(c0.isDestroyed).toBe(false);
    expect(c1.isDestroyed).toBe(false);
    expect(c2.isDestroyed).toBe(true);
    expect(c3.isDestroyed).toBe(false);

    // ------------------------------------

    destroySignal(otherSignal, yetAnotherSignal);
    destroySignals(foo);
    destroySignals(source);
  });

  it('object.signal -> object.method', () => {
    const [yetAnotherSignal, setYetAnotherSignal] = createSignal(23);

    class Source {
      @signal() accessor sigA = -1;
      @signal() accessor sigB = 25;
    }

    const source = new Source();

    const c_ = connect(yetAnotherSignal, [source, 'sigA']);

    expect(source.sigA).toBe(23);

    const mockFn = jest.fn();

    const [otherSignal] = createSignal(-1);

    class Foo {
      @signal() accessor bar = -1;

      plah = jest.fn();
    }

    const foo = new Foo();

    expect(mockFn).not.toHaveBeenCalled();
    expect(otherSignal()).toBe(-1);
    expect(foo.bar).toBe(-1);
    expect(foo.plah).not.toHaveBeenCalled();

    const c0 = connect([source, 'sigA'], mockFn);

    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledWith(23);
    mockFn.mockClear();

    const c1 = connect([source, 'sigA'], otherSignal);

    expect(otherSignal()).toBe(23);

    const c2 = connect([source, 'sigA'], [foo, 'bar']);

    expect(foo.bar).toBe(23);

    const c3 = connect([source, 'sigB'], [foo, 'plah']);

    expect(foo.plah).toHaveBeenCalledWith(25);
    foo.plah.mockClear();

    setYetAnotherSignal(42);
    source.sigB = 43;

    expect(otherSignal()).toBe(42);
    expect(foo.bar).toBe(42);
    expect(foo.plah).toHaveBeenCalledWith(43);
    expect(mockFn).toHaveBeenCalledWith(42);
    foo.plah.mockClear();
    mockFn.mockClear();

    // --- this is what we want to test ---

    unconnect([source, 'sigB'], [foo, 'plah']);

    // ---

    expect(c_.isDestroyed).toBe(false);
    expect(c0.isDestroyed).toBe(false);
    expect(c1.isDestroyed).toBe(false);
    expect(c2.isDestroyed).toBe(false);
    expect(c3.isDestroyed).toBe(true);

    // ------------------------------------

    destroySignal(otherSignal, yetAnotherSignal);
    destroySignals(foo);
    destroySignals(source);
  });
});
