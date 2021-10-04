import {createSignal} from './createSignal';

describe('create lazy signal', () => {
  it('works as expected', () => {
    const lazyFn = jest.fn(() => 'foo');
    const [val, setValue] = createSignal(lazyFn, {lazy: true});

    expect(val()).toBe('foo');
    expect(val()).toBe('foo');
    expect(lazyFn).toBeCalledTimes(1);

    const lazyFn2 = jest.fn(() => 'bar');
    setValue(lazyFn2, {lazy: true});

    expect(val()).toBe('bar');

    expect(lazyFn).toBeCalledTimes(1);
    expect(lazyFn2).toBeCalledTimes(1);

    setValue('plah');

    expect(val()).toBe('plah');
  });
});
