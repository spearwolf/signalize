// A throwing `unsubscribe()` handle has no legal way into the
// public API — every subscription this package creates unsubscribes
// cleanly. The witness needs a seam, so this file wraps `on()` from
// `@spearwolf/eventize` itself and hands back a throwing handle for a
// subscription whose id was marked beforehand, on `globalDestroySignalQueue`
// only. Everything else passes through unchanged.
//
// `SignalAutoMap` mints its ids inside `#create()`, so a key created by
// `get()` cannot be marked in time. `fromProps({a: sig})` is the way in:
// `createSignal(sig)` hands the existing signal back unchanged, so its id
// exists before the map subscribes to it.
import {getSubscriptionCount} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {$autoMapResources} from './constants.js';
import {createSignal} from './create-signal.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {SignalAutoMap} from './SignalAutoMap.js';
import {destroySignal, signalImpl} from './signal-core.js';

const throwingIds = vi.hoisted(() => new Set<symbol>());

vi.mock('@spearwolf/eventize', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@spearwolf/eventize')>();
  return {
    ...actual,
    on: (...args: any[]) => {
      const unsubscribe = (actual.on as any)(...args);
      const [target, event] = args;
      // A signal id is an event on both `globalSignalQueue` and
      // `globalDestroySignalQueue` — matching on the id alone would also
      // make a later value/effect subscription on a marked signal throw.
      if (
        target === globalDestroySignalQueue &&
        typeof event === 'symbol' &&
        throwingIds.has(event)
      ) {
        return () => {
          // The real handle still runs — this only makes the *return* of
          // the unsubscribe throw, the same shape a broken third-party
          // handle would take. Left uncalled, the subscription would leak
          // onto `globalDestroySignalQueue` for the rest of the file.
          unsubscribe();
          throw new Error('[test] unsubscribe boom');
        };
      }
      return unsubscribe;
    },
  };
});

describe('SignalAutoMap teardown survives a throwing unsubscribe', () => {
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

  it('delete() clears all three registers even when the unsubscribe throws', () => {
    // `delete()` itself is a single-entry operation, not a collected
    // teardown: the throw is expected to propagate. What must not happen is
    // `#drop()` leaving the entry in all three registers while the caller
    // already holds the error.
    const sig = createSignal(0);
    const id = signalImpl(sig).id;
    throwingIds.add(id);

    const sm = SignalAutoMap.fromProps({a: sig});

    const baseline = getSubscriptionCount(globalDestroySignalQueue);

    try {
      expect(() => sm.delete('a')).toThrow('[test] unsubscribe boom');

      expect(sm.has('a'), 'the entry must be out of the map').toBe(false);
      expect(
        sm[$autoMapResources].unsubs.size,
        'the held-resources set must not keep the dead handle',
      ).toBe(0);
      // The real unsubscribe already ran (see the mock), so the queue is
      // back to its pre-entry size.
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline - 1);
    } finally {
      // A reverted fix leaves the entry standing, so the cleanup `clear()`
      // below hits the same throw again — guarded, or it would mask the
      // assertion failure above with its own error instead.
      throwingIds.delete(id);
      destroySignal(sig);
      try {
        sm.clear();
      } catch {
        /* ignore */
      }
    }
  });

  it('clear() collects a throwing unsubscribe and still destroys every signal', () => {
    const sigA = createSignal(1);
    const sigB = createSignal(2);
    const idA = signalImpl(sigA).id;
    // Only the first entry throws — the second one proves the loop carried on.
    throwingIds.add(idA);

    const baseline = getSubscriptionCount(globalDestroySignalQueue);
    const sm = SignalAutoMap.fromProps({a: sigA, b: sigB});

    try {
      expect(() => sm.clear()).toThrow('[test] unsubscribe boom');

      expect(sigA.destroyed, 'the failing entry is still destroyed').toBe(true);
      expect(sigB.destroyed, 'the entry behind it is destroyed too').toBe(true);
      expect(sm.has('a')).toBe(false);
      expect(sm.has('b')).toBe(false);
      expect(
        sm[$autoMapResources].unsubs.size,
        'no dead handle stays in the held-resources set',
      ).toBe(0);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline);
    } finally {
      throwingIds.delete(idA);
      try {
        sm.clear();
      } catch {
        /* ignore */
      }
      destroySignal(sigA);
      destroySignal(sigB);
    }
  });
});
