import {assertLinksCount} from './assert-helpers.js';
import {createSignal} from './createSignal.js';
import {getLinksCount, link, unlink} from './link.js';
import {destroySignal} from './signal-core.js';

// `globalThis.gc` is only available when Node is launched with --expose-gc
// (e.g. via the `gc` project in vitest.config.ts, which `pnpm test` also
// runs). Without it these tests would silently pass even on a leaky
// implementation, so we skip the suite instead.
const hasGc = typeof (globalThis as {gc?: () => void}).gc === 'function';
const gcDescribe = hasGc ? describe : describe.skip;

const forceGc = async () => {
  for (let i = 0; i < 5; i += 1) {
    (globalThis as {gc: () => void}).gc();
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

gcDescribe('link() GC behavior (requires --expose-gc) — MEM-002', () => {
  // NB: this suite intentionally does not assert getSignalsCount() — the
  // whole point of the scenario is source signals that are dropped without
  // ever calling destroySignal() on them. Standalone signals have no
  // GC-based count bookkeeping (unlike SignalGroup-attached ones), so their
  // count would stay elevated; that is orthogonal to what MEM-002 is about
  // (gLinks/the link's own subscriptions pinning it in memory) and out of
  // scope here.
  //
  // MEM-007: `getLinksCount()` falling to 0 below is not proof that a
  // link's *subscriptions* were reclaimed too — only that its entry in the
  // strong inner `Map` in `src/link.ts` became unreachable, which happens
  // here only because the source signal is dropped in the same sweep (see
  // the two tests below). Measured for this exact scenario: after the
  // source falls away, `getLinksCount()` is 0, but both of a link's
  // `globalSignalQueue`/`globalDestroySignalQueue` subscription counts are
  // unchanged from before the GC pass. That is why this suite has no
  // `getSubscriptionCount()` assertion either — it would not move, and
  // absence-of-proof is not what MEM-007 documents. See the new
  // "held until unlink()" test below for the case where the source
  // survives.
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
  });

  it('orphaned signal-target links (SignalLinkToSignal) are reclaimed by GC once their source signal is dropped too', async () => {
    // Same probe, but with a signal as the target instead of a callback.
    // SignalLinkToSignal has its own extra subscription (destroy-on-target-
    // destroy) that must also go through a WeakRef — otherwise this case
    // leaks even when the callback-target case above is fixed. As above
    // (MEM-007), the source signal being dropped in the same sweep is what
    // makes this collectible at all — a link on a live source is not.
    const LINK_COUNT = 100;

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

    destroySignal(source);
  });
});
