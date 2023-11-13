import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
import {memo, signal} from './decorators.js';
import {
  createMemo,
  destroySignal,
  destroySignals,
  queryObjectSignal,
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

    const fooSignal = queryObjectSignal(foo, 'foo');

    expect(fooSignal).toBeDefined();
    expect(value(fooSignal)).toBe(1);
    expect(value([foo, 'foo'])).toBe(1);

    const computedFoo = createMemo(() => foo.foo + 100);

    foo.foo = 2;

    expect(foo.foo).toBe(2);
    expect(value(fooSignal)).toBe(2);
    expect(computedFoo()).toBe(102);
    assertSignalsCount(2, 'after createMemo()');

    destroySignals(foo);
    destroySignal(computedFoo);
  });

  it('signal with custom comparator', () => {
    const equals = (a: number, b: number) =>
      b != null && (a === b || a === b + 1);

    class Foo {
      @signal({compareFn: equals}) accessor foo = 1;

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

    destroySignals(foo);
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

    const fooSignal = queryObjectSignal(foo, 'foo');
    const foo2Signal = queryObjectSignal(foo2, 'foo');

    expect(fooSignal).toBeDefined();
    expect(foo2Signal).toBeDefined();
    expect(fooSignal).not.toBe(foo2Signal);

    const onFoo = jest.fn();
    const onFoo2 = jest.fn();

    fooSignal(onFoo);
    foo2Signal(onFoo2);

    foo.foo = 123;
    expect(onFoo).toHaveBeenCalledTimes(1);
    expect(onFoo2).not.toBeCalled();

    foo2.foo = 456;
    expect(onFoo2).toHaveBeenCalledTimes(1);

    expect(foo.foo).toBe(123);
    expect(foo2.foo).toBe(456);

    destroySignals(foo2);
    destroySignals(foo);
  });
});
