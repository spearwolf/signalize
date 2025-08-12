import {assertEffectsCount} from './assert-helpers.js';
import {createSignal, destroySignal} from './createSignal.js';
import {createEffect} from './effects.js';

describe('nested effects', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
  });

  it('nested effects isolation works as expected', () => {
    const a = createSignal(123);
    const b = createSignal(0);

    let valA = 0;
    let valB = 0;

    const callingA = jest.fn();
    const callingB = jest.fn();
    const cleanupA = jest.fn();
    const cleanupB = jest.fn();

    createEffect(() => {
      valA = a.get();

      callingA();

      createEffect(() => {
        valB += b.get() + 1;

        callingB();

        return cleanupB;
      });

      return cleanupA;
    });

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

    // what we expect here is that the inner effect does not run

    expect(valB, 'valB should be unchanged!').toBe(1);
    expect(callingB, 'callingB').toHaveBeenCalledTimes(1);
    expect(cleanupB, 'cleanupB').not.toHaveBeenCalled();

    b.set(2);

    expect(callingA, 'callingA').toHaveBeenCalledTimes(2);
    expect(cleanupA, 'cleanupA').toHaveBeenCalledTimes(1);

    expect(valB, 'valB should be updated!').toBe(4);
    expect(callingB, 'callingB').toHaveBeenCalledTimes(2);
    expect(cleanupB, 'cleanupB').toHaveBeenCalledTimes(1);

    destroySignal(a);

    expect(cleanupA, 'cleanupA').toHaveBeenCalledTimes(2);

    // after the outer effect destruction, the inner effect should be destroyed as well

    expect(cleanupB, 'cleanupB').toHaveBeenCalledTimes(2);
  });
});
