import {
  assertEffectSubscriptionsCountChange,
  saveEffectSubscriptionsCount,
} from './assert-helpers.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {destroySignal} from './signal-core.js';

describe('assertEffectSubscriptionsCountChange', () => {
  it('reports the delta relative to a non-zero baseline (TEST-007)', () => {
    // Build a non-zero baseline first: this is exactly where the helper
    // breaks, because g_initialEffectCount is not 0.
    const {get: sigOne} = createSignal(1);
    const effectOne = createEffect(() => {
      sigOne();
    });

    saveEffectSubscriptionsCount(true);

    const {get: sigTwo} = createSignal(2);
    const effectTwo = createEffect(() => {
      sigTwo();
    });

    assertEffectSubscriptionsCountChange(1);

    effectTwo.destroy();

    assertEffectSubscriptionsCountChange(-1);

    effectOne.destroy();
    destroySignal(sigOne, sigTwo);
  });
});
