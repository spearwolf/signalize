import {createSignal} from '.';
import {assertEffectsCount} from './assert-helpers';
import {destroySignal} from './createSignal';
import {createEffect} from './effects-api';

describe('Effect -> autorun: false', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
  });

  it('if autorun is false then the effect is not executed by default', () => {
    let value = -1;

    const [signal, setValue] = createSignal(0);

    const effectCallback = jest.fn(() => {
      value = signal();
    });

    const [run, unsubscribe] = createEffect({autorun: false}, effectCallback);

    assertEffectsCount(1);

    expect(effectCallback).toBeCalledTimes(0);
    expect(value).toBe(-1);

    run();

    expect(effectCallback).toBeCalledTimes(1);
    expect(value).toBe(0);

    setValue(1);

    expect(effectCallback).toBeCalledTimes(1);
    expect(value).toBe(0);

    run();

    expect(effectCallback).toBeCalledTimes(2);
    expect(value).toBe(1);

    unsubscribe();

    setValue(2);

    expect(effectCallback).toBeCalledTimes(2);
    expect(value).toBe(1);
    expect(signal()).toBe(2);

    destroySignal(signal);
  });
});
