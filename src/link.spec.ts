import {on} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './assert-helpers.js';
import {DESTROY} from './constants.js';
import {
  createSignal,
  destroySignal,
  getLinksCount,
  link,
  SignalGroup,
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

      link(sigA, sigB);
      link(sigA, sigC);

      expect(getLinksCount()).toBe(2);

      destroySignal(sigA, sigB, sigC);
    });

    it('returns count of links from specific source signal', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(2);
      const sigC = createSignal(3);
      const sigD = createSignal(4);

      link(sigA, sigB);
      link(sigA, sigC);
      link(sigD, sigB);

      expect(getLinksCount(sigA)).toBe(2);
      expect(getLinksCount(sigD)).toBe(1);
      expect(getLinksCount(sigB)).toBe(0); // sigB is not a source

      destroySignal(sigA, sigB, sigC, sigD);
    });

    it('returns 0 for signal with no links', () => {
      const sigA = createSignal(1);

      expect(getLinksCount(sigA)).toBe(0);

      destroySignal(sigA);
    });
  });

  describe('link() with Signal objects', () => {
    it('links two Signal objects directly', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      expect(sigA.value).toBe(1);
      expect(sigB.value).toBe(-1);

      link(sigA, sigB);

      expect(sigB.value).toBe(1);

      sigA.set(42);

      expect(sigB.value).toBe(42);

      destroySignal(sigA, sigB);
    });

    it('links Signal object source to signal reader target', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      link(sigA, sigB.get);

      expect(sigB.value).toBe(1);

      sigA.set(100);

      expect(sigB.value).toBe(100);

      destroySignal(sigA, sigB);
    });

    it('links signal reader source to Signal object target', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      link(sigA.get, sigB);

      expect(sigB.value).toBe(1);

      sigA.set(100);

      expect(sigB.value).toBe(100);

      destroySignal(sigA, sigB);
    });
  });

  describe('link() with attach option', () => {
    it('attaches link to a SignalGroup', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const groupObject = {};

      const con = link(sigA, sigB, {attach: groupObject});

      expect(sigB.value).toBe(1);

      const group = SignalGroup.get(groupObject);
      expect(group).toBeDefined();

      // Clearing the group should destroy the link
      group!.clear();

      expect(con.isDestroyed).toBe(true);

      sigA.set(42);

      expect(sigB.value).toBe(1); // Should not update

      destroySignal(sigA, sigB);
    });

    it('attach returns the SignalGroup', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA, sigB);
      const groupObject = {};

      const group = con.attach(groupObject);

      expect(group).toBe(SignalGroup.get(groupObject));

      group.clear();

      expect(con.isDestroyed).toBe(true);

      destroySignal(sigA, sigB);
    });

    it('link is detached from group when destroyed directly', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const groupObject = {};

      const con = link(sigA, sigB, {attach: groupObject});

      expect(con.isDestroyed).toBe(false);

      con.destroy();

      expect(con.isDestroyed).toBe(true);

      // Group should still exist
      const group = SignalGroup.get(groupObject);
      expect(group).toBeDefined();

      // Cleanup
      group!.clear();

      destroySignal(sigA, sigB);
    });
  });

  describe('lastValue property', () => {
    it('lastValue is updated when link is created', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA, sigB);

      expect(con.lastValue).toBe(1);

      destroySignal(sigA, sigB);
    });

    it('lastValue is updated when source changes', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA, sigB);

      expect(con.lastValue).toBe(1);

      sigA.set(42);

      expect(con.lastValue).toBe(42);

      sigA.set(100);

      expect(con.lastValue).toBe(100);

      destroySignal(sigA, sigB);
    });

    it('lastValue is not updated when link is muted', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA, sigB);

      expect(con.lastValue).toBe(1);

      con.mute();

      sigA.set(42);

      expect(con.lastValue).toBe(1); // Should remain unchanged

      destroySignal(sigA, sigB);
    });

    it('lastValue is updated after touch()', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA, sigB);

      expect(con.lastValue).toBe(1);

      con.touch();

      expect(con.lastValue).toBe(1); // Same value but updated via touch

      destroySignal(sigA, sigB);
    });

    it('lastValue is undefined after destroy', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA, sigB);

      expect(con.lastValue).toBe(1);

      con.destroy();

      expect(con.lastValue).toBeUndefined();

      destroySignal(sigA, sigB);
    });

    it('lastValue works with callback target', () => {
      const sigA = createSignal(1);
      const callback = jest.fn();

      const con = link(sigA, callback);

      expect(con.lastValue).toBe(1);
      expect(callback).toHaveBeenCalledWith(1);

      sigA.set(42);

      expect(con.lastValue).toBe(42);
      expect(callback).toHaveBeenCalledWith(42);

      destroySignal(sigA);
    });
  });

  describe('mute/unmute edge cases', () => {
    it('mute on already muted link is a no-op', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const muteMock = jest.fn();

      const con = link(sigA, sigB);
      on(con, 'mute', muteMock);

      con.mute();
      expect(muteMock).toHaveBeenCalledTimes(1);

      con.mute(); // Second mute should be no-op
      expect(muteMock).toHaveBeenCalledTimes(1);

      expect(con.isMuted).toBe(true);

      destroySignal(sigA, sigB);
    });

    it('unmute on already unmuted link is a no-op', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const unmuteMock = jest.fn();

      const con = link(sigA, sigB);
      on(con, 'unmute', unmuteMock);

      expect(con.isMuted).toBe(false);

      con.unmute(); // Already unmuted, should be no-op
      expect(unmuteMock).toHaveBeenCalledTimes(0);

      destroySignal(sigA, sigB);
    });

    it('mute on destroyed link is a no-op', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const muteMock = jest.fn();

      const con = link(sigA, sigB);
      on(con, 'mute', muteMock);

      con.destroy();

      con.mute();
      expect(muteMock).toHaveBeenCalledTimes(0);

      destroySignal(sigA, sigB);
    });

    it('unmute on destroyed link is a no-op', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const unmuteMock = jest.fn();

      const con = link(sigA, sigB);
      on(con, 'unmute', unmuteMock);

      con.mute(); // First mute it
      con.destroy();

      con.unmute();
      expect(unmuteMock).toHaveBeenCalledTimes(0);

      destroySignal(sigA, sigB);
    });

    it('mute returns the link for chaining', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA, sigB);

      const result = con.mute();

      expect(result).toBe(con);

      destroySignal(sigA, sigB);
    });

    it('unmute returns the link for chaining', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA, sigB);
      con.mute();

      const result = con.unmute();

      expect(result).toBe(con);

      destroySignal(sigA, sigB);
    });
  });

  describe('touch() edge cases', () => {
    it('touch on muted link does not update target', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA, sigB);

      expect(sigB.value).toBe(1);

      con.mute();

      sigA.set(42);
      con.touch();

      // Target should not be updated when muted
      expect(sigB.value).toBe(1);

      destroySignal(sigA, sigB);
    });

    it('touch returns the link for chaining', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA, sigB);

      const result = con.touch();

      expect(result).toBe(con);

      destroySignal(sigA, sigB);
    });
  });

  describe('destroy edge cases', () => {
    it('destroy on already destroyed link is safe', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA, sigB);

      con.destroy();
      expect(con.isDestroyed).toBe(true);

      // Second destroy should not throw
      expect(() => con.destroy()).not.toThrow();
      expect(con.isDestroyed).toBe(true);

      destroySignal(sigA, sigB);
    });

    it('destroying target signal destroys the link', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA, sigB);
      expect(con.isDestroyed).toBe(false);

      destroySignal(sigB);

      expect(con.isDestroyed).toBe(true);

      destroySignal(sigA);
    });

    it('DESTROY event is emitted with link as argument', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const destroyMock = jest.fn();

      const con = link(sigA, sigB);
      on(con, DESTROY, destroyMock);

      con.destroy();

      expect(destroyMock).toHaveBeenCalledWith(con);

      destroySignal(sigA, sigB);
    });
  });

  describe('link singleton behavior', () => {
    it('returns same link when linking same source to same callback', () => {
      const sigA = createSignal(1);
      const callback = jest.fn();

      const con1 = link(sigA, callback);
      const con2 = link(sigA, callback);

      expect(con1).toBe(con2);
      expect(callback).toHaveBeenCalledTimes(1); // Only called once on first link

      destroySignal(sigA);
    });

    it('returns different links for different callbacks', () => {
      const sigA = createSignal(1);
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const con1 = link(sigA, callback1);
      const con2 = link(sigA, callback2);

      expect(con1).not.toBe(con2);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);

      destroySignal(sigA);
    });

    it('can create new link after previous link is destroyed', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con1 = link(sigA, sigB);
      expect(sigB.value).toBe(1);

      con1.destroy();

      sigA.set(42);
      expect(sigB.value).toBe(1); // Should not update after destroy

      sigB.set(-1); // Reset
      const con2 = link(sigA, sigB);

      expect(con1).not.toBe(con2);
      expect(sigB.value).toBe(42); // New link syncs current value

      destroySignal(sigA, sigB);
    });
  });

  describe('source property', () => {
    it('source property references the source signal implementation', () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA.get, sigB);

      expect(con.source).toBeDefined();
      expect(con.source.value).toBe(1);

      sigA.set(42);
      expect(con.source.value).toBe(42);

      destroySignal(sigA, sigB);
    });
  });
});
