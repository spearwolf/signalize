import {
  createMemo,
  destroySignal,
  destroySignals,
  queryObjectSignal,
  signal,
  value,
} from '.';

describe('@signal is a class accessor decorator', () => {
  it('works as expected', () => {
    class Foo {
      @signal accessor foo = 1;
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
});
