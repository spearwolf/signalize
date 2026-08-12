import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './create-signal.js';
import {SignalGroup} from './SignalGroup.js';
import {destroySignal} from './signal-core.js';
import {onSignalizeError} from './signalize-error.js';
import type {SignalizeErrorPayload} from './types.js';

/**
 * Every deprecated call site of the library, driven from **one** module graph.
 *
 * This is the only place where the three `DeprecationKey` values are held
 * apart from each other. `warnDeprecatedOnce()` is keyed, not call-site-aware:
 * give two sites the same key and the second one falls silent forever — no
 * type error, no failing test, just a notice that never appears again. Each
 * site tested in its own file would pass happily with all three keys spelled
 * the same.
 *
 * Which is why the assertion is on the set of *messages*, not on a count: a
 * count of three could also be reached by one site reporting three times.
 */
describe('each deprecated call site keeps its own once-gate (CONS-004)', () => {
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

  it('reports all three, once each, and no site swallows another', () => {
    const seen: SignalizeErrorPayload[] = [];
    const unsubscribe = onSignalizeError((payload) => {
      seen.push(payload);
    });

    const host = {};
    SignalGroup.findOrCreate(host);
    const group = SignalGroup.findOrCreate({});
    const sig = createSignal(1);

    try {
      // Twice each: the second call of every pair must add nothing.
      SignalGroup.destroy(host);
      SignalGroup.destroy(host);
      group.destroy();
      group.destroy();
      sig.get(() => {});
      sig.get(() => {});

      expect(seen.map((payload) => payload.message).sort()).toEqual([
        '[signalize] SignalGroup#destroy is deprecated. Use SignalGroup#clear instead.',
        '[signalize] SignalGroup.destroy(obj) is deprecated. Use SignalGroup.delete(obj) instead.',
        '[signalize] signalReader(callback) is deprecated and will be removed in a future release. Use Signal.onChange(callback) instead — it returns an unsubscribe function for proper cleanup.',
      ]);
      expect(seen.every((payload) => payload.source === 'deprecation')).toBe(
        true,
      );
    } finally {
      unsubscribe();
      destroySignal(sig);
      group.clear();
      SignalGroup.delete(host);
    }
  });
});
