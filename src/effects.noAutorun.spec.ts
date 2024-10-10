import {assertEffectsCount} from './assert-helpers.js';
import {destroySignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {createSignal} from './index.js';

describe('Effect -> autorun: false', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
  });

  it('if autorun is false then the effect is not executed by default', () => {
    let value = -1;

    const {get: signal, set: setValue} = createSignal(0);

    const effectCallback = jest.fn(() => {
      value = signal();
    });

    const effect = createEffect(effectCallback, {autorun: false});

    assertEffectsCount(1);

    expect(effectCallback).toHaveBeenCalledTimes(0);
    expect(value).toBe(-1);

    effect.run();

    expect(effectCallback).toHaveBeenCalledTimes(1);
    expect(value).toBe(0);

    setValue(1);

    expect(effectCallback).toHaveBeenCalledTimes(1);
    expect(value).toBe(0);

    effect.run();

    expect(effectCallback).toHaveBeenCalledTimes(2);
    expect(value).toBe(1);

    effect.destroy();

    setValue(2);

    expect(effectCallback).toHaveBeenCalledTimes(2);
    expect(value).toBe(1);
    expect(signal()).toBe(2);

    destroySignal(signal);
  });
});
