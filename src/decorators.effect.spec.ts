import {
  batch,
  destroyEffects,
  destroySignalsAndEffects,
  effect,
  signal,
} from '.';

describe('@effect is a class method decorator', () => {
  it('works as expected', () => {
    class Foo {
      @signal() accessor foo = 1;
      @signal() accessor bar = 10;

      plahValue = 0;
      plahCallCount = 0;

      @effect plah() {
        this.plahValue = this.foo * 100 + this.foo + this.bar;
        ++this.plahCallCount;
      }
    }

    const foo = new Foo();

    expect(foo.foo).toBe(1);
    expect(foo.bar).toBe(10);
    expect(foo.plahValue).toBe(0);
    expect(foo.plahCallCount).toBe(0);

    foo.plah();

    expect(foo.plahValue).toBe(111);
    expect(foo.plahCallCount).toBe(1);

    foo.foo = 2;
    foo.bar = 20;

    expect(foo.foo).toBe(2);
    expect(foo.bar).toBe(20);
    expect(foo.plahValue).toBe(222);
    expect(foo.plahCallCount).toBe(3);

    batch(() => {
      foo.foo = 3;
      foo.bar = 30;
    });

    expect(foo.foo).toBe(3);
    expect(foo.bar).toBe(30);
    expect(foo.plahValue).toBe(333);
    expect(foo.plahCallCount).toBe(4);

    foo.foo = 3;

    expect(foo.plahCallCount).toBe(4);

    destroyEffects(foo);

    foo.foo = 4;

    expect(foo.foo).toBe(4);
    expect(foo.plahValue).toBe(333);
    expect(foo.plahCallCount).toBe(4);

    destroySignalsAndEffects(foo);
  });
});
