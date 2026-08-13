// `off()` from `@spearwolf/eventize` cannot be made to throw through the
// public API — every subscription this package creates unsubscribes
// cleanly. The witness needs a seam, so this file wraps `off()` itself and
// makes it throw, after running for real, for a target the test marks
// beforehand. Only the one-argument form `off(obj)` is affected, and only
// for a marked target: `off(queue, listener)` runs everywhere else in the
// tree and must stay unaffected.
const throwingTargets = vi.hoisted(() => new WeakSet<object>());

vi.mock('@spearwolf/eventize', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@spearwolf/eventize')>();
  return {
    ...actual,
    off: (...args: any[]) => {
      const result = (actual.off as any)(...args);
      if (
        args.length === 1 &&
        args[0] != null &&
        throwingTargets.has(args[0])
      ) {
        throw new Error('[test] off boom');
      }
      return result;
    },
  };
});

import {on} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
  getGroupMemberCounts,
  NO_GROUP_MEMBERS,
} from './__testing__/assert-helpers.js';
import {DESTROY} from './constants.js';
import {createSignal} from './create-signal.js';
import {createEffect, getEffectsCount} from './effects.js';
import {getLinksCount, link} from './link.js';
import {getSignalGroupsCount, SignalGroup} from './SignalGroup.js';
import {SignalLinkToCallback} from './SignalLink.js';
import {destroySignal, getSignalsCount} from './signal-core.js';
import type {SignalLike} from './types.js';

describe('teardown survives a throwing off()', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
  });

  afterEach(() => {
    SignalGroup.clear();
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  describe('SignalGroup#clear()', () => {
    it('finishes the whole teardown when off(this) throws, and rethrows the single error unchanged', () => {
      const groupsBefore = getSignalGroupsCount();

      const host = {};
      const childHost = {};
      const group = SignalGroup.findOrCreate(host);
      const child = SignalGroup.findOrCreate(childHost);
      group.attachGroup(child);

      const sig = createSignal(0, {attach: host});
      createEffect(() => sig.get(), {attach: host});
      link(sig, () => {}, {attach: host});

      throwingTargets.add(group);

      try {
        expect(() => group.clear()).toThrow('[test] off boom');

        expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
        expect(getEffectsCount()).toBe(0);
        expect(getSignalsCount()).toBe(0);
        expect(getLinksCount()).toBe(0);
        expect(getSignalGroupsCount()).toBe(groupsBefore);
        expect(SignalGroup.get(host)).toBeUndefined();
      } finally {
        throwingTargets.delete(group);
      }
    });

    it('bundles a throwing off(this) with an earlier-collected DESTROY listener error into an AggregateError', () => {
      const host = {};
      const group = SignalGroup.findOrCreate(host);

      on(group, DESTROY, () => {
        throw new Error('[test] destroy listener boom');
      });

      throwingTargets.add(group);

      try {
        let caught: unknown;
        try {
          group.clear();
        } catch (err) {
          caught = err;
        }

        expect(caught).toBeInstanceOf(AggregateError);
        const agg = caught as AggregateError;
        expect(agg.message).toBe(
          '[signalize] 2 errors while clearing a signal group',
        );
        expect((agg.errors as Error[]).map((e) => e.message)).toEqual([
          '[test] destroy listener boom',
          '[test] off boom',
        ]);
      } finally {
        throwingTargets.delete(group);
      }
    });
  });

  describe('SignalLink#destroy()', () => {
    it('finishes the whole teardown when off(this) throws, and rethrows the single error unchanged', () => {
      const sig = createSignal(1);
      try {
        const con = link(sig, () => {});
        throwingTargets.add(con);

        try {
          expect(() => con.destroy()).toThrow('[test] off boom');

          expect(Object.isFrozen(con)).toBe(true);
          expect(con.lastValue).toBeUndefined();
          expect(con.isDestroyed).toBe(true);
        } finally {
          throwingTargets.delete(con);
        }
      } finally {
        destroySignal(sig);
      }
    });

    it('bundles a throwing off(this) with an earlier-collected release-handle error into an AggregateError', () => {
      // `releaseOnDestroy()` is `protected`, so a throwing handle can only be
      // installed from a subclass — same seam `SignalLink.spec.ts`'s S6 block
      // uses.
      class ThrowingReleaseLink extends SignalLinkToCallback<number> {
        constructor(
          source: SignalLike<number>,
          target: (value: number) => void,
        ) {
          super(source, target);
          this.releaseOnDestroy(() => {
            throw new Error('[test] release boom');
          });
        }
      }

      const sig = createSignal(1);
      try {
        const con = new ThrowingReleaseLink(sig, () => {});
        throwingTargets.add(con);

        try {
          let caught: unknown;
          try {
            con.destroy();
          } catch (err) {
            caught = err;
          }

          expect(caught).toBeInstanceOf(AggregateError);
          const agg = caught as AggregateError;
          expect(agg.message).toBe(
            '[signalize] 2 errors while tearing down a SignalLink',
          );
          expect((agg.errors as Error[]).map((e) => e.message)).toEqual([
            '[test] release boom',
            '[test] off boom',
          ]);
        } finally {
          throwingTargets.delete(con);
        }
      } finally {
        destroySignal(sig);
      }
    });
  });
});
