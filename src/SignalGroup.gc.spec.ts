import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './assert-helpers.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {getSignalGroupsCount, SignalGroup} from './SignalGroup.js';

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
});
