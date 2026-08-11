import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './createSignal.js';
import {requireCreateEffect} from './effect-hook.js';
// Imported for its side effect as much as for the counter: the last line of
// `effects.ts` is what fills the hook, and nothing else in this file's graph
// reaches that module any more — that is the whole point of ARCH-002.
import {getEffectsCount} from './effects.js';

describe('effect-hook', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  it('throws while the placeholder is empty', async () => {
    // A fresh copy of the module, with `effects.js` never evaluated against
    // it — the state a multi-module build produces when it eliminates that
    // module while keeping a caller of `onChange()`. Without the reset this
    // branch is unreachable: in this process the hook is long since filled.
    vi.resetModules();
    const fresh = await import('./effect-hook.js');

    expect(() => fresh.requireCreateEffect()).toThrow(/effect subsystem/);
  });

  it('hands back the factory that effects.ts registered', () => {
    // The witness for the *place* of the registration: delete the last line
    // of `effects.ts` and this is the test that goes red. It does not witness
    // the *time* — measured 2026-08-11: defer the line by a microtask and all
    // three tests here stay green, because Vitest's module runner awaits every
    // import and drains the queue before this file's body runs. A plain `node`
    // ESM run does catch it (`lib/index.js`, top-level `onChange()`, throws),
    // so that guard belongs in `smoke/`, not here.
    expect(typeof requireCreateEffect()).toBe('function');
  });

  it('drives Signal.onChange() through the hook', () => {
    const sig = createSignal(1);
    const seen: number[] = [];

    try {
      const off = sig.onChange((val) => {
        seen.push(val);
      });

      // `onChange()` does not fire on subscribe — the first entry is the
      // write, not the current value.
      expect(seen).toEqual([]);
      expect(getEffectsCount()).toBe(1);

      sig.set(2);
      expect(seen).toEqual([2]);

      off();
      expect(getEffectsCount()).toBe(0);

      sig.set(4);
      expect(seen).toEqual([2]);
    } finally {
      sig.destroy();
    }
  });
});
