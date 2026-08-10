import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {destroySignal} from './signal-core.js';

describe('nested effects', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  it('nested effects isolation works as expected', () => {
    const a = createSignal(123);
    const b = createSignal(0);

    let valA = 0;
    let valB = 0;

    const callingA = vi.fn();
    const callingB = vi.fn();
    const cleanupA = vi.fn();
    const cleanupB = vi.fn();

    const effect = createEffect(() => {
      valA = a.get();

      callingA();

      createEffect(() => {
        valB += b.get() + 1;

        callingB();

        return cleanupB;
      });

      return cleanupA;
    });

    try {
      expect(a.value, 'a.value should be 123').toBe(123);
      expect(valA, 'valA should be 123').toBe(123);
      expect(callingA, 'callingA').toHaveBeenCalled();
      expect(cleanupA, 'cleanupA').not.toHaveBeenCalled();

      expect(b.value, 'b.value should be 0').toBe(0);
      expect(valB, 'valB should be 1').toBe(1);
      expect(callingB, 'callingA').toHaveBeenCalled();
      expect(cleanupB, 'cleanupB').not.toHaveBeenCalled();

      a.set(666);

      expect(valA).toBe(666);
      expect(callingA, 'callingA').toHaveBeenCalledTimes(2);
      expect(cleanupA, 'cleanupA').toHaveBeenCalled();

      // When outer effect re-runs, inner effects are destroyed (with cleanup)
      // and recreated. The new inner effect runs immediately due to autorun.

      expect(
        valB,
        'valB should be updated due to recreated inner effect!',
      ).toBe(2);
      expect(callingB, 'callingB').toHaveBeenCalledTimes(2);
      expect(
        cleanupB,
        'cleanupB should be called when inner effect is destroyed',
      ).toHaveBeenCalledTimes(1);

      b.set(2);

      expect(callingA, 'callingA').toHaveBeenCalledTimes(2);
      expect(cleanupA, 'cleanupA').toHaveBeenCalledTimes(1);

      // valB += b.get() + 1 => valB = 2 + 2 + 1 = 5
      expect(valB, 'valB should be updated!').toBe(5);
      expect(callingB, 'callingB').toHaveBeenCalledTimes(3);
      expect(cleanupB, 'cleanupB').toHaveBeenCalledTimes(2);

      destroySignal(a);

      expect(cleanupA, 'cleanupA').toHaveBeenCalledTimes(2);

      // after the outer effect destruction, the inner effect should be destroyed as well

      expect(cleanupB, 'cleanupB').toHaveBeenCalledTimes(3);
    } finally {
      effect.destroy();
      destroySignal(a, b);
    }
  });
});
