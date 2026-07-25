import {assertEffectsCount} from './assert-helpers.js';
import {$effect} from './constants.js';
import {EffectImpl} from './EffectImpl.js';
import {createEffect, onCreateEffect, onDestroyEffect} from './effects.js';

describe('onCreateEffect', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
  });

  it('creating an effect triggers a on-create-effect event', () => {
    const effectCreated = vi.fn();
    const effectDestroyed = vi.fn();

    const unsubscribeCreateEffect = onCreateEffect(effectCreated);
    const unsubscribeDestroyEffect = onDestroyEffect(effectDestroyed);

    const effect = createEffect(() => {});

    expect(effectCreated).toHaveBeenCalledTimes(1);
    expect(effectDestroyed).toHaveBeenCalledTimes(0);
    expect(effectCreated.mock.calls[0][0]).toBeInstanceOf(EffectImpl);

    unsubscribeCreateEffect();

    expect(effectCreated).toHaveBeenCalledTimes(1);
    expect(effectDestroyed).toHaveBeenCalledTimes(0);

    assertEffectsCount(1);

    effect.destroy();

    expect(effectDestroyed).toHaveBeenCalledTimes(1);
    expect(effectDestroyed.mock.calls[0][0]).toBe(
      effectCreated.mock.calls[0][0],
    );

    unsubscribeDestroyEffect();
  });

  it('Effect wrapper clears its [$effect] reference after destroy', () => {
    const effect = createEffect(() => {});

    expect(effect[$effect]).toBeInstanceOf(EffectImpl);

    effect.destroy();

    // Internal listener (once on DESTROY) clears the impl reference so the
    // wrapper does not pin a destroyed effect alive for GC.
    expect(effect[$effect]).toBeUndefined();
  });

  it('Effect wrapper [$effect] is cleared even when impl is destroyed externally', () => {
    const effect = createEffect(() => {});

    expect(effect[$effect]).toBeInstanceOf(EffectImpl);

    // Destroy via the underlying impl (the once-listener on DESTROY
    // is what makes the wrapper reset, regardless of which side initiates).
    effect[$effect].destroy();

    expect(effect[$effect]).toBeUndefined();
  });
});
