import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './assert-helpers.js';
import {SignalGroup} from './SignalGroup.js';

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

    // The SignalGroup itself is still alive (held by `allGroups`), but it
    // must not transitively pin the user object.
    expect(hostRef.deref()).toBeUndefined();
  });
});
