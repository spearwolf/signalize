import {warnDeprecatedOnce} from './deprecation-warnings.js';
import {onSignalizeError} from './signalize-error.js';
import type {SignalizeErrorPayload} from './types.js';

// No counter guards here: this file creates no signal, no effect
// and no link — it calls the deprecation gate directly and collects what it
// reports. There is nothing for `assertEffectsCount` / `assertSignalsCount` /
// `assertLinksCount` to watch.
//
// The gate is module-scoped, so the state these tests build up is shared
// between them and reset only by Vitest's per-file isolation. That is the
// subject, not an accident: read the tests in order.
describe('warnDeprecatedOnce() gates a notice per call site', () => {
  let seen: SignalizeErrorPayload[];
  let unsubscribe: () => void;

  beforeEach(() => {
    seen = [];
    unsubscribe = onSignalizeError((payload) => {
      seen.push(payload);
    });
  });

  afterEach(() => {
    unsubscribe();
  });

  it('reports the first call for a key, as a warn-level deprecation', () => {
    warnDeprecatedOnce('SignalGroup.destroy', '[signalize] first notice');

    expect(seen).toHaveLength(1);
    expect(seen[0].level).toBe('warn');
    expect(seen[0].source).toBe('deprecation');
    expect(seen[0].message).toBe('[signalize] first notice');
    expect(seen[0].error).toBeUndefined();
  });

  it('stays quiet on every further call with the same key', () => {
    // The test above already spent this key. A different message text does
    // not reopen the gate — the key is what it is keyed on.
    warnDeprecatedOnce('SignalGroup.destroy', '[signalize] first notice');
    warnDeprecatedOnce('SignalGroup.destroy', '[signalize] a different text');

    expect(seen).toHaveLength(0);
  });

  it('gates per key, not globally', () => {
    warnDeprecatedOnce('SignalGroup#destroy', '[signalize] second call site');
    warnDeprecatedOnce('signalReader(callback)', '[signalize] third call site');
    warnDeprecatedOnce('SignalGroup#destroy', '[signalize] second call site');

    expect(seen.map((payload) => payload.message)).toEqual([
      '[signalize] second call site',
      '[signalize] third call site',
    ]);
  });
});
