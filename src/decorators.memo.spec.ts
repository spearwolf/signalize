import {destroySignals, queryObjectSignal, value} from './index.js';
import {memo, signal} from './decorators.js';

describe('@memo is a class method decorator', () => {
  it('works as expected', () => {
    class Foo {
      @signal() accessor foo = 1;

      barCallCount = 0;

      @memo() bar() {
        ++this.barCallCount;
        return this.foo + 100;
      }
    }

    const foo = new Foo();

    expect(foo.foo).toBe(1);
    expect(foo.bar()).toBe(101);
    expect(foo.barCallCount).toBe(1);

    const barSignal = queryObjectSignal(foo, 'bar');

    expect(barSignal).toBeDefined();
    expect(value(barSignal)).toBe(101);
    expect(foo.barCallCount).toBe(1);

    foo.foo = 2;

    expect(foo.foo).toBe(2);
    expect(foo.barCallCount).toBe(1);
    expect(value(barSignal)).toBe(101);

    foo.foo = 3;

    expect(foo.foo).toBe(3);
    expect(foo.bar()).toBe(103);
    expect(foo.barCallCount).toBe(2);

    foo.foo = 4;

    expect(foo.barCallCount).toBe(2);

    destroySignals(foo);
  });
});
