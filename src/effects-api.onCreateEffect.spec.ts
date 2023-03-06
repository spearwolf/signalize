import {assertEffectsCount} from './assert-helpers';
import {createEffect, onCreateEffect, onDestroyEffect} from './effects-api';

import {Effect} from './Effect';

describe('onCreateEffect', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
  });

  it('creating an effect triggers a on-create-effect event', () => {
    const effectCreated = jest.fn();
    const effectDestroyed = jest.fn();

    const unsubscribeCreateEffect = onCreateEffect(effectCreated);
    const unsubscribeDestroyEffect = onDestroyEffect(effectDestroyed);

    const [, unsubscribeEffect] = createEffect(() => {});

    expect(effectCreated).toBeCalledTimes(1);
    expect(effectDestroyed).toBeCalledTimes(0);
    expect(effectCreated.mock.calls[0][0]).toBeInstanceOf(Effect);

    unsubscribeCreateEffect();

    expect(effectCreated).toBeCalledTimes(1);
    expect(effectDestroyed).toBeCalledTimes(0);

    assertEffectsCount(1);

    unsubscribeEffect();

    expect(effectDestroyed).toBeCalledTimes(1);
    expect(effectDestroyed.mock.calls[0][0]).toBe(
      effectCreated.mock.calls[0][0],
    );

    unsubscribeDestroyEffect();
  });
});
