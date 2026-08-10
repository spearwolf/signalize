import {getSubscriptionCount, once} from '@spearwolf/eventize';
import {
  assertEffectSubscriptionsCount,
  assertEffectSubscriptionsCountChange,
  assertEffectsCount,
  assertSignalDestroySubscriptionsCount,
  assertSignalDestroySubscriptionsCountChange,
  saveEffectSubscriptionsCount,
  saveSignalDestroySubscriptionsCount,
} from './__testing__/assert-helpers.js';
import {batch} from './batch.js';
import {$effect, DESTROY} from './constants.js';
import {createMemo} from './createMemo.js';
import {createSignal} from './createSignal.js';
import {createEffect, onEffectError} from './effects.js';
import {globalSignalQueue} from './global-queues.js';
import {destroySignal} from './signal-core.js';
import {touch} from './touch.js';
import type {SignalReader} from './types.js';

describe('destroySignal', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    saveEffectSubscriptionsCount(true);
    saveSignalDestroySubscriptionsCount(true);
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertEffectSubscriptionsCount(0, 'afterEach');
    assertSignalDestroySubscriptionsCount(0, 'afterEach');
  });

  it('destroy signal reader callback effect', () => {
    const {get: sigFoo, set: setFoo} = createSignal(666);

    let foo = 0;

    sigFoo((val) => {
      foo = val;
    });

    try {
      expect(foo).toBe(0);

      touch(sigFoo);

      expect(foo).toBe(666);

      assertEffectsCount(1, 'step-a');
      assertEffectSubscriptionsCountChange(1, 'step-a');
      assertSignalDestroySubscriptionsCountChange(1);

      setFoo(23);

      expect(foo).toBe(23);

      destroySignal(sigFoo);
      setFoo(512);

      expect(foo).toBe(23);

      assertEffectsCount(0, 'end');
      assertEffectSubscriptionsCountChange(-1, 'end');
      assertSignalDestroySubscriptionsCountChange(-1);
    } finally {
      destroySignal(sigFoo);
    }
  });

  it('destroy signal destroys effects and memos', () => {
    const {get: getFoo, set: setFoo} = createSignal(1);
    const {get: getBar, set: setBar} = createSignal(2);

    let foo = 0;
    let bar = 0;

    let effectCallCount = 0;
    let memoCallCount = 0;

    const effect = createEffect(() => {
      foo = getFoo();
      bar = getBar();
      ++effectCallCount;
    });

    let plah: SignalReader<number>;

    try {
      assertEffectsCount(1, 'step-a');
      assertEffectSubscriptionsCountChange(1, 'step-a');
      assertSignalDestroySubscriptionsCountChange(2, 'step-a');

      plah = createMemo(() => {
        ++memoCallCount;
        return getFoo() + getBar();
      });

      assertEffectsCount(2, 'step-b');
      assertEffectSubscriptionsCountChange(1, 'step-b');
      assertSignalDestroySubscriptionsCountChange(3, 'step-b');

      expect(foo).toBe(1);
      expect(bar).toBe(2);
      expect(plah()).toBe(3);
      expect(effectCallCount).toBe(1);
      expect(memoCallCount).toBe(1);

      setFoo(4);
      setBar(5);

      expect(foo).toBe(4);
      expect(bar).toBe(5);
      expect(plah()).toBe(9);
      expect(effectCallCount).toBe(3);
      expect(memoCallCount).toBe(3);

      destroySignal(getFoo);

      assertEffectsCount(2, 'step-c');
      assertEffectSubscriptionsCount(2, 'step-c');
      // assertSignalDestroySubscriptionsCountChange(-2, 'step-c');

      batch(() => {
        setFoo(10);
        setBar(11);
      });

      expect(foo).toBe(10);
      expect(bar).toBe(11);
      expect(plah()).toBe(21);
      expect(effectCallCount).toBe(4);
      expect(memoCallCount).toBe(4);

      assertEffectsCount(2, 'step-d');
      assertEffectSubscriptionsCount(2, 'step-d');

      destroySignal(getBar);

      batch(() => {
        setFoo(22);
        setBar(23);
      });

      expect(foo).toBe(10);
      expect(bar).toBe(11);
      expect(plah()).toBe(21);
      expect(effectCallCount).toBe(4);
      expect(memoCallCount).toBe(4);

      assertEffectsCount(0, 'step-e');
      assertEffectSubscriptionsCount(0, 'step-e');
      // assertSignalDestroySubscriptionsCountChange(-2, 'step-e');

      destroySignal(plah);

      assertEffectsCount(0, 'end');
      assertEffectSubscriptionsCount(0, 'end');
      // assertSignalDestroySubscriptionsCountChange(-1, 'end');
    } finally {
      effect.destroy();
      destroySignal(plah, getFoo, getBar);
    }
  });

  it('a destroyed signal does not report its reads to the running effect', () => {
    // The other half of the `destroySignal()` promise. The write half — a
    // destroyed signal notifies nobody — is covered above; this is the read
    // half: an effect that reads a corpse must not subscribe to its id.
    // Without the guard the effect carries a dependency on a signal that can
    // never fire again, for as long as the effect lives.
    const alive = createSignal(1);
    const dead = createSignal(2);

    destroySignal(dead);

    const subscriptionsBefore = getSubscriptionCount(globalSignalQueue);

    const effect = createEffect(() => {
      alive.get();
      dead.get();
    });

    try {
      expect(
        getSubscriptionCount(globalSignalQueue) - subscriptionsBefore,
        'the effect subscribed to the live signal and to nothing else',
      ).toBe(1);
    } finally {
      effect.destroy();
      destroySignal(alive);
    }
  });

  describe('a dependency destroyed while the effect is running', () => {
    it('still destroys the effect — at the end of that run, not never', () => {
      // The self-destruction is postponed while a run is in progress (an
      // effect rebuilding its dependency set may pass through an empty one),
      // but postponed is not cancelled: the run ends with nothing subscribed,
      // so the effect goes.
      const a = createSignal(1);

      let runs = 0;

      const effect = createEffect(() => {
        ++runs;
        a.get();
        if (runs === 2) {
          destroySignal(a);
        }
      });

      try {
        assertEffectsCount(1, 'after the first run');

        a.set(2);

        expect(runs).toBe(2);
        assertEffectsCount(
          0,
          'the last dependency died during the run — the effect must not survive it',
        );
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('keeps the effect alive when the same run subscribes to a new signal', () => {
      // The counterpart: the dependency set is empty for a moment inside the
      // run and refilled before it ends. Nothing to destroy here.
      const a = createSignal(1);
      const b = createSignal(10);

      let swap = false;
      const seen: number[] = [];

      const effect = createEffect(() => {
        if (swap) {
          destroySignal(a); // the only current dependency dies mid-run
          seen.push(b.get()); // ...and a new one takes its place
        } else {
          seen.push(a.get());
        }
      });

      try {
        expect(seen).toEqual([1]);

        swap = true;
        a.set(2);

        expect(seen).toEqual([1, 10]);
        assertEffectsCount(
          1,
          'the effect swapped dependencies, it did not die',
        );

        b.set(20);

        expect(seen, 'and the new dependency really triggers it').toEqual([
          1, 10, 20,
        ]);
      } finally {
        effect.destroy();
        destroySignal(a, b);
      }
    });

    it('waits for the outermost run when the effect re-entered itself', () => {
      // The dependency dies inside a nested run (#runDepth === 2). The
      // teardown has to wait for the outer frame to finish — destroying at
      // the end of the inner run would pull the ground out from under a
      // callback that is still executing.
      const a = createSignal(0);

      const log: string[] = [];

      const effect = createEffect(() => {
        const val = a.get();
        log.push(`enter:${val}`);
        if (val === 1) {
          a.set(2); // re-enters run() synchronously
          log.push('after-inner');
        } else if (val === 2) {
          destroySignal(a); // the only dependency dies, one frame down
        }
        log.push(`leave:${val}`);
      });

      try {
        once(effect[$effect]!, DESTROY, () => {
          log.push('destroyed');
        });

        a.set(1);

        expect(log).toEqual([
          'enter:0',
          'leave:0',
          'enter:1',
          'enter:2',
          'leave:2',
          'after-inner',
          'leave:1',
          'destroyed',
        ]);

        assertEffectsCount(0, 'destroyed once the outermost run returned');
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('destroys the effect even when that run throws', () => {
      // The flag is set, then the callback explodes. No further run can
      // follow — the dependencies are gone, that is what set the flag — so
      // dropping the teardown here would strand the effect in
      // getEffectsCount() and on the effect queue for good.
      const a = createSignal(1);

      let runs = 0;

      const effect = createEffect(() => {
        ++runs;
        a.get();
        if (runs === 2) {
          destroySignal(a);
          throw new Error('boom');
        }
      });

      try {
        assertEffectsCount(1, 'after the first run');

        expect(() => a.set(2), 'the run keeps its own error').toThrow('boom');

        assertEffectsCount(0, 'and the effect is torn down all the same');
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('reports a teardown error through onEffectError instead of raising it', () => {
      // The deferred destroy() runs the pending cleanup, and that cleanup
      // throws. Nobody asked for this teardown, so its error must not surface
      // at whoever happened to write the signal — it goes to the channel.
      const a = createSignal(1);

      const errors: Array<{message: string; phase: string}> = [];
      const unsubscribe = onEffectError(({error, phase}) => {
        errors.push({message: (error as Error).message, phase});
      });

      let runs = 0;

      const effect = createEffect(() => {
        ++runs;
        const val = a.get();
        if (val === 2) {
          destroySignal(a);
        }
        return () => {
          if (runs === 2) throw new Error('cleanup boom');
        };
      });

      try {
        expect(() => a.set(2), 'the writer is left alone').not.toThrow();

        expect(errors).toEqual([{message: 'cleanup boom', phase: 'cleanup'}]);
        assertEffectsCount(0, 'the teardown completed despite the error');
      } finally {
        unsubscribe();
        effect.destroy();
        destroySignal(a);
      }
    });
  });
});
