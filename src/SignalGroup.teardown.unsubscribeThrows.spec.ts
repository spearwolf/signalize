// CONS-005: a throwing `unsubscribe()` handle has no legal way into the
// public API — every subscription this package creates unsubscribes
// cleanly. The witness needs a seam, so this file wraps `on()` from
// `@spearwolf/eventize` itself and hands back a throwing handle for a
// subscription whose id was marked beforehand, on `globalDestroySignalQueue`
// only. Everything else passes through unchanged.
import {getSubscriptionCount, on} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
  getGroupMemberCounts,
  NO_GROUP_MEMBERS,
} from './__testing__/assert-helpers.js';
import {createSignal} from './createSignal.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {$groupResources, SignalGroup} from './SignalGroup.js';
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

describe('SignalGroup teardown survives a throwing unsubscribe (CONS-005)', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
    throwingIds.clear();
    SignalGroup.clear();
  });

  afterEach(() => {
    throwingIds.clear();
    SignalGroup.clear();
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  it("clear()'s fifth teardown loop survives a throwing unsubscribe on an entry the earlier loops left behind", () => {
    // The fifth loop (the `#signalDestroySubscriptions` sweep) only ever
    // sees an entry that survived the third loop's `destroySignal()` call
    // untouched. On the ordinary path that call's destroy-queue emit
    // reaches the group's own bookkeeping listener, which unsubscribes and
    // removes the entry right there — before the fifth loop runs at all.
    // The only way an entry reaches the fifth loop is a listener registered
    // *before* the group's own that throws first: eventize's dispatch has
    // no `try` of its own, so the group's listener never gets its turn, and
    // the entry survives loop three intact.
    const parentHost = {};
    const childHost = {};
    const parent = SignalGroup.findOrCreate(parentHost);
    const child = SignalGroup.findOrCreate(childHost);
    parent.attachGroup(child);

    const sig = createSignal(0);
    const id = signalImpl(sig).id;

    // Registered before the group's own listener, and before `id` is
    // marked — so this handle is the real, unwrapped one.
    const unsubscribeEarlier = on(globalDestroySignalQueue, id, () => {
      throw new Error('[test] earlier listener boom');
    });

    throwingIds.add(id);
    child.attachSignal(sig);

    try {
      expect(() => child.clear()).toThrow(
        '[signalize] 2 errors while clearing a signal group',
      );

      expect(
        getGroupMemberCounts(child),
        'the child must be fully dismantled despite both throws',
      ).toEqual(NO_GROUP_MEMBERS);
      expect(
        SignalGroup.get(childHost),
        'the child must have left the store',
      ).toBeUndefined();
      expect(
        getGroupMemberCounts(parent).groups,
        'the parent must no longer list the child',
      ).toBe(0);
    } finally {
      // A reverted fix leaves the entry in `#signalDestroySubscriptions`
      // standing, so a second `clear()` here hits the same throw again —
      // guarded, or it would mask the assertion failure above with this
      // cleanup's own error instead (same pattern as the other throwing
      // teardowns in `SignalGroup.teardown.spec.ts`).
      throwingIds.delete(id);
      unsubscribeEarlier();
      try {
        child.clear();
      } catch {
        /* ignore */
      }
      try {
        parent.clear();
      } catch {
        /* ignore */
      }
    }
  });

  it('detachSignal() releases its own bookkeeping even when the unsubscribe throws', () => {
    // `detachSignal()` itself is a single direct call, not a `collect()`ed
    // teardown step like `clear()`/`off()` — the throw is expected to
    // propagate. What must not happen is `#dropSignalSubscription()`
    // leaving its own two registers holding a handle nobody can reach
    // again: the destroy-queue subscription and the group's held-resources
    // set (`$groupResources`).
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    const sig = createSignal(0);
    throwingIds.add(signalImpl(sig).id);
    group.attachSignal(sig);

    const baseline = getSubscriptionCount(globalDestroySignalQueue);

    try {
      expect(() => group.detachSignal(sig)).toThrow('[test] unsubscribe boom');

      // The real unsubscribe already ran (see the mock), so the queue is
      // back to its pre-attach size — and the group's own held-resources
      // set no longer references the dead handle either.
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline - 1);
      expect(group[$groupResources].unsubs.size).toBe(0);
    } finally {
      // A reverted `try/finally` in `#dropSignalSubscription()` leaves the
      // entry standing, so the cleanup `group.clear()` below hits the same
      // throw again — guarded, or it would mask the assertion failure above
      // with this cleanup's own error instead (same pattern as test 1).
      throwingIds.delete(signalImpl(sig).id);
      destroySignal(sig);
      try {
        group.clear();
      } catch {
        /* ignore */
      }
    }
  });

  it("detachSignal() clears the group's own registers even when the unsubscribe throws", () => {
    // `#removeSignal()` calls `#dropSignalSubscription()` as its first step.
    // A throw from there must not take the rest of the removal with it: a
    // signal left standing in `#signals`/`#directSignals`, or still bound to
    // a name, is one the group can never hear about again.
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    const sig = createSignal(0);
    // Marked before `attachSignal()` — the mock's `on()` seam looks at the
    // id at subscribe time, so a later marking would come too late.
    throwingIds.add(signalImpl(sig).id);
    group.attachSignal(sig);
    group.attachSignalByName('n', sig);

    try {
      expect(() => group.detachSignal(sig)).toThrow('[test] unsubscribe boom');

      expect(
        getGroupMemberCounts(group),
        'the group must be fully released from the signal despite the throw',
      ).toEqual(NO_GROUP_MEMBERS);
      expect(group.hasSignal('n')).toBe(false);
      expect(group.signal('n')).toBeUndefined();
    } finally {
      // Same guard as the tests above: a reverted fix leaves the entry
      // standing, so the cleanup below would hit the same throw again and
      // mask the assertion failure with its own error instead.
      throwingIds.delete(signalImpl(sig).id);
      destroySignal(sig);
      try {
        group.clear();
      } catch {
        /* ignore */
      }
    }
  });
});
