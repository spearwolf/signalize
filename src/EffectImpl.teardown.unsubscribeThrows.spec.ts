// A throwing `unsubscribe()` handle has no legal way into the
// public API — every subscription this package creates unsubscribes
// cleanly. The witness needs a seam, so this file wraps `on()` from
// `@spearwolf/eventize` itself and hands back a throwing handle for a
// subscription whose id was marked beforehand, on `globalSignalQueue`
// only — the RECALL registration `EffectImpl.whenSignalIsRead()` makes
// there. Everything else, including the paired `once()` subscription on
// `globalDestroySignalQueue`, passes through unchanged: marking the
// *first* handle of the pair is what makes a teardown that stops after
// the first throw observable — the second handle then never gets a turn
// at all, and stays subscribed for anyone watching that other queue.
//
// The signal is created before the effect that depends on it, so its id
// is known — and markable — before anything subscribes to it.
import {getSubscriptionCount} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './create-signal.js';
import {createEffect, getEffectsCount} from './effects.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import {destroySignal, signalImpl} from './signal-core.js';

const throwingIds = vi.hoisted(() => new Set<symbol>());

vi.mock('@spearwolf/eventize', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@spearwolf/eventize')>();
  return {
    ...actual,
    on: (...args: any[]) => {
      const unsubscribe = (actual.on as any)(...args);
      const [target, event] = args;
      if (
        target === globalSignalQueue &&
        typeof event === 'symbol' &&
        throwingIds.has(event)
      ) {
        return () => {
          // The real handle still runs — this only makes the *return* of
          // the unsubscribe throw, the same shape a broken third-party
          // handle would take. Left uncalled, the subscription would leak
          // onto `globalSignalQueue` for the rest of the file.
          unsubscribe();
          throw new Error('[test] unsubscribe boom');
        };
      }
      return unsubscribe;
    },
  };
});

describe('EffectImpl teardown survives a throwing unsubscribe', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
    throwingIds.clear();
  });

  afterEach(() => {
    throwingIds.clear();
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  it('losing its only live signal still frees both queue subscriptions despite a throwing unsubscribe', () => {
    const trigger = createSignal(0);
    const sig = createSignal(0);
    const id = signalImpl(sig).id;
    throwingIds.add(id);

    const signalQueueBaseline = getSubscriptionCount(globalSignalQueue);
    const destroyQueueBaseline = getSubscriptionCount(globalDestroySignalQueue);

    let readSignal = true;
    const effect = createEffect(() => {
      trigger.get();
      if (readSignal) sig.get();
    });

    try {
      // `shouldRun` is already `false` after the first run — only a write to
      // a tracked dependency (through `[RECALL]`), not a second `run()`
      // call, gets a rerun going. A rerun that reads nothing prunes the
      // signal it stopped reading, the same two-handle pair a hard signal
      // destruction would call.
      readSignal = false;
      expect(() => trigger.set(1)).toThrow('[test] unsubscribe boom');

      expect(getSubscriptionCount(globalSignalQueue)).toBe(
        signalQueueBaseline + 1, // trigger's own RECALL subscription remains
      );
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroyQueueBaseline + 1, // trigger's own destroy-queue subscription remains
      );
    } finally {
      // Destroying the effect first retires any subscription a reverted fix
      // left standing via a bulk `off()`, so the `destroySignal()` calls
      // below never have a live listener left to hit the same throw again.
      throwingIds.delete(id);
      try {
        effect.destroy();
      } catch {
        /* ignore */
      }
      destroySignal(trigger, sig);
    }
  });

  it('losing several signals in the same rerun keeps freeing the rest after one throws', () => {
    const trigger = createSignal(0);
    const sigA = createSignal(0);
    const sigB = createSignal(0);
    const idA = signalImpl(sigA).id;
    // Only the first lost signal throws — the second is what proves
    // `cleanupLostSignals()`'s own loop carried on instead of abandoning
    // every signal behind the failing one.
    throwingIds.add(idA);

    const signalQueueBaseline = getSubscriptionCount(globalSignalQueue);
    const destroyQueueBaseline = getSubscriptionCount(globalDestroySignalQueue);

    let readSignals = true;
    const effect = createEffect(() => {
      trigger.get();
      if (readSignals) {
        sigA.get();
        sigB.get();
      }
    });

    try {
      readSignals = false;
      expect(() => trigger.set(1)).toThrow('[test] unsubscribe boom');

      expect(getSubscriptionCount(globalSignalQueue)).toBe(
        signalQueueBaseline + 1, // trigger's own RECALL subscription remains
      );
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroyQueueBaseline + 1, // trigger's own destroy-queue subscription remains
      );
    } finally {
      throwingIds.delete(idA);
      try {
        effect.destroy();
      } catch {
        /* ignore */
      }
      destroySignal(trigger, sigA, sigB);
    }
  });

  it('destroying the last live signal still destroys the effect after an earlier unsubscribe threw', () => {
    // Two dependencies, not one: the register entry of the throwing signal is
    // invisible on its own teardown, because the throw leaves
    // `onSignalDestroyed()` long before that method reaches its
    // `hasNoLiveSignals()` check. The entry only speaks up when a second,
    // cleanly unsubscribed signal goes and the check runs for real — it reads
    // the register, so a stale id there says "still has dependencies" and the
    // effect never destroys itself again. Subscription counts cannot see this:
    // both handles are already free either way.
    const sigA = createSignal(0);
    const sigB = createSignal(0);
    const idA = signalImpl(sigA).id;
    throwingIds.add(idA);

    const effect = createEffect(() => {
      sigA.get();
      sigB.get();
    });

    try {
      expect(() => destroySignal(sigA)).toThrow('[test] unsubscribe boom');
      destroySignal(sigB);

      expect(
        getEffectsCount(),
        'nothing live is left to trigger the effect, so it must destroy itself',
      ).toBe(0);
    } finally {
      throwingIds.delete(idA);
      try {
        effect.destroy();
      } catch {
        /* ignore */
      }
    }
  });
});
