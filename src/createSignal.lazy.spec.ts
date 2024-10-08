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
