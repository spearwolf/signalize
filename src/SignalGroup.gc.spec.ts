import {on} from '@spearwolf/eventize';
import type {MockInstance} from 'vitest';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './assert-helpers.js';
import {DESTROY} from './constants.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {link} from './link.js';
import {getSignalGroupsCount, SignalGroup} from './SignalGroup.js';
import type {SignalLink} from './SignalLink.js';

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

gcDescribe('SignalGroup GC behavior (requires --expose-gc)', () => {
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

    SignalGroup.findOrCreate(host);

    // User drops their last strong reference. The only remaining paths are
    // the WeakMap (does not pin) and the SignalGroup's WeakRef storeKey
    // (does not pin). Therefore `host` must become reclaimable.
    host = null;

    await forceGc();

    expect(ref.deref()).toBeUndefined();
  });

  it('user object is reclaimable even when the SignalGroup is never explicitly cleared', async () => {
    let host: object | null = {marker: 'never-cleared'};
    const hostRef = new WeakRef(host);

    SignalGroup.findOrCreate(host);

    host = null;

    await forceGc();

    // Eventually the FinalizationRegistry callback clears the group and its
    // attached resources; the user object itself is reclaimable in either case.
    expect(hostRef.deref()).toBeUndefined();
  });

  it('FinalizationRegistry clears the orphaned group and its attached resources', async () => {
    const baselineGroups = getSignalGroupsCount();

    let host: object | null = {marker: 'fr-cleanup'};
    const hostRef = new WeakRef(host);

    const group = SignalGroup.findOrCreate(host);
    group.attachSignal(createSignal(1, {attach: host}));
    createEffect(() => {}, {attach: host});

    expect(getSignalGroupsCount()).toBe(baselineGroups + 1);

    host = null;

    // GC the user object, then yield enough microtasks for the FR callback
    // to flush. FR firing is non-deterministic, so retry within a budget.
    for (let i = 0; i < 20 && getSignalGroupsCount() > baselineGroups; i += 1) {
      await forceGc();
    }

    expect(hostRef.deref()).toBeUndefined();
    expect(getSignalGroupsCount()).toBe(baselineGroups);
    assertSignalsCount(0, 'after FR cleanup');
    assertEffectsCount(0, 'after FR cleanup');
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

    host = null;

    for (let i = 0; i < 20 && getSignalGroupsCount() > baselineGroups; i += 1) {
      await forceGc();
    }

    expect(getSignalGroupsCount()).toBe(baselineGroups);
    assertSignalsCount(0, 'after FR cleanup with re-entrant clear');
  });

  it('explicit clear() unregisters from FinalizationRegistry (no double-fire)', async () => {
    const baselineGroups = getSignalGroupsCount();

    let host: object | null = {marker: 'explicit-clear'};
    const group = SignalGroup.findOrCreate(host);
    group.attachSignal(createSignal(1, {attach: host}));

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
  });

  it('a throwing teardown in an FR-collected group is reported, not thrown', async () => {
    const baselineGroups = getSignalGroupsCount();
    const errorSpy: MockInstance = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      let host: object | null = {marker: 'fr-throwing-cleanup'};
      SignalGroup.findOrCreate(host);
      createEffect(
        () => () => {
          throw new Error('cleanup boom from FR');
        },
        {attach: host},
      );

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

    // Both routes out of the group are exercised: the counter-edge takes
    // the link out of `#links`, and nothing else may keep holding it.
    signalLink.destroy();
    signalLink = null;

    await forceGc();

    expect(linkRef.deref()).toBeUndefined();

    source.destroy();
    group.clear();
  });
});
