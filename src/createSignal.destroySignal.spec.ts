import {getSubscriptionCount, once} from '@spearwolf/eventize';
import {
  assertEffectSubscriptionsCount,
  assertEffectSubscriptionsCountChange,
  assertEffectsCount,
  assertLinksCount,
  assertSignalDestroySubscriptionsCount,
  assertSignalDestroySubscriptionsCountChange,
  assertSignalsCount,
  getGroupMemberCounts,
  saveEffectSubscriptionsCount,
  saveSignalDestroySubscriptionsCount,
} from './__testing__/assert-helpers.js';
import {batch} from './batch.js';
import {$effect, DESTROY} from './constants.js';
import {createMemo} from './createMemo.js';
import {createSignal} from './createSignal.js';
import {createEffect, onEffectError} from './effects.js';
import {globalSignalQueue} from './global-queues.js';
import {link} from './link.js';
import {SignalAutoMap} from './SignalAutoMap.js';
import {SignalGroup} from './SignalGroup.js';
import {destroySignal, signalImpl} from './signal-core.js';
import {touch} from './touch.js';
import type {SignalReader} from './types.js';

describe('destroySignal', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
    saveEffectSubscriptionsCount(true);
    saveSignalDestroySubscriptionsCount(true);
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
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

  describe('the destroy delivery is isolated, like a write (BUG-011)', () => {
    it('serves every subscriber behind a throwing effect cleanup', () => {
      // Subscription order on `globalDestroySignalQueue` is registration
      // order, and the effect registers first — so everything created after
      // it is exactly what a throwing cleanup used to skip. All three
      // victims from the finding are here: the link stayed subscribed to a
      // dead source, the group kept the dead SignalImpl, the auto map kept
      // its entry.
      const a = createSignal(0);
      const host = {a};
      let propagated = 0;

      const effect = createEffect(() => {
        a.get();
        return () => {
          throw new Error('cleanup boom');
        };
      });
      const sibling = link(a.get, (value: number) => {
        propagated = value;
      });
      const group = SignalGroup.findOrCreate({});
      group.attachSignal(a.get);
      const map = SignalAutoMap.fromProps(host, ['a']);

      try {
        expect(map.get('a'), 'the map holds that signal, not a copy').toBe(a);
        expect(propagated, 'the link is live before the destroy').toBe(0);

        expect(
          () => destroySignal(a),
          'the failure still reaches the caller',
        ).toThrow('cleanup boom');

        expect(sibling.isDestroyed, 'the link let go of the dead source').toBe(
          true,
        );
        expect(
          getGroupMemberCounts(group).signals,
          'the group dropped the dead signal',
        ).toBe(0);
        expect(map.has('a'), 'the auto map dropped its entry').toBe(false);
      } finally {
        // Against the unfixed code the link, the group entry and the map
        // entry are still there, and the file's counter guards would then
        // fail in every later test of this file rather than in this one.
        // The test takes its own damage back; against the fixed code all
        // three lines are no-ops.
        sibling.destroy();
        map.clear();
        group.clear();
        try {
          effect.destroy();
        } catch {
          // the cleanup throws by design; already reported above
        }
        destroySignal(a);
      }
    });

    it('bundles two failing subscribers into an AggregateError, in delivery order', () => {
      const a = createSignal(0);

      const first = createEffect(() => {
        a.get();
        return () => {
          throw new Error('cleanup one');
        };
      });
      const second = createEffect(() => {
        a.get();
        return () => {
          throw new Error('cleanup two');
        };
      });

      try {
        let caught: unknown;
        try {
          destroySignal(a);
        } catch (err) {
          caught = err;
        }

        expect(caught).toBeInstanceOf(AggregateError);
        expect(
          (caught as AggregateError).errors.map(
            (err) => (err as Error).message,
          ),
          'both failures, in the order they were delivered',
        ).toEqual(['cleanup one', 'cleanup two']);

        assertEffectsCount(0, 'both effects tore themselves down');
      } finally {
        for (const effect of [first, second]) {
          try {
            effect.destroy();
          } catch {
            // the cleanups throw by design
          }
        }
        destroySignal(a);
      }
    });

    it('rethrows a lone failure unchanged, with its identity intact', () => {
      // The counter-probe: one failing subscriber must not become an
      // `AggregateError`. `toBe` on the instance, not `toThrow` on the
      // message — a wrapper carrying the same message would pass that.
      const a = createSignal(0);
      const boom = new Error('cleanup boom');

      const effect = createEffect(() => {
        a.get();
        return () => {
          throw boom;
        };
      });

      try {
        let caught: unknown;
        try {
          destroySignal(a);
        } catch (err) {
          caught = err;
        }

        expect(caught, 'the same object, not a wrapper').toBe(boom);
      } finally {
        try {
          effect.destroy();
        } catch {
          // thrown by design
        }
        destroySignal(a);
      }
    });

    it('leaves a destroy without a failing subscriber alone', () => {
      // The other counter-probe: the ordinary path must stay silent.
      const a = createSignal(0);
      let cleanupRuns = 0;

      const effect = createEffect(() => {
        a.get();
        return () => {
          ++cleanupRuns;
        };
      });

      try {
        expect(() => destroySignal(a)).not.toThrow();
        expect(cleanupRuns).toBe(1);
        assertEffectsCount(0, 'the effect lost its last dependency');
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('stops at the failing signal when several are destroyed at once', () => {
      // Pre-existing and untouched here: the frame is opened per signal, so
      // `destroySignal(a, b)` still leaves `b` alive when a subscriber of
      // `a` throws. Isolation is a property of one delivery, not of the
      // argument list. Asserted so that widening the frame to the whole
      // loop — which would change the throw form across signals — has to be
      // a decision instead of a side effect.
      const a = createSignal(0);
      const b = createSignal(0);

      const effect = createEffect(() => {
        a.get();
        return () => {
          throw new Error('cleanup boom');
        };
      });

      try {
        expect(() => destroySignal(a, b)).toThrow('cleanup boom');

        expect(signalImpl(a).destroyed, 'a is gone').toBe(true);
        expect(signalImpl(b).destroyed, 'b never got its turn').toBe(false);
      } finally {
        try {
          effect.destroy();
        } catch {
          // thrown by design
        }
        destroySignal(a, b);
      }
    });

    it('rethrows at the group when no delivery frame is open (soft-detach)', () => {
      // `SignalGroup#off()` emits the soft-detach on the same queue, and it
      // does *not* open a delivery frame. The effect listener then has
      // nowhere to park its failure and rethrows at once, where the group's
      // own per-signal guard picks it up — the same contract `[RECALL]`
      // keeps for a `run()` outside any delivery.
      const a = createSignal(0);
      const group = SignalGroup.findOrCreate({});
      group.attachSignal(a.get);

      const effect = createEffect(() => {
        a.get();
        return () => {
          throw new Error('cleanup boom');
        };
      });

      try {
        expect(() => group.off(), 'raised by the group, not swallowed').toThrow(
          'cleanup boom',
        );
        assertEffectsCount(0, 'the effect lost its only dependency');
      } finally {
        group.clear();
        try {
          effect.destroy();
        } catch {
          // thrown by design
        }
        destroySignal(a);
      }
    });

    it('rethrows at the group even when a foreign delivery frame is open', () => {
      // The counter-probe to the test above, and the reason the listener
      // asks *which* frame is open rather than whether one is:
      // `g_deliveryDepth` is module-global. A `group.off()` called from an
      // effect callback runs inside the write's frame — a frame the group
      // never opened and knows nothing about. Parking the failure there
      // would let `off()` return successfully and surface the error at the
      // writer instead, one caller and one moment removed from the code
      // that asked for the teardown. Only `destroySignal()` opens a frame
      // for this queue, so the soft-detach rethrows here too.
      const a = createSignal(0);
      const w = createSignal(0);
      const group = SignalGroup.findOrCreate({});
      group.attachSignal(a.get);

      const victim = createEffect(() => {
        a.get();
        return () => {
          throw new Error('cleanup boom');
        };
      });

      let offThrew: string | undefined;
      const driver = createEffect(() => {
        if (w.get() === 1) {
          try {
            group.off();
          } catch (err) {
            offThrew = (err as Error).message;
          }
        }
      });

      try {
        expect(
          () => w.set(1),
          'the write is not the one who asked for the teardown',
        ).not.toThrow();

        expect(offThrew, 'the group got its own failure back').toBe(
          'cleanup boom',
        );
        assertEffectsCount(1, 'only the driver is left');
      } finally {
        group.clear();
        try {
          victim.destroy();
        } catch {
          // thrown by design
        }
        driver.destroy();
        destroySignal(a, w);
      }
    });
  });

  it('lets the signal itself say whether it is gone (API-008)', () => {
    const sig = createSignal(1);

    try {
      expect(sig.destroyed, 'a fresh signal is alive').toBe(false);

      destroySignal(sig);

      expect(sig.destroyed, 'and admits it once it is gone').toBe(true);

      // Being destroyed is not being unusable: it stays a plain value
      // container, it just stops notifying.
      expect(sig.value, 'still holds its value').toBe(1);
    } finally {
      destroySignal(sig);
    }
  });
});
