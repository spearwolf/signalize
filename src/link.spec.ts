import {getSubscriptionCount, on, Priority} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {DESTROY} from './constants.js';
import {
  createSignal,
  destroySignal,
  getLinksCount,
  link,
  SignalGroup,
  unlink,
} from './index.js';

describe('link() comprehensive tests', () => {
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

  describe('getLinksCount()', () => {
    it('returns 0 when no links exist', () => {
      expect(getLinksCount()).toBe(0);
    });

    it('returns total count of all links without argument', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(2);
      const sigC = createSignal(3);

      try {
        link(sigA, sigB);
        link(sigA, sigC);

        expect(getLinksCount()).toBe(2);
      } finally {
        destroySignal(sigA, sigB, sigC);
      }
    });

    it('returns count of links from specific source signal', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(2);
      const sigC = createSignal(3);
      const sigD = createSignal(4);

      try {
        link(sigA, sigB);
        link(sigA, sigC);
        link(sigD, sigB);

        expect(getLinksCount(sigA)).toBe(2);
        expect(getLinksCount(sigD)).toBe(1);
        expect(getLinksCount(sigB)).toBe(0); // sigB is not a source
      } finally {
        destroySignal(sigA, sigB, sigC, sigD);
      }
    });

    it('returns 0 for signal with no links', () => {
      const sigA = createSignal(1);

      try {
        expect(getLinksCount(sigA)).toBe(0);
      } finally {
        destroySignal(sigA);
      }
    });

    // Contract test, not a guard pin: the
    // `sourceSignal != null` ternary in getLinksCount() (link.ts:397) is dead
    // defense — `signalImpl()` returns `undefined` for a non-signal, and
    // `WeakMap.prototype.get` on a non-object key returns `undefined` by
    // spec, never throws. Neither removing the ternary nor inverting it
    // turns this assertion red (inverting it only breaks the real-signal
    // branch, caught by 'returns count of links from specific source signal'
    // below — unrelated to this one). Kept because `getLinksCount(notASignal)
    // === 0` is still the documented public contract.
    it('returns 0 for an argument that is not a signal', () => {
      expect(getLinksCount({} as any)).toBe(0);
      expect(getLinksCount(42 as any)).toBe(0);
    });
  });

  describe('link() with Signal objects', () => {
    it('links two Signal objects directly', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        expect(sigA.value).toBe(1);
        expect(sigB.value).toBe(-1);

        link(sigA, sigB);

        expect(sigB.value).toBe(1);

        sigA.set(42);

        expect(sigB.value).toBe(42);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('links Signal object source to signal reader target', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        link(sigA, sigB.get);

        expect(sigB.value).toBe(1);

        sigA.set(100);

        expect(sigB.value).toBe(100);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('links signal reader source to Signal object target', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        link(sigA.get, sigB);

        expect(sigB.value).toBe(1);

        sigA.set(100);

        expect(sigB.value).toBe(100);
      } finally {
        destroySignal(sigA, sigB);
      }
    });
  });

  describe('link() with attach option', () => {
    it('attaches link to a SignalGroup', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const groupObject = {};

      try {
        const con = link(sigA, sigB, {attach: groupObject});

        expect(sigB.value).toBe(1);

        const group = SignalGroup.get(groupObject);
        expect(group).toBeDefined();

        // Clearing the group should destroy the link
        group!.clear();

        expect(con.isDestroyed).toBe(true);

        sigA.set(42);

        expect(sigB.value).toBe(1); // Should not update
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('attach returns the SignalGroup', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con = link(sigA, sigB);
        const groupObject = {};

        const group = con.attach(groupObject);

        expect(group).toBe(SignalGroup.get(groupObject));

        group.clear();

        expect(con.isDestroyed).toBe(true);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('link is detached from group when destroyed directly', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const groupObject = {};

      try {
        const con = link(sigA, sigB, {attach: groupObject});

        expect(con.isDestroyed).toBe(false);

        con.destroy();

        expect(con.isDestroyed).toBe(true);

        // Group should still exist
        const group = SignalGroup.get(groupObject);
        expect(group).toBeDefined();

        // Cleanup
        group!.clear();
      } finally {
        destroySignal(sigA, sigB);
      }
    });
  });

  describe('lastValue property', () => {
    it('lastValue is updated when link is created', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con = link(sigA, sigB);

        expect(con.lastValue).toBe(1);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('lastValue is updated when source changes', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con = link(sigA, sigB);

        expect(con.lastValue).toBe(1);

        sigA.set(42);

        expect(con.lastValue).toBe(42);

        sigA.set(100);

        expect(con.lastValue).toBe(100);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('lastValue is not updated when link is muted', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con = link(sigA, sigB);

        expect(con.lastValue).toBe(1);

        con.mute();

        sigA.set(42);

        expect(con.lastValue).toBe(1); // Should remain unchanged
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('lastValue is updated after touch()', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con = link(sigA, sigB);

        expect(con.lastValue).toBe(1);

        con.touch();

        expect(con.lastValue).toBe(1); // Same value but updated via touch
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('lastValue is undefined after destroy', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con = link(sigA, sigB);

        expect(con.lastValue).toBe(1);

        con.destroy();

        expect(con.lastValue).toBeUndefined();
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('lastValue works with callback target', () => {
      const sigA = createSignal(1);
      const callback = vi.fn();

      try {
        const con = link(sigA, callback);

        expect(con.lastValue).toBe(1);
        expect(callback).toHaveBeenCalledWith(1);

        sigA.set(42);

        expect(con.lastValue).toBe(42);
        expect(callback).toHaveBeenCalledWith(42);
      } finally {
        destroySignal(sigA);
      }
    });
  });

  describe('mute/unmute edge cases', () => {
    it('mute on already muted link is a no-op', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const muteMock = vi.fn();

      try {
        const con = link(sigA, sigB);
        on(con, 'mute', muteMock);

        con.mute();
        expect(muteMock).toHaveBeenCalledTimes(1);

        con.mute(); // Second mute should be no-op
        expect(muteMock).toHaveBeenCalledTimes(1);

        expect(con.isMuted).toBe(true);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('unmute on already unmuted link is a no-op', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const unmuteMock = vi.fn();

      try {
        const con = link(sigA, sigB);
        on(con, 'unmute', unmuteMock);

        expect(con.isMuted).toBe(false);

        con.unmute(); // Already unmuted, should be no-op
        expect(unmuteMock).toHaveBeenCalledTimes(0);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('mute on destroyed link is a no-op', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const muteMock = vi.fn();

      try {
        const con = link(sigA, sigB);
        on(con, 'mute', muteMock);

        con.destroy();

        con.mute();
        expect(muteMock).toHaveBeenCalledTimes(0);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('unmute on destroyed link is a no-op', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const unmuteMock = vi.fn();

      try {
        const con = link(sigA, sigB);
        on(con, 'unmute', unmuteMock);

        con.mute(); // First mute it
        con.destroy();

        con.unmute();
        expect(unmuteMock).toHaveBeenCalledTimes(0);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('mute returns the link for chaining', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con = link(sigA, sigB);

        const result = con.mute();

        expect(result).toBe(con);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('unmute returns the link for chaining', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con = link(sigA, sigB);
        con.mute();

        const result = con.unmute();

        expect(result).toBe(con);
      } finally {
        destroySignal(sigA, sigB);
      }
    });
  });

  describe('touch() edge cases', () => {
    it('touch on muted link does not update target', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con = link(sigA, sigB);

        expect(sigB.value).toBe(1);

        con.mute();

        sigA.set(42);
        con.touch();

        // Target should not be updated when muted
        expect(sigB.value).toBe(1);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('touch returns the link for chaining', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con = link(sigA, sigB);

        const result = con.touch();

        expect(result).toBe(con);
      } finally {
        destroySignal(sigA, sigB);
      }
    });
  });

  describe('destroy edge cases', () => {
    it('destroy on already destroyed link is safe', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con = link(sigA, sigB);

        con.destroy();
        expect(con.isDestroyed).toBe(true);

        // Second destroy should not throw
        expect(() => con.destroy()).not.toThrow();
        expect(con.isDestroyed).toBe(true);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('destroying target signal destroys the link', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con = link(sigA, sigB);
        expect(con.isDestroyed).toBe(false);

        destroySignal(sigB);

        expect(con.isDestroyed).toBe(true);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('DESTROY event is emitted with link as argument', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const destroyMock = vi.fn();

      try {
        const con = link(sigA, sigB);
        on(con, DESTROY, destroyMock);

        con.destroy();

        expect(destroyMock).toHaveBeenCalledWith(con);
      } finally {
        destroySignal(sigA, sigB);
      }
    });
  });

  describe('link singleton behavior', () => {
    it('returns same link when linking same source to same callback', () => {
      const sigA = createSignal(1);
      const callback = vi.fn();

      try {
        const con1 = link(sigA, callback);
        const con2 = link(sigA, callback);

        expect(con1).toBe(con2);
        expect(callback).toHaveBeenCalledTimes(1); // Only called once on first link
      } finally {
        destroySignal(sigA);
      }
    });

    it('returns different links for different callbacks', () => {
      const sigA = createSignal(1);
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      try {
        const con1 = link(sigA, callback1);
        const con2 = link(sigA, callback2);

        expect(con1).not.toBe(con2);
        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledTimes(1);
      } finally {
        destroySignal(sigA);
      }
    });

    it('can create new link after previous link is destroyed', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con1 = link(sigA, sigB);
        expect(sigB.value).toBe(1);

        con1.destroy();

        sigA.set(42);
        expect(sigB.value).toBe(1); // Should not update after destroy

        sigB.set(-1); // Reset
        const con2 = link(sigA, sigB);

        expect(con1).not.toBe(con2);
        expect(sigB.value).toBe(42); // New link syncs current value
      } finally {
        destroySignal(sigA, sigB);
      }
    });
  });

  describe('source property', () => {
    it('source property references the source signal implementation', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      try {
        const con = link(sigA.get, sigB);

        expect(con.source).toBeDefined();
        expect(con.source.value).toBe(1);

        sigA.set(42);
        expect(con.source.value).toBe(42);
      } finally {
        destroySignal(sigA, sigB);
      }
    });
  });

  describe('Attach on cache hit', () => {
    it('attaches the cached link to a second group instead of dropping attach', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const group1Object = {};
      const group2Object = {};

      try {
        const con1 = link(sigA, sigB, {attach: group1Object});
        const con2 = link(sigA, sigB, {attach: group2Object});

        expect(con1).toBe(con2);

        // Clearing only the *second* group must destroy the shared link too —
        // it now died with whichever attached group clears first.
        SignalGroup.get(group2Object)!.clear();

        expect(con1.isDestroyed).toBe(true);

        sigA.set(42);
        expect(sigB.value).toBe(1); // link is dead, no more propagation
      } finally {
        SignalGroup.get(group1Object)?.clear();
        destroySignal(sigA, sigB);
      }
    });

    it('re-attaching the same group on repeated cache hits does not grow the link subscription count', () => {
      // Regression for a leak in the cache-hit path:
      // SignalLink.attach() used to register a fresh `once(this, DESTROY,
      // ...)` listener on every call, unconditionally. Since eventize does
      // not dedupe plain function listeners, calling link() with the same
      // {attach: g} repeatedly (e.g. once per render/effect rerun) grew the
      // link's own listener count without bound.
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const groupObject = {};

      try {
        const con1 = link(sigA, sigB, {attach: groupObject});
        const baseline = getSubscriptionCount(con1);

        const con2 = link(sigA, sigB, {attach: groupObject});
        const con3 = link(sigA, sigB, {attach: groupObject});

        expect(con2).toBe(con1);
        expect(con3).toBe(con1);
        expect(getSubscriptionCount(con1)).toBe(baseline);

        // Same guard applies to the direct public call, not just the
        // link()-cache-hit path.
        con1.attach(groupObject);
        con1.attach(groupObject);
        expect(getSubscriptionCount(con1)).toBe(baseline);

        SignalGroup.get(groupObject)!.clear();
        expect(con1.isDestroyed).toBe(true);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it("no combination of the two attach routes grows the link's DESTROY listener list", () => {
      // Not a regression test for the destroy hook itself — this one is green before
      // the fix too. It is the guard against the two mistakes the naive fix
      // makes once the counter-edge moves into `SignalGroup.attachLink()`:
      // deduping on `#links.has(link)` (reopened by every public
      // `detachLink()`, so each detach/attach cycle would add another
      // listener), and leaving `SignalLink.attach()` its own hook on top of
      // the new one (two listeners per (link, group) pair doing the same
      // `Set.delete`).
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const groupObject = {};

      try {
        const con = link(sigA, sigB);
        con.attach(groupObject);
        const group = SignalGroup.get(groupObject)!;
        const baseline = getSubscriptionCount(con);

        for (let i = 0; i < 5; i++) {
          con.attach(groupObject);
          group.attachLink(con);
          group.detachLink(con);
          con.attach(groupObject);
        }

        expect(getSubscriptionCount(con)).toBe(baseline);

        // A *second* group is a different pair, so it costs exactly one more
        // listener — not two, and not one per attach route.
        const otherObject = {};
        con.attach(otherObject);
        const otherGroup = SignalGroup.get(otherObject)!;
        expect(getSubscriptionCount(con)).toBe(baseline + 1);

        group.clear();
        otherGroup.clear();
        expect(con.isDestroyed).toBe(true);
      } finally {
        destroySignal(sigA, sigB);
      }
    });

    it('re-attach after an explicit detachLink() actually re-attaches, not just returns the group', () => {
      // Regression for a narrower cache-hit symptom introduced by the
      // idempotency guard `SignalLink.attach()` used to carry: it recorded
      // "this link has been attached to `g` at some point" and never forgot
      // it, not even after `SignalGroup.detachLink()` — the documented,
      // public way to remove a link from a group without destroying it.
      // Calling `link.attach(g)` again after such a detach returned early,
      // so `group.attachLink(this)` never ran a second time: `attach()`
      // reported success (returned the group) but `g.clear()` no longer
      // destroyed the link. The guard sits in `attachLink()`
      // and covers only the DESTROY hook, so membership is re-established
      // unconditionally — this test's claim is unchanged either way.
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const groupObject = {};

      try {
        const con = link(sigA, sigB, {attach: groupObject});
        const group = SignalGroup.get(groupObject)!;

        group.detachLink(con);
        con.attach(groupObject);

        group.clear();

        expect(con.isDestroyed).toBe(true);

        sigA.set(42);
        expect(sigB.value).toBe(1); // link is dead, no more propagation
      } finally {
        destroySignal(sigA, sigB);
      }
    });
  });

  describe('Invalid source is validated before any registry entry is created', () => {
    it('throws a clear, explicit error when source is not a signal, and leaves getLinksCount() at 0', () => {
      const notASignal = {} as any;

      // Must match the new explicit validation message, not just "anything
      // throws" — the pre-fix code also threw here, but only by accident:
      // the SignalLink constructor crashed on `this.source.id` with an
      // opaque TypeError, after already having inserted a stale registry
      // entry keyed by `undefined`.
      expect(() => link(notASignal, () => {})).toThrow(
        /source must be a signal/,
      );
      expect(getLinksCount()).toBe(0);
    });
  });

  describe('An unbounded link register on one source is reported once', () => {
    it('stays silent below the threshold and warns once when a source reaches it', () => {
      const src = createSignal(0);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        for (let i = 0; i < 999; i += 1) {
          link(src, () => {});
        }
        expect(getLinksCount(src)).toBe(999);
        expect(warn).not.toHaveBeenCalled();

        link(src, () => {});
        expect(getLinksCount(src)).toBe(1000);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toMatch(
          /links on a single source signal/,
        );

        // Once per source, for good — not once per link past the mark.
        link(src, () => {});
        link(src, () => {});
        expect(getLinksCount(src)).toBe(1002);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        // Teardown belongs in here, not after the block: a failing
        // assertion would otherwise leave 1002 links and a live signal
        // standing, the afterEach guards would fire, and the *next* test
        // would go red as collateral for a failure that isn't its own.
        warn.mockRestore();
        unlink(src);
        destroySignal(src);
      }
    });

    it('counts per source, not globally', () => {
      const a = createSignal(0);
      const b = createSignal(0);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        for (let i = 0; i < 600; i += 1) {
          link(a, () => {});
          link(b, () => {});
        }

        expect(getLinksCount()).toBe(1200);
        expect(getLinksCount(a)).toBe(600);
        expect(getLinksCount(b)).toBe(600);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
        unlink(a);
        unlink(b);
        destroySignal(a, b);
      }
    });
  });

  // The `if (links.size === 0) gLinks.delete(sourceSignal)`
  // guard in the DESTROY handler at link.ts:313-314 survives plain removal —
  // the resulting stale, empty Map is silently reused by the next link() on
  // the same source, and getLinksCount(source) reads `.size` either way. It
  // only shows up under inversion (`links.size !== 0`), which wipes the
  // registry entry for a source that still has a live link on it.
  describe('The DESTROY handler only drops a source entry once it is actually empty', () => {
    it('destroying one of several links on a source leaves getLinksCount(source) accurate for the rest', () => {
      // The one test in this block that actually discriminates: red under
      // `links.size !== 0`, green under plain removal of the guard.
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const sigC = createSignal(-2);

      try {
        const linkB = link(sigA, sigB);
        link(sigA, sigC);

        expect(getLinksCount(sigA)).toBe(2);

        linkB.destroy();

        // The source still has one live link — its registry entry must not
        // be torn down along with the one that was destroyed.
        expect(getLinksCount(sigA)).toBe(1);

        sigA.set(42);
        expect(sigC.value).toBe(42); // the surviving link still propagates
      } finally {
        destroySignal(sigA, sigB, sigC);
      }
    });

    // Contract test, not a guard pin: stays green under both removing and
    // inverting the guard above (the stale empty Map either gets replaced or
    // reused, and either way the next link() lands at count 1). Kept because
    // "a source counts from 1 again after its last link is destroyed" is the
    // documented behaviour (see link()'s JSDoc "Lifetime" section).
    it('a source counts from 1 again after its last link is destroyed and a new one is created', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const sigC = createSignal(-2);

      try {
        const first = link(sigA, sigB);
        expect(getLinksCount(sigA)).toBe(1);

        first.destroy();
        expect(getLinksCount(sigA)).toBe(0);

        link(sigA, sigC);
        expect(getLinksCount(sigA)).toBe(1);
      } finally {
        destroySignal(sigA, sigB, sigC);
      }
    });
  });

  // Last block in the file on purpose: before the fix the counter drift
  // this test exposes is permanent for the whole module, so every test
  // behind it would fail as collateral in the red run.
  describe('The registry lets go even when a DESTROY listener throws first', () => {
    it('a throwing listener does not strand the entry, the counter or the next link()', () => {
      const src = createSignal(1);
      const target = createSignal(0);

      try {
        const first = link(src, target);
        assertLinksCount(1, 'after link');

        on(first, DESTROY, Priority.High, () => {
          throw new Error('listener boom');
        });

        expect(
          () => first.destroy(),
          'the listener error still reaches the caller',
        ).toThrow('listener boom');

        assertLinksCount(0, 'the counter came back down');

        const second = link(src, target);
        try {
          expect(
            second,
            'link() built a fresh link instead of handing back the frozen one',
          ).not.toBe(first);
          expect(second.isDestroyed, 'and it is usable').toBe(false);
        } finally {
          second.destroy();
        }
      } finally {
        destroySignal(src, target);
      }
    });
  });
});
