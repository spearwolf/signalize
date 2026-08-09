import {getSubscriptionCount} from '@spearwolf/eventize';
import {createSignal} from './createSignal.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import type {Signal} from './Signal.js';
import {destroySignal, getSignalsCount} from './signal-core.js';

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

// No `assertSignalsCount()` guard in beforeEach/afterEach here, unlike the
// neighbouring specs: this file's whole subject is a counter that comes back
// down at a time nobody can name. Each test takes its own baseline instead,
// which keeps one failure from turning into three.
describe('signal counter GC behavior (requires --expose-gc) — MEM-006', () => {
  it('a signal dropped without destroySignal() stops being counted (MEM-006)', async () => {
    const signalsBefore = getSignalsCount();
    const sigBefore = getSubscriptionCount(globalSignalQueue);
    const destBefore = getSubscriptionCount(globalDestroySignalQueue);

    const SIGNAL_COUNT = 200;
    const refs: WeakRef<Signal<number>>[] = [];

    (() => {
      for (let i = 0; i < SIGNAL_COUNT; i += 1) {
        // No `attach`, no `destroySignal()` — the signal becomes garbage the
        // moment this IIFE returns. Nothing ever emits for it.
        const sig = createSignal(i);
        refs.push(new WeakRef(sig));
      }
    })();

    expect(getSignalsCount()).toBe(signalsBefore + SIGNAL_COUNT);

    // FinalizationRegistry callbacks are non-deterministic — retry within a
    // budget, the way link.gc.spec.ts does for getLinksCount(). Waiting for
    // the counter itself is what makes this deterministic: once it is back
    // on the baseline, every callback has run.
    for (let i = 0; i < 20 && getSignalsCount() > signalsBefore; i += 1) {
      await forceGc();
    }

    expect(getSignalsCount()).toBe(signalsBefore);

    // Not decorative: without it the test would also be satisfied by an
    // implementation that guesses the counter down on read. This says the
    // objects really are gone.
    expect(refs.filter((ref) => ref.deref() !== undefined).length).toBe(0);

    // The correction must not have cost — or leaked — a subscription.
    expect(getSubscriptionCount(globalSignalQueue)).toBe(sigBefore);
    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(destBefore);
  });

  it('a signal destroyed and then collected is not counted down twice (MEM-006)', async () => {
    const signalsBefore = getSignalsCount();

    const SIGNAL_COUNT = 200;

    (() => {
      for (let i = 0; i < SIGNAL_COUNT; i += 1) {
        const sig = createSignal(i);
        destroySignal(sig);
      }
    })();

    expect(getSignalsCount()).toBe(signalsBefore);

    for (let i = 0; i < 5; i += 1) {
      await forceGc();
    }

    // Green on HEAD — this is not a regression test but the catcher for a
    // forgotten `signalFinalizer.unregister()`: without it the counter runs
    // into the negative, and it does so at a time that surfaces in some
    // other spec file entirely.
    expect(getSignalsCount()).toBe(signalsBefore);
  });
});
