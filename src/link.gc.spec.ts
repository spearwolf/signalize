import {assertLinksCount} from './assert-helpers.js';
import {createSignal} from './createSignal.js';
import {getLinksCount, link} from './link.js';

// `globalThis.gc` is only available when Node is launched with --expose-gc
// (e.g. via `pnpm test:gc`). Without it these tests would silently pass even
// on a leaky implementation, so we skip the suite instead.
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
  beforeEach(() => {
    assertLinksCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertLinksCount(0, 'afterEach');
  });

  it('orphaned callback-target links (SignalLinkToCallback) are reclaimed by GC', async () => {
    // Probe E from the audit: create 100 links, drop every external
    // reference (signals, links, callbacks), force GC, and expect
    // getLinksCount() to fall all the way back to 0, not just "some".
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

  it('orphaned signal-target links (SignalLinkToSignal) are reclaimed by GC', async () => {
    // Same probe, but with a signal as the target instead of a callback.
    // SignalLinkToSignal has its own extra subscription (destroy-on-target-
    // destroy) that must also go through a WeakRef — otherwise this case
    // leaks even when the callback-target case above is fixed.
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
});
