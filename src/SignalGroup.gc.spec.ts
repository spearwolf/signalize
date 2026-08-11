import {getSubscriptionCount, on} from '@spearwolf/eventize';
import type {MockInstance} from 'vitest';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {DESTROY} from './constants.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {link} from './link.js';
import {
  $groupResources,
  getSignalGroupsCount,
  SignalGroup,
} from './SignalGroup.js';
import type {SignalLink} from './SignalLink.js';
import {getSignalsCount} from './signal-core.js';
import {onSignalizeError} from './signalize-error.js';
import type {SignalizeErrorPayload} from './types.js';

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

describe('SignalGroup GC behavior (requires --expose-gc)', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
    SignalGroup.clear();
  });

  afterEach(() => {
    SignalGroup.clear();
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  it('store does not pin the user object after the user drops their reference', async () => {
    let host: object | null = {marker: 'gc-host'};
    const ref = new WeakRef(host);

    // Held only so the `finally` has a handle — a group does not pin its
    // host, which is the very thing this test measures.
    const group = SignalGroup.findOrCreate(host);

    try {
      // User drops their last strong reference. The only remaining paths are
      // the WeakMap (does not pin) and the SignalGroup's WeakRef storeKey
      // (does not pin). Therefore `host` must become reclaimable.
      host = null;

      await forceGc();

      expect(ref.deref()).toBeUndefined();
    } finally {
      group.clear();
    }
  });

  it('user object is reclaimable even when the SignalGroup is never explicitly cleared', async () => {
    let host: object | null = {marker: 'never-cleared'};
    const hostRef = new WeakRef(host);

    const group = SignalGroup.findOrCreate(host);

    try {
      host = null;

      await forceGc();

      // Eventually the FinalizationRegistry callback clears the group and its
      // attached resources; the user object itself is reclaimable in either case.
      expect(hostRef.deref()).toBeUndefined();
    } finally {
      // Nothing was cleared while the assertion above was being made — that
      // is what the test is about. This only keeps the registry tidy.
      group.clear();
    }
  });

  it('FinalizationRegistry clears the orphaned group and its attached resources', async () => {
    const baselineGroups = getSignalGroupsCount();

    let host: object | null = {marker: 'fr-cleanup'};
    const hostRef = new WeakRef(host);

    const group = SignalGroup.findOrCreate(host);
    group.attachSignal(createSignal(1, {attach: host}));
    createEffect(() => {}, {attach: host});

    try {
      expect(getSignalGroupsCount()).toBe(baselineGroups + 1);

      host = null;

      // GC the user object, then yield enough microtasks for the FR callback
      // to flush. FR firing is non-deterministic, so retry within a budget.
      for (
        let i = 0;
        i < 20 && getSignalGroupsCount() > baselineGroups;
        i += 1
      ) {
        await forceGc();
      }

      expect(hostRef.deref()).toBeUndefined();
      expect(getSignalGroupsCount()).toBe(baselineGroups);
      assertSignalsCount(0, 'after FR cleanup');
      assertEffectsCount(0, 'after FR cleanup');
    } finally {
      group.clear();
    }
  });

  it('FinalizationRegistry survives a group whose DESTROY listener re-enters clear()', async () => {
    const baselineGroups = getSignalGroupsCount();

    let host: object | null = {marker: 'fr-reentrant-clear'};

    const group = SignalGroup.findOrCreate(host);
    group.attachSignal(createSignal(1, {attach: host}));

    // Re-entering clear() from a DESTROY listener used to recurse until the
    // stack gave out. From the FR callback that RangeError is uncatchable for
    // application code and takes the whole process down (BUG-002).
    on(group, DESTROY, () => {
      group.clear();
    });

    try {
      host = null;

      for (
        let i = 0;
        i < 20 && getSignalGroupsCount() > baselineGroups;
        i += 1
      ) {
        await forceGc();
      }

      expect(getSignalGroupsCount()).toBe(baselineGroups);
      assertSignalsCount(0, 'after FR cleanup with re-entrant clear');
    } finally {
      group.clear();
    }
  });

  it('explicit clear() unregisters from FinalizationRegistry (no double-fire)', async () => {
    const baselineGroups = getSignalGroupsCount();

    let host: object | null = {marker: 'explicit-clear'};
    const group = SignalGroup.findOrCreate(host);
    group.attachSignal(createSignal(1, {attach: host}));

    try {
      // Explicit cleanup BEFORE the user object is GC'd.
      group.clear();

      expect(getSignalGroupsCount()).toBe(baselineGroups);
      assertSignalsCount(0, 'after explicit clear');

      host = null;
      await forceGc();

      // Counters must remain at baseline — the FR callback must not fire
      // again on the already-cleared group.
      expect(getSignalGroupsCount()).toBe(baselineGroups);
      assertSignalsCount(0, 'after GC of cleared group');
    } finally {
      group.clear();
    }
  });

  it('a throwing teardown in an FR-collected group is reported, not thrown', async () => {
    const baselineGroups = getSignalGroupsCount();
    const errorSpy: MockInstance = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    let host: object | null = {marker: 'fr-throwing-cleanup'};
    const group = SignalGroup.findOrCreate(host);
    createEffect(
      () => () => {
        throw new Error('cleanup boom from FR');
      },
      {attach: host},
    );

    try {
      host = null;

      for (
        let i = 0;
        i < 20 && getSignalGroupsCount() > baselineGroups;
        i += 1
      ) {
        await forceGc();
      }

      expect(getSignalGroupsCount()).toBe(baselineGroups);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect((errorSpy.mock.calls[0][1] as Error).message).toBe(
        'cleanup boom from FR',
      );
    } finally {
      errorSpy.mockRestore();
      // The finalizer swallows the throwing cleanup; a direct `clear()`
      // does not, and it is the one that runs if the group is still here.
      try {
        group.clear();
      } catch {
        /* ignore */
      }
    }
  });

  it('routes a throwing FR teardown to an onSignalizeError handler', async () => {
    const baselineGroups = getSignalGroupsCount();
    const errorSpy: MockInstance = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const seen: SignalizeErrorPayload[] = [];
    const unsubscribe = onSignalizeError((payload) => {
      seen.push(payload);
    });

    let host: object | null = {marker: 'fr-routed-cleanup'};
    const group = SignalGroup.findOrCreate(host);
    createEffect(
      () => () => {
        throw new Error('cleanup boom routed');
      },
      {attach: host},
    );

    try {
      host = null;

      for (
        let i = 0;
        i < 20 && getSignalGroupsCount() > baselineGroups;
        i += 1
      ) {
        await forceGc();
      }

      expect(getSignalGroupsCount()).toBe(baselineGroups);
      expect(seen).toHaveLength(1);
      expect(seen[0].source).toBe('group-finalizer');
      expect(seen[0].level).toBe('error');
      expect((seen[0].error as Error).message).toBe('cleanup boom routed');
      // The whole point: with a handler in place the message is the
      // handler's, not the console's.
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
      errorSpy.mockRestore();
      try {
        group.clear();
      } catch {
        /* ignore */
      }
    }
  });

  it('a throwing handler in the FR callback does not kill the process', async () => {
    const baselineGroups = getSignalGroupsCount();
    const errorSpy: MockInstance = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const unsubscribe = onSignalizeError(() => {
      throw new Error('handler boom in FR');
    });

    let host: object | null = {marker: 'fr-throwing-handler'};
    const group = SignalGroup.findOrCreate(host);
    createEffect(
      () => () => {
        throw new Error('cleanup boom under a throwing handler');
      },
      {attach: host},
    );

    try {
      host = null;

      for (
        let i = 0;
        i < 20 && getSignalGroupsCount() > baselineGroups;
        i += 1
      ) {
        await forceGc();
      }

      // Reaching this line at all is half the assertion: a throw out of the
      // FR callback is an uncaughtException and takes the process with it.
      expect(getSignalGroupsCount()).toBe(baselineGroups);
      expect(errorSpy).toHaveBeenCalledTimes(2);
      expect((errorSpy.mock.calls[0][1] as Error).message).toBe(
        'handler boom in FR',
      );
      expect((errorSpy.mock.calls[1][1] as Error).message).toBe(
        'cleanup boom under a throwing handler',
      );
    } finally {
      unsubscribe();
      errorSpy.mockRestore();
      try {
        group.clear();
      } catch {
        /* ignore */
      }
    }
  });

  it('the DESTROY-hook guard does not pin a link the group has let go of (MEM-002)', async () => {
    // The guard that keeps `attachLink()` from registering a second
    // counter-edge per (link, group) pair is a `WeakSet`, and a plain `Set`
    // in its place is functionally indistinguishable — every unit test
    // stays green. The difference is only visible here: a `Set` would hold
    // every link the group has ever seen for the group's whole lifetime,
    // past `detachLink()` and past `destroy()`, which is MEM-002 again in
    // another pocket.
    const host = {marker: 'link-destroy-hook-guard'};
    const group = SignalGroup.findOrCreate(host);
    const source = createSignal(1);

    let signalLink: SignalLink<number> | null = link(source, () => {});
    const linkRef = new WeakRef(signalLink);

    group.attachLink(signalLink);

    try {
      // Both routes out of the group are exercised: the counter-edge takes
      // the link out of `#links`, and nothing else may keep holding it.
      signalLink.destroy();
      signalLink = null;

      await forceGc();

      expect(linkRef.deref()).toBeUndefined();
    } finally {
      // `signalLink` is null by the time the assertion above has run, so
      // this only catches a failure that landed before the destroy.
      signalLink?.destroy();
      source.destroy();
      group.clear();
    }
  });

  it('a host whose only back-reference is a signal value is reclaimed (MEM-003)', async () => {
    // The everyday decorator shape, `@signal() accessor self = this`: the
    // host owns a group, the group owns a signal, and the signal's *value*
    // is the host. Nothing else points at it. Before MEM-003 all three
    // module-level roots of `SignalGroup.ts` — the `allGroups` set, the held
    // value of the FinalizationRegistry, and the per-signal listener on
    // `globalDestroySignalQueue` — held the group strongly, so the group was
    // reachable from a GC root and the host through it. Measured on the
    // fixed build, 1000 of 1000 hosts survived before and 0 of 1000 after.
    const groupBaseline = getSignalGroupsCount();
    const signalBaseline = getSignalsCount();
    const destBaseline = getSubscriptionCount(globalDestroySignalQueue);

    const HOST_COUNT = 50;
    const hostRefs: WeakRef<object>[] = [];

    (() => {
      for (let i = 0; i < HOST_COUNT; i += 1) {
        const host = {marker: `mem003-host-${i}`};
        // The value points back at the host — the whole point of the case.
        createSignal(host, {attach: host});
        hostRefs.push(new WeakRef(host));
      }
    })();

    try {
      expect(getSignalGroupsCount()).toBe(groupBaseline + HOST_COUNT);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destBaseline + HOST_COUNT,
      );

      // Two stop conditions. A silently collected group never runs `clear()`,
      // so its signals are not destroyed but collected with it — the counter
      // only comes back through MEM-006's finalizer on the SignalImpl, and
      // that can land a sweep later than the group count.
      for (
        let i = 0;
        i < 20 &&
        (getSignalGroupsCount() > groupBaseline ||
          getSignalsCount() > signalBaseline);
        i += 1
      ) {
        await forceGc();
      }

      expect(
        hostRefs.filter((ref) => ref.deref() !== undefined).length,
        'a signal value must not keep its host alive',
      ).toBe(0);
      expect(getSignalGroupsCount()).toBe(groupBaseline);
      // The resource finalizer releases the handles before it drops the husk
      // out of `allGroups`, so waiting on the group count above is enough —
      // this needs no settle step of its own.
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(destBaseline);
    } finally {
      // The 50 hosts are unreachable by construction — that is the case
      // under test — so the static sweep is the only handle there is.
      SignalGroup.clear();
    }
  });

  it('a throwing release handle in a collected group is reported, not thrown (MEM-003)', async () => {
    // The resource finalizer runs without a caller: a throw out of it takes
    // the process down. Same shape as the link and auto-map finalizers, and
    // the thrower goes in *front* of the real handles — one at the end would
    // prove nothing about the ones behind it.
    const groupBaseline = getSignalGroupsCount();
    const destBaseline = getSubscriptionCount(globalDestroySignalQueue);

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    (() => {
      const host = {marker: 'mem003-throwing-release'};
      const group = SignalGroup.findOrCreate(host);
      group.attachSignal(createSignal(1));

      const resources = group[$groupResources];
      const real = [...resources.unsubs];
      resources.unsubs.clear();
      resources.unsubs.add(() => {
        throw new Error('release-boom');
      });
      for (const unsubscribe of real) {
        resources.unsubs.add(unsubscribe);
      }
    })();

    try {
      for (
        let i = 0;
        i < 20 && getSubscriptionCount(globalDestroySignalQueue) > destBaseline;
        i += 1
      ) {
        await forceGc();
      }

      expect(error).toHaveBeenCalledTimes(1);
      // The husk leaves `allGroups` despite the throw …
      expect(getSignalGroupsCount()).toBe(groupBaseline);
      // … and the real handles behind the thrower ran anyway.
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(destBaseline);
    } finally {
      error.mockRestore();
      // Same as above: the host lives and dies inside the IIFE. The rigged
      // handle only ever runs from the resource finalizer, so the sweep
      // itself stays silent.
      SignalGroup.clear();
    }
  });

  it('a group whose host dies while an effect keeps it alive is still cleared (MEM-003)', async () => {
    // The counter-direction to the test above, and the one nothing else
    // asserts: an attached effect is reachable from `globalEffectQueue` for
    // as long as it lives, and through the `once(effect, DESTROY, …)` hook
    // in `attachEffect()` it keeps its group alive too. So this group is
    // *not* collected with its host — the host-side FinalizationRegistry
    // fires instead and runs the real `clear()`.
    //
    // The marker is what makes it a proof: "the counters are back at zero"
    // alone would also be satisfied by a group that was quietly collected.
    // A DESTROY emit only happens on the `clear()` path, so if a later
    // cleanup ever turns the held-value deref into a no-op, this goes red
    // instead of going quietly green.
    let cleared = false;

    let host: object | null = {marker: 'mem003-effect-backstop'};
    const hostRef = new WeakRef(host);

    const group = SignalGroup.findOrCreate(host);
    const sig = createSignal(1, {attach: host});
    // No `host` in the closure — that is case B and stays alive by design.
    createEffect(() => void sig.get(), {attach: host});
    on(group, DESTROY, () => {
      cleared = true;
    });

    try {
      host = null;

      for (let i = 0; i < 20 && !cleared; i += 1) {
        await forceGc();
      }

      expect(hostRef.deref()).toBeUndefined();
      expect(
        cleared,
        'the FinalizationRegistry backstop must still run clear()',
      ).toBe(true);
      assertSignalsCount(0, 'after the effect-held group was cleared');
      assertEffectsCount(0, 'after the effect-held group was cleared');
    } finally {
      group.clear();
    }
  });

  it('getSignalGroupsCount() drops the husk of a collected group on the way past', async () => {
    // The resource finalizer takes the dead WeakRef out of `allGroups` too,
    // but it runs in a job of its own: a FinalizationRegistry callback is
    // never invoked synchronously from `gc()`. So the moment right after the
    // collection — with no `await` in between — is the one window in which
    // the husk is provably still in the set, and therefore the only one in
    // which the sweep inside the counter is the thing being measured.
    const baselineGroups = getSignalGroupsCount();
    let groupRef!: WeakRef<SignalGroup>;

    (() => {
      const host = {marker: 'husk-sweep'};
      groupRef = new WeakRef(SignalGroup.findOrCreate(host));
    })();

    let countAtCollection: number | undefined;

    try {
      expect(getSignalGroupsCount()).toBe(baselineGroups + 1);

      for (let i = 0; i < 20; i += 1) {
        gc();
        if (groupRef.deref() === undefined) {
          countAtCollection = getSignalGroupsCount();
          break;
        }
        await new Promise((resolve) => setImmediate(resolve));
      }

      expect(
        countAtCollection,
        'the group was never collected — the measurement never happened',
      ).not.toBeUndefined();

      expect(
        countAtCollection,
        'the husk is not counted, even before its finalizer has run',
      ).toBe(baselineGroups);
    } finally {
      // The host lives and dies inside the IIFE, so a group that was *not*
      // collected has no handle left but the static sweep.
      SignalGroup.clear();
    }
  });
});
