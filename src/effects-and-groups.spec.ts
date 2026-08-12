import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './create-signal.js';
import {signal} from './decorators.js';
import {createEffect, destroyObjectSignals, destroySignal} from './index.js';

describe('effects and groups', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  it('the cleanup callback is called as expected', () => {
    const cleanup = vi.fn();

    class Foo {
      @signal() accessor foo = 'foo';
      @signal() accessor bar = 'bar';

      plahValue: string = '';
      plahCallCount = 0;

      constructor() {
        createEffect(this.plah.bind(this), ['foo', 'bar'], {
          attach: this,
        }).run();
        // createEffect(this.plah.bind(this), {attach: this});
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

    try {
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
    } finally {
      destroyObjectSignals(foo);
    }
  });

  it('typed: name-deps without attach are a compile-time error', () => {
    const sig = createSignal(0);
    const noop = () => {};

    // Valid: positional SignalLike deps — attach optional.
    createEffect(noop, [sig]).destroy();

    // Valid: positional name deps with attach.
    class Host {
      @signal() accessor x = 1;
      constructor() {
        createEffect(noop, ['x'], {attach: this}).run();
      }
    }
    const host = new Host();
    try {
      destroyObjectSignals(host);

      // Invalid: positional name deps without attach.
      // @ts-expect-error — string dep requires `attach` option
      const bad = () => createEffect(noop, ['x']);
      expect(typeof bad).toBe('function');

      // Invalid: options-form name deps without attach.
      // @ts-expect-error — string dep in options requires `attach`
      const bad2 = () => createEffect(noop, {dependencies: ['x']});
      expect(typeof bad2).toBe('function');
    } finally {
      destroyObjectSignals(host);
      destroySignal(sig);
    }
  });
});
