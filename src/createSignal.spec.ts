import {createSignal, isSignal} from './createSignal';

describe('createSignal', () => {
  it('works as expected', () => {
    const [num, setNum] = createSignal(1);
    const [str, setStr] = createSignal('foo');
    const [obj, setObj] = createSignal<Object>();

    expect(num()).toBe(1);
    expect(str()).toBe('foo');
    expect(obj()).toBeUndefined();

    setNum(666);
    setStr('bar');

    const myObj = {};
    setObj(myObj);

    expect(num()).toBe(666);
    expect(str()).toBe('bar');
    expect(obj()).toBe(myObj);
  });

  it('isSignal', () => {
    const [signal, set] = createSignal();
    expect(isSignal(signal)).toBe(true);
    expect(isSignal(set)).toBe(false);
    expect(isSignal(() => {})).toBe(false);
  });
});
