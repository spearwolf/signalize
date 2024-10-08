import {createSignal} from './createSignal.js';
import {touch} from './touch.js';

describe('create signal with custom compare function', () => {
  it('works as expected', () => {
    const mock = jest.fn();

    const {get: signal, set: setSignal} = createSignal([0, 0, 0], {
      compareFn: (a: number[], b: number[]) => a.every((v, i) => v === b[i]),
    });

    signal(mock);

    expect(mock).toBeCalledTimes(0);

    touch(signal);

    expect(mock).toBeCalledTimes(1);
    expect(mock).toBeCalledWith([0, 0, 0]);

    setSignal([0, 0, 0]);

    expect(mock).toBeCalledTimes(1);
    expect(mock).toBeCalledWith([0, 0, 0]);

    setSignal([1, 2, 3]);

    expect(mock).toBeCalledTimes(2);
    expect(mock).toBeCalledWith([1, 2, 3]);

    setSignal([4, 5, 6], {compareFn: () => true});

    expect(mock).toBeCalledTimes(2);
    expect(mock).toBeCalledWith([1, 2, 3]);

    setSignal(null, {compareFn: () => true});

    expect(mock).toBeCalledTimes(2);
    expect(mock).toBeCalledWith([1, 2, 3]);
  });
});
