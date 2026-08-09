import {getSubscriptionCount} from '@spearwolf/eventize';
import {$autoMapResources} from './constants.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {SignalAutoMap} from './SignalAutoMap.js';
import {destroySignal, getSignalsCount, signalImpl} from './signal-core.js';

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

describe('SignalAutoMap GC behavior (requires --expose-gc) — MEM-007', () => {
  it('a dropped map is collected and releases its destroy-queue subscriptions (MEM-007)', async () => {
    const destBefore = getSubscriptionCount(globalDestroySignalQueue);
    const signalsBefore = getSignalsCount();

    const MAP_COUNT = 50;
    const refs: WeakRef<SignalAutoMap>[] = [];

    (() => {
      for (let i = 0; i < MAP_COUNT; i += 1) {
        const sm = new SignalAutoMap();
        sm.get('a');
        sm.get('b');
        refs.push(new WeakRef(sm));
      }
    })();

    // One destroy-queue subscription per entry — the hook that evicts an
    // externally destroyed signal.
    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      destBefore + 2 * MAP_COUNT,
    );
    expect(getSignalsCount()).toBe(signalsBefore + 2 * MAP_COUNT);

    // Two stop conditions, because this test proves both findings at once:
    // the signals inside a collected map are never destroyed, so their
    // counter only comes back through MEM-006's finalizer.
    for (
      let i = 0;
      i < 20 &&
      (getSubscriptionCount(globalDestroySignalQueue) > destBefore ||
        getSignalsCount() > signalsBefore);
      i += 1
    ) {
      await forceGc();
    }

    expect(refs.filter((ref) => ref.deref() !== undefined).length).toBe(0);
    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(destBefore);
    expect(getSignalsCount()).toBe(signalsBefore);
  });

  it('the per-entry listener holds nothing but its WeakRef and its key (MEM-007)', async () => {
    // The invariant this pins is the one the comment in `#create()` states:
    // exactly one inner function in that scope. V8 allocates one context per
    // scope and shares it between every closure in it, so a second inner
    // function that so much as mentions `signal` would put the SignalImpl —
    // and with it whatever the signal's value points at — into the context
    // the listener carries. The subscription lives on a module-level queue,
    // so "carried" means "for the rest of the process".
    //
    // Sharpened the way the reviewer of this package sharpened it: the
    // unsubscribe handles are taken out of `unsubs` before the maps are
    // dropped, so the resource finalizer has nothing to release and the
    // subscriptions cannot go away on their own. Whatever the closure holds
    // now, it holds for good.
    const ENTRY_COUNT = 50;
    const signalRefs: WeakRef<object>[] = [];
    const hostRefs: WeakRef<object>[] = [];
    const handles: (() => void)[] = [];

    (() => {
      for (let i = 0; i < ENTRY_COUNT; i += 1) {
        const sm = new SignalAutoMap();
        const host = {marker: `automap-host-${i}`};
        const sig = sm.get<object>('a');
        sig.set(host);

        signalRefs.push(new WeakRef(signalImpl(sig)));
        hostRefs.push(new WeakRef(host));

        const {unsubs} = sm[$autoMapResources];
        handles.push(...unsubs);
        unsubs.clear();
      }
    })();

    for (
      let i = 0;
      i < 20 && signalRefs.some((ref) => ref.deref() !== undefined);
      i += 1
    ) {
      await forceGc();
    }

    expect(
      signalRefs.filter((ref) => ref.deref() !== undefined).length,
      'the listener must not keep its SignalImpl alive',
    ).toBe(0);
    expect(
      hostRefs.filter((ref) => ref.deref() !== undefined).length,
      "the listener must not keep the signal's value alive",
    ).toBe(0);

    for (const unsubscribe of handles) {
      unsubscribe();
    }
  });

  it('a destroy that arrives after its map was collected is ignored (MEM-007)', async () => {
    // The listener knows its map through a WeakRef, and the window in which
    // that deref comes back empty is real: a map can be collected while a
    // signal it handed out is still alive, and the destroy of that signal
    // can beat the resource finalizer to the queue. Reproduced here by
    // taking the real handles out of the finalizer's reach first, so the
    // subscription is guaranteed to outlive its map.
    const destBefore = getSubscriptionCount(globalDestroySignalQueue);

    let mapRef!: WeakRef<SignalAutoMap>;
    let handles!: (() => void)[];

    const sig = (() => {
      const sm = new SignalAutoMap();
      const entry = sm.get<number>('a');
      const {unsubs} = sm[$autoMapResources];
      handles = [...unsubs];
      unsubs.clear();
      mapRef = new WeakRef(sm);
      return entry;
    })();

    for (let i = 0; i < 20 && mapRef.deref() !== undefined; i += 1) {
      await forceGc();
    }

    expect(mapRef.deref()).toBeUndefined();
    // The listener outlived its map, exactly as arranged.
    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(destBefore + 1);

    expect(() => {
      destroySignal(sig);
    }).not.toThrow();

    for (const unsubscribe of handles) {
      unsubscribe();
    }
    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(destBefore);
  });

  it('a throwing release handle in a collected map is reported, not thrown (MEM-007)', async () => {
    const destBefore = getSubscriptionCount(globalDestroySignalQueue);

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      (() => {
        const sm = new SignalAutoMap();
        sm.get('a');
        sm.get('b');

        // In *front* of the two real handles — a thrower at the end would
        // prove nothing about the ones behind it. A Set keeps insertion
        // order, so the whole thing is rebuilt.
        const {unsubs} = sm[$autoMapResources];
        const real = [...unsubs];
        unsubs.clear();
        unsubs.add(() => {
          throw new Error('release-boom');
        });
        for (const unsubscribe of real) {
          unsubs.add(unsubscribe);
        }
      })();

      for (
        let i = 0;
        i < 20 && getSubscriptionCount(globalDestroySignalQueue) > destBefore;
        i += 1
      ) {
        await forceGc();
      }

      expect(error).toHaveBeenCalledTimes(1);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(destBefore);
    } finally {
      error.mockRestore();
    }
  });
});
