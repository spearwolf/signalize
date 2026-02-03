import {createSignal} from './createSignal.js';
import {touch} from './touch.js';

describe('create signal with custom compare function', () => {
  it('works as expected', () => {
    const mock = jest.fn();

    const {get: signal, set: setSignal} = createSignal([0, 0, 0], {
      compare: (a: number[], b: number[]) => a.every((v, i) => v === b[i]),
    });

    signal(mock);

    expect(mock).toHaveBeenCalledTimes(0);

    touch(signal);

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith([0, 0, 0]);

    setSignal([0, 0, 0]);

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith([0, 0, 0]);

    setSignal([1, 2, 3]);

    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock).toHaveBeenCalledWith([1, 2, 3]);

    setSignal([4, 5, 6], {compare: () => true});

    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock).toHaveBeenCalledWith([1, 2, 3]);

    setSignal(null, {compare: () => true});

    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock).toHaveBeenCalledWith([1, 2, 3]);
  });
});
