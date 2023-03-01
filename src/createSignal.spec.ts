import {createEffect} from './createEffect';
import {createSignal, isSignal, muteSignal, unmuteSignal} from './createSignal';

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

  it('signal reader has an optional effect callback as argument', () => {
    const [signal, set] = createSignal(666);
    const effect = jest.fn();

    signal(effect);

    expect(effect).toBeCalledWith(666);

    set(1001);

    expect(effect).toBeCalledWith(1001);
  });

  it('returns the given signal if the initialValue a signal', () => {
    const [signal, set] = createSignal(666);
    const [otherSignal, setOther] = createSignal(signal);

    expect(signal).toBe(otherSignal);
    expect(set).toBe(setOther);
  });

  it('mute, unmute and unsubscribe', () => {
    const [signal, set] = createSignal(666);

    let foo = 0;

    const unsubscribe = createEffect(() => {
      foo = signal();
    });

    expect(foo).toBe(666);

    set(23);

    expect(foo).toBe(23);

    muteSignal(signal);
    set(44);

    expect(foo).toBe(23);

    unmuteSignal(signal);

    expect(foo).toBe(23);

    set(111);

    expect(foo).toBe(111);

    unsubscribe();

    set(222);

    expect(foo).toBe(111);
  });
});
