import {assertEffectsCount} from './assert-helpers.js';
import {signal} from './decorators.js';
import {createEffect, destroySignals} from './index.js';

describe('effects and groups', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
  });

  it('the cleanup callback is called as expected', () => {
    const cleanup = jest.fn();

    class Foo {
      @signal() accessor foo = 'foo';
      @signal() accessor bar = 'bar';

      plahValue: string = '';
      plahCallCount = 0;

      constructor() {
        createEffect(this.plah.bind(this), ['foo', 'bar'], {group: this}).run();
        // createEffect(this.plah.bind(this), {group: this});
      }

      private plah() {
        const val = `${this.foo}${this.bar}`;
        this.plahValue = val;
        ++this.plahCallCount;
        return () => {
          cleanup(val);
        };
      }
    }

    const foo = new Foo();

    expect(foo.foo).toBe('foo');
    expect(foo.bar).toBe('bar');
    expect(foo.plahValue).toBe('foobar');
    expect(foo.plahCallCount).toBe(1);
    expect(cleanup).not.toHaveBeenCalled();

    foo.foo = 'phoo';

    expect(foo.foo).toBe('phoo');
    expect(foo.plahValue).toBe('phoobar');
    expect(foo.plahCallCount).toBe(2);
    expect(cleanup).toHaveBeenCalledWith('foobar');

    foo.bar = 'plah';

    expect(foo.bar).toBe('plah');
    expect(foo.plahValue).toBe('phooplah');
    expect(foo.plahCallCount).toBe(3);
    expect(cleanup).toHaveBeenCalledWith('phoobar');

    destroySignals(foo);
  });
});
