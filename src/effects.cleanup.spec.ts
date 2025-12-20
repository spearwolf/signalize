import {emit, eventize, onceAsync} from '@spearwolf/eventize';
import {assertEffectsCount} from './assert-helpers.js';
import {createSignal, destroySignal} from './createSignal.js';
import {createEffect} from './effects.js';

describe('effect cleanup hook on effect destruction', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
  });

  it('cleanup hook is called when effect is destroyed (dynamic effect)', () => {
    const {get: a, set: setA} = createSignal(123);

    let cleanupCalled = false;
    let cleanupValue = 0;

    const effect = createEffect(() => {
      const val = a();
      return () => {
        cleanupCalled = true;
        cleanupValue = val;
      };
    });

    expect(cleanupCalled).toBe(false);
    expect(cleanupValue).toBe(0);

    // Update the signal to verify cleanup is called before next run
    setA(456);
    expect(cleanupCalled).toBe(true);
    expect(cleanupValue).toBe(123);

    // Reset flags
    cleanupCalled = false;
    cleanupValue = 0;

    // Now destroy the effect and verify cleanup is called
    effect.destroy();

    expect(cleanupCalled).toBe(true);
    expect(cleanupValue).toBe(456);

    destroySignal(a);
  });

  it('cleanup hook is called when effect is destroyed (static effect)', () => {
    const {get: a, set: setA} = createSignal(123);
    const {get: b} = createSignal('test');

    let cleanupCalled = false;
    let cleanupValue = 0;

    const effect = createEffect(() => {
      const val = a();
      b(); // read b as well, but it's not in dependencies
      return () => {
        cleanupCalled = true;
        cleanupValue = val;
      };
    }, [a]); // static dependency on a only

    // For static effects, initial run doesn't happen until a signal changes
    expect(cleanupCalled).toBe(false);

    // Update the signal
    setA(456);
    expect(cleanupCalled).toBe(false); // first run, no previous cleanup

    // Update again to verify cleanup is called
    setA(789);
    expect(cleanupCalled).toBe(true);
    expect(cleanupValue).toBe(456);

    // Reset flags
    cleanupCalled = false;
    cleanupValue = 0;

    // Now destroy the effect and verify cleanup is called
    effect.destroy();

    expect(cleanupCalled).toBe(true);
    expect(cleanupValue).toBe(789);

    destroySignal(a, b);
  });

  it('async cleanup hook is called when effect is destroyed', async () => {
    const {get: a, set: setA} = createSignal(123);

    const cleanupValues: number[] = [];
    const ctrl = eventize();

    const effect = createEffect(async () => {
      const val = a();
      return () => {
        cleanupValues.push(val);
        emit(ctrl, `cleanup[${cleanupValues.length}]`);
      };
    });

    expect(cleanupValues).toHaveLength(0);

    // Update signal to trigger cleanup
    setA(456);
    await onceAsync(ctrl, 'cleanup[1]');
    expect(cleanupValues).toEqual([123]);

    // Destroy effect and verify cleanup is called
    effect.destroy();

    // Wait a bit to ensure async cleanup has a chance to run
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 100);
    });

    expect(cleanupValues).toEqual([123, 456]);

    destroySignal(a);
  });

  it('cleanup hook is called only once on effect destruction', () => {
    const {get: a} = createSignal(100);

    let cleanupCallCount = 0;

    const effect = createEffect(() => {
      a();
      return () => {
        cleanupCallCount++;
      };
    });

    expect(cleanupCallCount).toBe(0);

    // Destroy the effect
    effect.destroy();

    expect(cleanupCallCount).toBe(1);

    // Destroying again should do nothing
    effect.destroy();
    effect.destroy();

    expect(cleanupCallCount).toBe(1);

    destroySignal(a);
  });

  it('cleanup hook with side effects is properly executed on destroy', () => {
    const {get: interval, set: setInterval} = createSignal(100);

    const intervals: number[] = [];
    const cleanupLog: string[] = [];

    const effect = createEffect(() => {
      const ms = interval();
      intervals.push(ms);

      // Simulate creating a resource that needs cleanup
      const resource = {id: ms};

      return () => {
        cleanupLog.push(`cleaned up resource ${resource.id}`);
      };
    });

    expect(intervals).toEqual([100]);
    expect(cleanupLog).toEqual([]);

    // Update to trigger cleanup
    setInterval(200);
    expect(intervals).toEqual([100, 200]);
    expect(cleanupLog).toEqual(['cleaned up resource 100']);

    // Destroy effect
    effect.destroy();
    expect(cleanupLog).toEqual([
      'cleaned up resource 100',
      'cleaned up resource 200',
    ]);

    destroySignal(interval);
  });

  it('multiple effects with cleanup hooks are all cleaned up on destruction', () => {
    const {get: a} = createSignal(1);
    const {get: b} = createSignal(2);
    const {get: c} = createSignal(3);

    const cleanupLog: string[] = [];

    const effect1 = createEffect(() => {
      a();
      return () => cleanupLog.push('effect1');
    });

    const effect2 = createEffect(() => {
      b();
      return () => cleanupLog.push('effect2');
    });

    const effect3 = createEffect(() => {
      c();
      return () => cleanupLog.push('effect3');
    });

    expect(cleanupLog).toEqual([]);

    // Destroy all effects
    effect1.destroy();
    effect2.destroy();
    effect3.destroy();

    expect(cleanupLog).toEqual(['effect1', 'effect2', 'effect3']);

    destroySignal(a, b, c);
  });

  it('nested effects cleanup hooks are called when parent is destroyed', () => {
    const {get: a} = createSignal(1);
    const {get: b} = createSignal(2);

    const cleanupLog: string[] = [];

    const parentEffect = createEffect(() => {
      a();

      createEffect(() => {
        b();
        return () => cleanupLog.push('child');
      });

      return () => cleanupLog.push('parent');
    });

    expect(cleanupLog).toEqual([]);

    // Destroy parent effect
    parentEffect.destroy();

    // Both parent and child cleanup should be called
    expect(cleanupLog).toContain('parent');
    expect(cleanupLog).toContain('child');

    destroySignal(a, b);
  });

  it('cleanup hook is not called if effect never ran', () => {
    const {get: a} = createSignal(1);

    let cleanupCalled = false;

    const effect = createEffect(
      () => {
        a();
        return () => {
          cleanupCalled = true;
        };
      },
      {autorun: false},
    );

    // Effect was created but never ran
    expect(cleanupCalled).toBe(false);

    // Destroy effect
    effect.destroy();

    // Cleanup should not be called since effect never ran
    expect(cleanupCalled).toBe(false);

    destroySignal(a);
  });
});
