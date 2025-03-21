import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
import {memo, signal} from './decorators.js';
import {
  createMemo,
  destroyObjectSignals,
  destroySignal,
  findObjectSignalByName,
  findObjectSignalNames,
  SignalGroup,
  value,
} from './index.js';

describe('@signal is a class accessor decorator', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
  });

  it('works as expected', () => {
    class Foo {
      @signal() accessor foo = 1;
    }

    const foo = new Foo();

    expect(foo.foo).toBe(1);
    assertSignalsCount(1, 'after new Foo');

    const fooSignal = findObjectSignalByName(foo, 'foo');

    expect(fooSignal).toBeDefined();
    expect(value(fooSignal)).toBe(1);
    expect(value([foo, 'foo'])).toBe(1);

    const computedFoo = createMemo(() => foo.foo + 100);

    foo.foo = 2;

    expect(foo.foo).toBe(2);
    expect(value(fooSignal)).toBe(2);
    expect(computedFoo()).toBe(102);
    assertSignalsCount(2, 'after createMemo()');

    destroyObjectSignals(foo);
    destroySignal(computedFoo);
  });

  it('signal with custom comparator', () => {
    const equals = (a: number, b: number) =>
      b != null && (a === b || a === b + 1);

    class Foo {
      @signal({compare: equals}) accessor foo = 1;

      @memo() bar() {
        return this.foo + 100;
      }
    }

    const foo = new Foo();

    expect(foo.foo).toBe(1);
    expect(foo.bar()).toBe(101);

    foo.foo = 2;

    expect(foo.foo).toBe(1);
    expect(foo.bar()).toBe(101);

    foo.foo = 4;

    expect(foo.foo).toBe(4);
    expect(foo.bar()).toBe(104);

    destroyObjectSignals(foo);
  });

  it('each object has its on signal instance', () => {
    class Foo {
      @signal() accessor foo = 1;
    }

    const foo = new Foo();
    expect(foo.foo).toBe(1);
    assertSignalsCount(1, 'after new Foo');

    const foo2 = new Foo();
    expect(foo2.foo).toBe(1);
    assertSignalsCount(2, 'after new Foo (2)');

    const fooSignal = findObjectSignalByName(foo, 'foo');
    const foo2Signal = findObjectSignalByName(foo2, 'foo');

    expect(fooSignal).toBeDefined();
    expect(foo2Signal).toBeDefined();
    expect(fooSignal).not.toBe(foo2Signal);

    const onFoo = jest.fn();
    const onFoo2 = jest.fn();

    fooSignal.onChange(onFoo);
    foo2Signal.onChange(onFoo2);

    foo.foo = 123;
    expect(onFoo).toHaveBeenCalledTimes(1);
    expect(onFoo2).not.toHaveBeenCalled();

    foo2.foo = 456;
    expect(onFoo2).toHaveBeenCalledTimes(1);

    expect(foo.foo).toBe(123);
    expect(foo2.foo).toBe(456);

    destroyObjectSignals(foo, foo2);
  });

  it('get the signals from the object using the group', () => {
    class Foo {
      @signal() accessor foo = 1;
      @signal({name: 'plah'}) accessor bar = 23;
      @signal() accessor xyz = 'abc';
    }

    const foo = new Foo();

    assertSignalsCount(3, 'after new Foo');

    foo.foo = 666;

    expect(foo.foo).toBe(666);

    const group = SignalGroup.get(foo);

    expect(group.signal('foo').value).toBe(666);

    foo.bar = 42;

    expect(foo.bar).toBe(42);
    expect(group.signal('plah').value).toBe(42);

    foo.xyz = 'hello';

    expect(foo.xyz).toBe('hello');
    expect(group.signal('xyz').value).toBe('hello');

    expect(findObjectSignalNames(foo).sort()).toEqual(
      ['foo', 'plah', 'xyz'].sort(),
    );

    group.clear();
  });
});
