import {
  createMemo,
  destroySignal,
  destroySignals,
  memo,
  queryObjectSignal,
  signal,
  value,
} from '.';

describe('@signal is a class accessor decorator', () => {
  it('works as expected', () => {
    class Foo {
      @signal() accessor foo = 1;
    }

    const foo = new Foo();

    expect(foo.foo).toBe(1);

    const fooSignal = queryObjectSignal(foo, 'foo');

    expect(fooSignal).toBeDefined();
    expect(value(fooSignal)).toBe(1);

    const computedFoo = createMemo(() => foo.foo + 100);

    foo.foo = 2;

    expect(foo.foo).toBe(2);
    expect(value(fooSignal)).toBe(2);
    expect(computedFoo()).toBe(102);

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
});
