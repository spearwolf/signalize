import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './createSignal.js';
import {destroySignal, signalImpl} from './signal-core.js';

describe('create lazy signal', () => {
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

  it('works as expected', () => {
    const lazyFn = vi.fn(() => 'foo');
    const {get: val, set: setValue} = createSignal(lazyFn, {lazy: true});

    try {
      expect(val()).toBe('foo');
      expect(val()).toBe('foo');
      expect(lazyFn).toHaveBeenCalledTimes(1);

      const lazyFn2 = vi.fn(() => 'bar');
      setValue(lazyFn2, {lazy: true});

      expect(val()).toBe('bar');

      expect(lazyFn).toHaveBeenCalledTimes(1);
      expect(lazyFn2).toHaveBeenCalledTimes(1);

      setValue('plah');

      expect(val()).toBe('plah');
    } finally {
      destroySignal(val);
    }
  });

  it('set() stores function as value — there is no updater-function pattern', () => {
    const count = createSignal(0);

    try {
      // BAD pattern: passing a function to set() does NOT work like React's setState
      // The function itself becomes the signal value, it is NOT called with the current value
      //
      // Note: TypeScript correctly prevents `count.set((v: number) => v + 1)` because
      // the type `(v: number) => number` doesn't match `number | (() => number)`.
      // But this can still happen with `any` types or untyped code, so we test runtime behavior.
      const updater = (v: number) => v + 1;
      (count.set as any)(updater);

      // The value is the function itself, not the result of calling it
      expect(count.value).toBe(updater);
      expect(typeof count.value).toBe('function');

      // The correct way to update based on current value:
      count.set(0); // reset to number
      count.set(count.value + 1);
      expect(count.value).toBe(1);
      count.set(count.value + 1);
      expect(count.value).toBe(2);
    } finally {
      destroySignal(count);
    }
  });

  it('set() with {lazy: true} defers evaluation to next read', () => {
    const count = createSignal(10);

    try {
      const computeFn = vi.fn(() => 42);
      count.set(computeFn, {lazy: true});

      // The function has NOT been called yet
      expect(computeFn).toHaveBeenCalledTimes(0);

      // On the next read, the function is evaluated and the result becomes the value
      expect(count.get()).toBe(42);
      expect(computeFn).toHaveBeenCalledTimes(1);

      // Subsequent reads return the cached value without re-calling the function
      expect(count.get()).toBe(42);
      expect(computeFn).toHaveBeenCalledTimes(1);
    } finally {
      destroySignal(count);
    }
  });

  it('laziness is NOT catching on', () => {
    const lazy0 = vi.fn(() => 'foo');
    const lazy1 = vi.fn(() => 'bar');

    const {get: val, set: setValue} = createSignal(lazy0, {lazy: true});

    try {
      expect(val()).toBe('foo');
      expect(val()).toBe('foo');
      expect(lazy0).toHaveBeenCalledTimes(1);

      setValue(lazy1);

      expect(val()).toBe(lazy1);

      expect(lazy0).toHaveBeenCalledTimes(1);
      expect(lazy1).toHaveBeenCalledTimes(0);
    } finally {
      destroySignal(val);
    }
  });

  it('set(undefined) replaces the factory of a lazy signal that was never read (TEST-024)', () => {
    // `lazy !== this.lazy` is the only clause of the writer condition that
    // sees this write: the new value is `undefined` and so is `#value` on an
    // unread lazy signal, so the value comparison in the third clause says
    // "no change" and the factory would stay in place — the write would be
    // swallowed and the next read would hand out `'foo'` instead of
    // `undefined`.
    const lazyFn = vi.fn(() => 'foo');
    const sig = createSignal<string | undefined>(lazyFn, {lazy: true});

    try {
      sig.set(undefined);

      expect(sig.get(), 'the write went through').toBeUndefined();
      expect(
        lazyFn,
        'the factory was dropped unevaluated',
      ).not.toHaveBeenCalled();
    } finally {
      sig.destroy();
    }
  });

  it('the first read releases the factory function (TEST-024)', () => {
    // A lazy factory is a closure over whatever the caller had in scope. It
    // is needed exactly once; keeping it after that pins everything it
    // captured for the lifetime of the signal, and nothing in the public
    // surface would ever show it.
    const captured = {payload: 'held by the factory closure'};
    const sig = createSignal(() => captured.payload, {lazy: true});

    try {
      expect(
        signalImpl(sig).valueFn,
        'the factory is held until the first read',
      ).toBeTypeOf('function');

      expect(sig.get()).toBe('held by the factory closure');

      expect(
        signalImpl(sig).valueFn,
        'and released with it — the closure is not kept for a second call',
      ).toBeUndefined();
    } finally {
      sig.destroy();
    }
  });
});
