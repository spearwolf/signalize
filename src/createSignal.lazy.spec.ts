import {createSignal} from './createSignal.js';

describe('create lazy signal', () => {
  it('works as expected', () => {
    const lazyFn = jest.fn(() => 'foo');
    const {get: val, set: setValue} = createSignal(lazyFn, {lazy: true});

    expect(val()).toBe('foo');
    expect(val()).toBe('foo');
    expect(lazyFn).toHaveBeenCalledTimes(1);

    const lazyFn2 = jest.fn(() => 'bar');
    setValue(lazyFn2, {lazy: true});

    expect(val()).toBe('bar');

    expect(lazyFn).toHaveBeenCalledTimes(1);
    expect(lazyFn2).toHaveBeenCalledTimes(1);

    setValue('plah');

    expect(val()).toBe('plah');
  });

  it('set() stores function as value — there is no updater-function pattern', () => {
    const count = createSignal(0);

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
  });

  it('set() with {lazy: true} defers evaluation to next read', () => {
    const count = createSignal(10);

    const computeFn = jest.fn(() => 42);
    count.set(computeFn, {lazy: true});

    // The function has NOT been called yet
    expect(computeFn).toHaveBeenCalledTimes(0);

    // On the next read, the function is evaluated and the result becomes the value
    expect(count.get()).toBe(42);
    expect(computeFn).toHaveBeenCalledTimes(1);

    // Subsequent reads return the cached value without re-calling the function
    expect(count.get()).toBe(42);
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('laziness is NOT catching on', () => {
    const lazy0 = jest.fn(() => 'foo');
    const lazy1 = jest.fn(() => 'bar');

    const {get: val, set: setValue} = createSignal(lazy0, {lazy: true});

    expect(val()).toBe('foo');
    expect(val()).toBe('foo');
    expect(lazy0).toHaveBeenCalledTimes(1);

    setValue(lazy1);

    expect(val()).toBe(lazy1);

    expect(lazy0).toHaveBeenCalledTimes(1);
    expect(lazy1).toHaveBeenCalledTimes(0);
  });
});
