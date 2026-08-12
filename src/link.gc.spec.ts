import {getSubscriptionCount} from '@spearwolf/eventize';
import {assertLinksCount} from './__testing__/assert-helpers.js';
import {$queueUnsubscribes} from './constants.js';
import {createSignal} from './create-signal.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import {getLinksCount, link, unlink} from './link.js';
import {destroySignal} from './signal-core.js';

// `globalThis.gc` is only available when Node is launched with --expose-gc
// (the `gc` project in vitest.config.ts, which `pnpm test` also runs, and
// `pnpm test:gc` for the whole suite). Skipping the suite when the flag is
// gone would hide a lost `execArgv` behind a green reporter, so this file
// refuses to load instead (BUILD-016).
const gc = (globalThis as {gc?: () => void}).gc;

if (typeof gc !== 'function') {
  throw new Error(
    'globalThis.gc is missing: this suite must run under --expose-gc. Check `execArgv` in the `gc` project of vitest.config.ts, or run `pnpm test:gc`.',
  );
}

const forceGc = async () => {
  for (let i = 0; i < 5; i += 1) {
    gc();
    await new Promise((resolve) => setImmediate(resolve));
  }
};

// FinalizationRegistry callbacks are non-deterministic — retry within a
// budget, mirroring SignalGroup.gc.spec.ts, until every link is gone. A loop
// that stops on the *first* collected link (and an assertion that merely
// checks "fewer than before") would pass with 99 out of 100 links still
// leaking; only driving all the way down to 0 is a real proof.
const waitUntilLinksCollected = async () => {
  for (let i = 0; i < 20 && getLinksCount() > 0; i += 1) {
    await forceGc();
  }
};

describe('link() GC behavior (requires --expose-gc) — MEM-002', () => {
  // NB: this suite intentionally does not assert getSignalsCount() — the
  // whole point of the scenario is source signals that are dropped without
  // ever calling destroySignal() on them. Since MEM-006 that count corrects
  // itself: `signal-core.ts` registers every signal with a
  // `FinalizationRegistry`, so a dropped signal leaves the count the same way
  // a dropped link leaves `getLinksCount()`. (Being attached to a
  // `SignalGroup` never had anything to do with it — a group has no GC-based
  // bookkeeping either, it just holds its signals.) The reason this file
  // still says nothing about the signal count is a different one: it is
  // orthogonal to what MEM-002 measures (gLinks/the link's own subscriptions
  // pinning it in memory), and a second stop condition in the budget loop
  // below would only make these tests slower, not sharper.
  //
  // MEM-007: `getLinksCount()` falling to 0 on its own is not proof that a
  // link's *subscriptions* were reclaimed too — only that its entry in the
  // strong inner `Map` in `src/link.ts` became unreachable, which happens
  // here only because the source signal is dropped in the same sweep (see
  // the first two tests below). The two claims used to come apart: measured
  // for this exact scenario, `getLinksCount()` read 0 while both queue
  // subscription counts sat unchanged from before the GC pass.
  //
  // MEM-001 closed that gap, and the last four tests hold it closed —
  // `getSubscriptionCount(queue)` snapshotted around the scenario, per the
  // pattern in CLAUDE.md → "Verifying subscription leaks". `getLinksCount()
  // === 0` now genuinely implies "the handles have run", because the
  // finalizer releases them before it touches the counter. What GC still is
  // not is a teardown route you can schedule — see the "held until unlink()"
  // test for the case where the source survives.
  beforeEach(() => {
    assertLinksCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertLinksCount(0, 'afterEach');
  });

  it('orphaned callback-target links (SignalLinkToCallback) are reclaimed by GC once their source signal is dropped too', async () => {
    // Probe E from the audit: create 100 links, drop every external
    // reference (signals, links, callbacks), force GC, and expect
    // getLinksCount() to fall all the way back to 0, not just "some". The
    // source signal falling away in the same sweep is load-bearing here
    // (MEM-007): a link on a *live* source is held by the strong inner
    // `Map` in `src/link.ts` and is not reclaimed by GC at all — see the
    // "held until unlink()" test below.
    const LINK_COUNT = 100;

    try {
      (() => {
        for (let i = 0; i < LINK_COUNT; i += 1) {
          const source = createSignal(i);
          // No `attach`, no explicit `unlink()`/`destroy()` — the link and its
          // source signal become garbage the moment this IIFE returns.
          link(source, () => {});
        }
      })();

      expect(getLinksCount()).toBe(LINK_COUNT);

      await waitUntilLinksCollected();

      expect(getLinksCount()).toBe(0);
    } finally {
      // Nothing here is reachable to hand to destroySignal() — the whole
      // point of the scenario is that it isn't. The only synchronous-looking
      // teardown available for an unreachable object is this: re-run the
      // same GC-forcing wait the body already does, idempotently, so a
      // seeded/real failure between creation and that wait doesn't leave
      // 100 links stuck in the counter for whichever test runs next.
      await waitUntilLinksCollected();
    }
  });

  it('orphaned signal-target links (SignalLinkToSignal) are reclaimed by GC once their source signal is dropped too', async () => {
    // Same probe, but with a signal as the target instead of a callback.
    // SignalLinkToSignal has its own extra subscription (destroy-on-target-
    // destroy) that must also go through a WeakRef — otherwise this case
    // leaks even when the callback-target case above is fixed. As above
    // (MEM-007), the source signal being dropped in the same sweep is what
    // makes this collectible at all — a link on a live source is not.
    const LINK_COUNT = 100;

    try {
      (() => {
        for (let i = 0; i < LINK_COUNT; i += 1) {
          const source = createSignal(i);
          const target = createSignal(-1);
          link(source, target);
        }
      })();

      expect(getLinksCount()).toBe(LINK_COUNT);

      await waitUntilLinksCollected();

      expect(getLinksCount()).toBe(0);
    } finally {
      // See the callback-target test above for why this is the only
      // available teardown here.
      await waitUntilLinksCollected();
    }
  });

  it('links on a live source signal are held until unlink() — GC does not reclaim them (MEM-007)', async () => {
    // Deliberate documentation of the current, decided behavior (see the
    // revised MEM-007 entry in remediation-plan.md's "Entscheidungen"): the
    // inner Map in src/link.ts's `gLinks` registry holds every link on a
    // live source strongly. This test is meant to go red the day someone
    // *does* switch that map to weak values without also updating this
    // file — at that point it stops being an accidental side effect and
    // becomes a decision, exactly as it should be.
    //
    // Determinism: negative expectations ("was NOT collected") need no
    // retry and must not use one — a GC that fails to collect something
    // reachable is guaranteed, not probabilistic. `waitUntilLinksCollected()`
    // stays reserved for the two positive-collection tests above.
    const source = createSignal(0);

    try {
      for (let i = 0; i < 100; i += 1) {
        link(source, () => {});
      }

      expect(getLinksCount()).toBe(100);
      expect(getLinksCount(source)).toBe(100);

      await forceGc();

      expect(getLinksCount()).toBe(100);
      expect(getLinksCount(source)).toBe(100);

      unlink(source);

      expect(getLinksCount()).toBe(0);
      expect(getLinksCount(source)).toBe(0);
    } finally {
      destroySignal(source);
    }
  });

  // MEM-001. Why none of these needs a settle step of its own: the finalizer
  // callback runs to completion synchronously, so by the time
  // `waitUntilLinksCollected()` sees `getLinksCount() === 0` the releases in
  // that same callback have already happened. The budget loop is what makes
  // this deterministic — not the order of the two halves inside the callback,
  // which nothing here depends on.
  it('a collected callback-target link releases both of its queue subscriptions (MEM-001)', async () => {
    const sigBefore = getSubscriptionCount(globalSignalQueue);
    const destBefore = getSubscriptionCount(globalDestroySignalQueue);

    const LINK_COUNT = 100;

    try {
      (() => {
        for (let i = 0; i < LINK_COUNT; i += 1) {
          const source = createSignal(i);
          link(source, () => {});
        }
      })();

      // Two per callback-target link: `on(globalSignalQueue, source.id)` and
      // `once(globalDestroySignalQueue, source.id)`.
      expect(getSubscriptionCount(globalSignalQueue)).toBe(
        sigBefore + LINK_COUNT,
      );
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destBefore + LINK_COUNT,
      );

      await waitUntilLinksCollected();

      expect(getLinksCount()).toBe(0);
      expect(getSubscriptionCount(globalSignalQueue)).toBe(sigBefore);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(destBefore);
    } finally {
      // See the first callback-target test above for why this is the only
      // available teardown here.
      await waitUntilLinksCollected();
    }
  });

  it('a collected signal-target link releases all three of its queue subscriptions (MEM-001)', async () => {
    const sigBefore = getSubscriptionCount(globalSignalQueue);
    const destBefore = getSubscriptionCount(globalDestroySignalQueue);

    const LINK_COUNT = 100;

    try {
      (() => {
        for (let i = 0; i < LINK_COUNT; i += 1) {
          const source = createSignal(i);
          const target = createSignal(-1);
          link(source, target);
        }
      })();

      // Three per signal-target link: the two above plus
      // `once(globalDestroySignalQueue, target.id)` from
      // `SignalLinkToSignal`'s constructor — hence 2 × LINK_COUNT on the
      // destroy queue.
      expect(getSubscriptionCount(globalSignalQueue)).toBe(
        sigBefore + LINK_COUNT,
      );
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destBefore + 2 * LINK_COUNT,
      );

      await waitUntilLinksCollected();

      expect(getLinksCount()).toBe(0);
      expect(getSubscriptionCount(globalSignalQueue)).toBe(sigBefore);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(destBefore);
    } finally {
      // See the first callback-target test above for why this is the only
      // available teardown here.
      await waitUntilLinksCollected();
    }
  });

  it('a collected link releases the destroy hook on a target signal that is still alive (MEM-001)', async () => {
    // The counter-proof to the discarded `off(queue, eventName)` variant:
    // `off(globalDestroySignalQueue, target.id)` would also tear the destroy
    // hooks of effects, groups and memos off a *living* target signal. Here
    // only the sources and the links fall; the targets are held in an array
    // and must come out of the sweep intact.
    const sigBefore = getSubscriptionCount(globalSignalQueue);
    const destBefore = getSubscriptionCount(globalDestroySignalQueue);

    const LINK_COUNT = 100;
    const targets = Array.from({length: LINK_COUNT}, () => createSignal(-1));

    try {
      (() => {
        for (let i = 0; i < LINK_COUNT; i += 1) {
          const source = createSignal(i);
          link(source, targets[i]);
        }
      })();

      await waitUntilLinksCollected();

      expect(getLinksCount()).toBe(0);
      expect(getSubscriptionCount(globalSignalQueue)).toBe(sigBefore);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(destBefore);

      // The targets are untouched: still writable, still readable.
      for (let i = 0; i < LINK_COUNT; i += 1) {
        targets[i].set(i);
      }
      expect(targets[7].value).toBe(7);
    } finally {
      for (const target of targets) {
        destroySignal(target);
      }
    }
  });

  it('a throwing release handle is reported and does not stop the rest (MEM-001)', async () => {
    const sigBefore = getSubscriptionCount(globalSignalQueue);
    const destBefore = getSubscriptionCount(globalDestroySignalQueue);

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      (() => {
        const source = createSignal(1);
        const l = link(source, () => {});
        // In *front* of the two real handles — a thrower at the end would
        // prove nothing about the ones behind it.
        l[$queueUnsubscribes].unshift(() => {
          throw new Error('release-boom');
        });
      })();

      await waitUntilLinksCollected();

      expect(error).toHaveBeenCalledTimes(1);
      expect(getLinksCount()).toBe(0);
      expect(getSubscriptionCount(globalSignalQueue)).toBe(sigBefore);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(destBefore);
    } finally {
      error.mockRestore();
    }
  });

  it('a destroyed link is not counted down a second time when it is collected (TEST-020)', async () => {
    // `destroy()` decrements `gLinksCount` and unregisters the link from
    // `gLinkFinalizer` in the same breath. Without the unregister the
    // finalizer fires later — the link is unreachable by then — and
    // decrements a second time for the same link, so `getLinksCount()`
    // undercounts every link that is still alive. The `gLinksCount > 0`
    // clamp hides this whenever the count is already 0, which is why the
    // survivors below are load-bearing.
    const SURVIVOR_COUNT = 50;
    const CORPSE_COUNT = 50;

    const survivorSource = createSignal(0);
    const corpseRefs: WeakRef<object>[] = [];

    try {
      for (let i = 0; i < SURVIVOR_COUNT; i += 1) {
        link(survivorSource, () => {});
      }

      (() => {
        for (let i = 0; i < CORPSE_COUNT; i += 1) {
          const source = createSignal(i);
          const corpse = link(source, () => {});
          corpse.destroy();
          corpseRefs.push(new WeakRef(corpse));
        }
      })();

      expect(getLinksCount(), 'the corpses are already counted out').toBe(
        SURVIVOR_COUNT,
      );

      for (
        let i = 0;
        i < 20 && corpseRefs.some((ref) => ref.deref() !== undefined);
        i += 1
      ) {
        await forceGc();
      }

      // The witness: without a collected corpse the assertion below would
      // hold for the trivial reason that nothing ran at all.
      expect(
        corpseRefs.filter((ref) => ref.deref() !== undefined).length,
        'every destroyed link really was collected',
      ).toBe(0);

      // One more round, so a finalizer job that was queued in the sweep
      // above has had every chance to run before the count is read.
      await forceGc();

      expect(getLinksCount(), 'the live links are still all counted').toBe(
        SURVIVOR_COUNT,
      );
    } finally {
      unlink(survivorSource);
      destroySignal(survivorSource);
    }
  });
});
