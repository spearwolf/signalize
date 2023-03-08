import {asyncEffect, destroySignalsAndEffects, signal} from '.';

describe('@asyncEffect is a class method decorator', () => {
  it('works as expected', () => {
    class Foo {
      @signal accessor foo = 1;
      @signal accessor bar = 10;

      plahValue = 0;
      plahCallCount = 0;

      @asyncEffect plah() {
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
    expect(foo.plahValue).toBe(111);
    expect(foo.plahCallCount).toBe(1);

    foo.plah();

    expect(foo.plahValue).toBe(222);
    expect(foo.plahCallCount).toBe(2);

    foo.foo = 2;
    foo.bar = 20;
    foo.plah();

    expect(foo.plahValue).toBe(222);
    expect(foo.plahCallCount).toBe(2);

    destroySignalsAndEffects(foo);
  });
});
