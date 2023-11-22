import {effect, signal} from './decorators.js';
import {batch, destroyEffects, destroySignalsAndEffects} from './index.js';

describe('@effect is a class method decorator', () => {
  it('autorun by default', () => {
    class Foo {
      @signal() accessor foo = 1;
      @signal() accessor bar = 10;

      plahValue = 0;
      plahCallCount = 0;

      @effect() plah() {
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

  it('autorun: false', () => {
    class Foo {
      @signal() accessor foo = 1;
      @signal() accessor bar = 10;

      plahValue = 0;
      plahCallCount = 0;

      @effect({autorun: false}) plah() {
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

  it('with a static signal dependency', () => {
    class Foo {
      @signal() accessor foo = 'foo';
      @signal() accessor bar = 'bar';

      plahValue: string = '';
      plahCallCount = 0;

      @effect({signal: 'foo'}) plah() {
        this.plahValue = `${this.foo}${this.bar}`;
        ++this.plahCallCount;
      }
    }

    const foo = new Foo();
    const bar = new Foo();

    expect(foo.foo).toBe('foo');
    expect(foo.bar).toBe('bar');
    expect(foo.plahValue).toBe('');
    expect(foo.plahCallCount).toBe(0);

    expect(bar.foo).toBe('foo');
    expect(bar.bar).toBe('bar');
    expect(bar.plahValue).toBe('');
    expect(bar.plahCallCount).toBe(0);

    foo.plah();

    expect(foo.plahValue).toBe('foobar');
    expect(foo.plahCallCount).toBe(1);

    foo.foo = 'phoo';

    expect(foo.foo).toBe('phoo');
    expect(foo.plahValue).toBe('phoobar');
    expect(foo.plahCallCount).toBe(2);
    expect(bar.plahCallCount).toBe(0);

    foo.plah();

    expect(foo.plahCallCount).toBe(2);
    expect(bar.plahCallCount).toBe(0);

    foo.bar = 'plah';

    expect(foo.bar).toBe('plah');
    expect(foo.plahValue).toBe('phoobar');
    expect(foo.plahCallCount).toBe(2);

    destroyEffects(foo);
    destroyEffects(bar);

    foo.foo = 'abc';

    expect(foo.foo).toBe('abc');
    expect(foo.plahValue).toBe('phoobar');
    expect(foo.plahCallCount).toBe(2);

    destroySignalsAndEffects(foo);
    destroySignalsAndEffects(bar);
  });

  it('with multiple dependencies', () => {
    class Foo {
      @signal() accessor foo = 'foo';
      @signal() accessor bar = 'bar';

      plahValue: string = '';
      plahCallCount = 0;

      @effect({deps: ['foo', 'bar']}) plah() {
        this.plahValue = `${this.foo}${this.bar}`;
        ++this.plahCallCount;
      }

      constructor() {
        this.plah();
      }
    }

    const foo = new Foo();
    const bar = new Foo();

    expect(foo.foo).toBe('foo');
    expect(foo.bar).toBe('bar');
    expect(foo.plahValue).toBe('foobar');
    expect(foo.plahCallCount).toBe(1);

    expect(bar.foo).toBe('foo');
    expect(bar.bar).toBe('bar');
    expect(bar.plahValue).toBe('foobar');
    expect(bar.plahCallCount).toBe(1);

    foo.foo = 'phoo';

    expect(foo.foo).toBe('phoo');
    expect(foo.plahValue).toBe('phoobar');
    expect(foo.plahCallCount).toBe(2);
    expect(bar.plahCallCount).toBe(1);

    foo.bar = 'plah';

    expect(foo.bar).toBe('plah');
    expect(foo.plahValue).toBe('phooplah');
    expect(foo.plahCallCount).toBe(3);
    expect(bar.plahCallCount).toBe(1);

    destroyEffects(foo);
    destroyEffects(bar);

    foo.foo = 'abc';

    expect(foo.foo).toBe('abc');
    expect(foo.plahValue).toBe('phooplah');

    destroySignalsAndEffects(foo);
    destroySignalsAndEffects(bar);
  });

  it('with multiple dependencies and no-autostart', () => {
    class Foo {
      @signal() accessor foo = 'foo';
      @signal() accessor bar = 'bar';

      plahValue: string = '';
      plahCallCount = 0;

      @effect({autostart: false, deps: ['foo', 'bar']}) plah() {
        this.plahValue = `${this.foo}${this.bar}`;
        ++this.plahCallCount;
      }

      constructor() {
        this.plah();
      }
    }

    const foo = new Foo();
    const bar = new Foo();

    expect(foo.foo).toBe('foo');
    expect(foo.bar).toBe('bar');
    expect(foo.plahValue).toBe('');
    expect(foo.plahCallCount).toBe(0);

    expect(bar.foo).toBe('foo');
    expect(bar.bar).toBe('bar');
    expect(bar.plahValue).toBe('');
    expect(bar.plahCallCount).toBe(0);

    foo.foo = 'phoo';

    expect(foo.foo).toBe('phoo');
    expect(foo.plahValue).toBe('phoobar');
    expect(foo.plahCallCount).toBe(1);
    expect(bar.plahCallCount).toBe(0);

    foo.bar = 'plah';

    expect(foo.bar).toBe('plah');
    expect(foo.plahValue).toBe('phooplah');
    expect(foo.plahCallCount).toBe(2);
    expect(bar.plahCallCount).toBe(0);

    destroyEffects(foo);
    destroyEffects(bar);

    foo.foo = 'abc';

    expect(foo.foo).toBe('abc');
    expect(foo.plahValue).toBe('phooplah');

    destroySignalsAndEffects(foo);
    destroySignalsAndEffects(bar);
  });
});
