import {assertEffectsCount} from './__testing__/assert-helpers.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {destroySignal} from './signal-core.js';

/** Give the promise of an async effect callback a chance to settle. */
const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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

    try {
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
    } finally {
      effect.destroy();
      destroySignal(a);
    }
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

    try {
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
    } finally {
      effect.destroy();
      destroySignal(a, b);
    }
  });

  it('async cleanup hook is called when effect is destroyed', async () => {
    const {get: a, set: setA} = createSignal(123);

    const cleanupValues: number[] = [];

    const effect = createEffect(async () => {
      const val = a();
      return () => {
        cleanupValues.push(val);
      };
    });

    try {
      expect(cleanupValues).toHaveLength(0);

      // The cleanup of an async run is only kept once its promise has settled.
      await settled();

      // Update signal to trigger cleanup
      setA(456);
      expect(cleanupValues).toEqual([123]);

      await settled();

      // Destroy effect and verify cleanup is called — synchronously, like a
      // cleanup returned from a plain callback.
      effect.destroy();

      expect(cleanupValues).toEqual([123, 456]);
    } finally {
      effect.destroy();
      destroySignal(a);
    }
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

    try {
      expect(cleanupCallCount).toBe(0);

      // Destroy the effect
      effect.destroy();

      expect(cleanupCallCount).toBe(1);

      // Destroying again should do nothing
      effect.destroy();
      effect.destroy();

      expect(cleanupCallCount).toBe(1);
    } finally {
      effect.destroy();
      destroySignal(a);
    }
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

    try {
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
    } finally {
      effect.destroy();
      destroySignal(interval);
    }
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

    try {
      expect(cleanupLog).toEqual([]);

      // Destroy all effects
      effect1.destroy();
      effect2.destroy();
      effect3.destroy();

      expect(cleanupLog).toEqual(['effect1', 'effect2', 'effect3']);
    } finally {
      effect1.destroy();
      effect2.destroy();
      effect3.destroy();
      destroySignal(a, b, c);
    }
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

    try {
      expect(cleanupLog).toEqual([]);

      // Destroy parent effect
      parentEffect.destroy();

      // Both parent and child cleanup should be called
      expect(cleanupLog).toContain('parent');
      expect(cleanupLog).toContain('child');
    } finally {
      parentEffect.destroy();
      destroySignal(a, b);
    }
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

    try {
      // Effect was created but never ran
      expect(cleanupCalled).toBe(false);

      // Destroy effect
      effect.destroy();

      // Cleanup should not be called since effect never ran
      expect(cleanupCalled).toBe(false);
    } finally {
      effect.destroy();
      destroySignal(a);
    }
  });

  it('nested effects cleanup hooks are called when parent re-runs', () => {
    const {get: a, set: setA} = createSignal(1);
    const {get: b} = createSignal(2);

    const cleanupLog: string[] = [];
    const runLog: string[] = [];

    const parentEffect = createEffect(() => {
      const aVal = a();
      runLog.push(`parent:${aVal}`);

      createEffect(() => {
        const bVal = b();
        runLog.push(`child:${bVal}`);
        return () => cleanupLog.push(`child-cleanup:${bVal}`);
      });

      return () => cleanupLog.push(`parent-cleanup:${aVal}`);
    });

    try {
      // Initial run
      expect(runLog).toEqual(['parent:1', 'child:2']);
      expect(cleanupLog).toEqual([]);

      // Update parent signal - should trigger cleanup of child effect
      setA(10);

      expect(runLog).toEqual(['parent:1', 'child:2', 'parent:10', 'child:2']);
      // Parent cleanup is called, then child cleanup is called (child is destroyed before parent re-runs its callback)
      expect(cleanupLog).toEqual(['parent-cleanup:1', 'child-cleanup:2']);

      // Destroy parent effect
      parentEffect.destroy();

      expect(cleanupLog).toEqual([
        'parent-cleanup:1',
        'child-cleanup:2',
        'parent-cleanup:10',
        'child-cleanup:2',
      ]);
    } finally {
      parentEffect.destroy();
      destroySignal(a, b);
    }
  });

  it('deeply nested effects cleanup hooks are called in correct order when parent re-runs', () => {
    const {get: a, set: setA} = createSignal(1);
    const {get: b} = createSignal(2);
    const {get: c} = createSignal(3);

    const cleanupLog: string[] = [];

    const parentEffect = createEffect(() => {
      a();

      createEffect(() => {
        b();

        createEffect(() => {
          c();
          return () => cleanupLog.push('grandchild');
        });

        return () => cleanupLog.push('child');
      });

      return () => cleanupLog.push('parent');
    });

    try {
      expect(cleanupLog).toEqual([]);

      // Update parent signal - should trigger cleanup of all nested effects
      setA(10);

      // Parent cleanup, then child cleanup (which triggers grandchild cleanup)
      expect(cleanupLog).toEqual(['parent', 'child', 'grandchild']);

      parentEffect.destroy();

      // Second round of cleanups
      expect(cleanupLog).toEqual([
        'parent',
        'child',
        'grandchild',
        'parent',
        'child',
        'grandchild',
      ]);
    } finally {
      parentEffect.destroy();
      destroySignal(a, b, c);
    }
  });

  it('multiple nested effects cleanup hooks are all called when parent re-runs', () => {
    const {get: a, set: setA} = createSignal(1);
    const {get: b} = createSignal(2);
    const {get: c} = createSignal(3);

    const cleanupLog: string[] = [];

    const parentEffect = createEffect(() => {
      a();

      createEffect(() => {
        b();
        return () => cleanupLog.push('child1');
      });

      createEffect(() => {
        c();
        return () => cleanupLog.push('child2');
      });

      return () => cleanupLog.push('parent');
    });

    try {
      expect(cleanupLog).toEqual([]);

      // Update parent signal - should trigger cleanup of both nested effects
      setA(10);

      expect(cleanupLog).toEqual(['parent', 'child1', 'child2']);

      parentEffect.destroy();

      expect(cleanupLog).toEqual([
        'parent',
        'child1',
        'child2',
        'parent',
        'child1',
        'child2',
      ]);
    } finally {
      parentEffect.destroy();
      destroySignal(a, b, c);
    }
  });

  it('nested effect cleanup receives correct values when parent re-runs multiple times', () => {
    const {get: a, set: setA} = createSignal(1);

    const cleanupValues: number[] = [];

    const parentEffect = createEffect(() => {
      const aVal = a();

      createEffect(() => {
        return () => cleanupValues.push(aVal);
      });
    });

    try {
      expect(cleanupValues).toEqual([]);

      setA(2);
      expect(cleanupValues).toEqual([1]);

      setA(3);
      expect(cleanupValues).toEqual([1, 2]);

      setA(4);
      expect(cleanupValues).toEqual([1, 2, 3]);

      parentEffect.destroy();
      expect(cleanupValues).toEqual([1, 2, 3, 4]);
    } finally {
      parentEffect.destroy();
      destroySignal(a);
    }
  });
});
