import {getSubscriptionCount, on, once, Priority} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
  getGroupMemberCounts,
  NO_GROUP_MEMBERS,
} from './assert-helpers.js';
import {$effect, DESTROY, OFF} from './constants.js';
import {createMemo} from './createMemo.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {
  globalDestroySignalQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './global-queues.js';
import {link} from './link.js';
import {$setParentGroup, SignalGroup} from './SignalGroup.js';
import {SignalLinkToCallback} from './SignalLink.js';

// Nothing attached to a group may survive its teardown on the global queues.
const subscriptionSnapshot = () => ({
  signal: getSubscriptionCount(globalSignalQueue),
  destroySignal: getSubscriptionCount(globalDestroySignalQueue),
  effect: getSubscriptionCount(globalEffectQueue),
});

describe('SignalGroup', () => {
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

  describe('static methods', () => {
    it('SignalGroup.get() returns undefined for null/undefined', () => {
      expect(SignalGroup.get(null as any)).toBeUndefined();
      expect(SignalGroup.get(undefined as any)).toBeUndefined();
    });

    it('SignalGroup.get() returns the SignalGroup for an object', () => {
      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      expect(SignalGroup.get(obj)).toBe(group);
      group.clear();
    });

    it('SignalGroup.get() returns self when passed a SignalGroup', () => {
      const group = SignalGroup.findOrCreate({});
      expect(SignalGroup.get(group)).toBe(group);
      group.clear();
    });

    it('SignalGroup.findOrCreate() creates a new group', () => {
      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      expect(group).toBeInstanceOf(SignalGroup);
      expect(SignalGroup.get(obj)).toBe(group);
      group.clear();
    });

    it('SignalGroup.findOrCreate() returns existing group', () => {
      const obj = {};
      const group1 = SignalGroup.findOrCreate(obj);
      const group2 = SignalGroup.findOrCreate(obj);
      expect(group1).toBe(group2);
      group1.clear();
    });

    it('SignalGroup.findOrCreate() throws for null', () => {
      expect(() => SignalGroup.findOrCreate(null as any)).toThrow(
        'Cannot create a group with a null object',
      );
    });

    it('SignalGroup.delete() removes a group', () => {
      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      const signal = createSignal(1);
      group.attachSignal(signal);

      assertSignalsCount(1, 'after attach');

      SignalGroup.delete(obj);

      assertSignalsCount(0, 'after delete');
      expect(SignalGroup.get(obj)).toBeUndefined();
    });

    it('SignalGroup.clear() removes all groups', () => {
      const obj1 = {};
      const obj2 = {};
      const group1 = SignalGroup.findOrCreate(obj1);
      const group2 = SignalGroup.findOrCreate(obj2);

      const signal1 = createSignal(1);
      const signal2 = createSignal(2);

      group1.attachSignal(signal1);
      group2.attachSignal(signal2);

      assertSignalsCount(2, 'after attaching signals');

      SignalGroup.clear();

      assertSignalsCount(0, 'after clear');
      expect(SignalGroup.get(obj1)).toBeUndefined();
      expect(SignalGroup.get(obj2)).toBeUndefined();
    });

    it('SignalGroup.destroy() is deprecated but works', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      const signal = createSignal(1);
      group.attachSignal(signal);

      assertSignalsCount(1, 'after attach');

      SignalGroup.destroy(obj);

      expect(warnSpy).toHaveBeenCalledWith(
        'SignalGroup.destroy(obj) is deprecated. Use SignalGroup.delete(obj) instead.',
      );

      assertSignalsCount(0, 'after destroy');
      expect(SignalGroup.get(obj)).toBeUndefined();

      warnSpy.mockRestore();
    });
  });

  describe('signal management', () => {
    it('attachSignal() adds a signal to the group', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignal(signal);

      assertSignalsCount(1, 'signal attached');

      group.clear();
    });

    it('attachSignal() throws when attaching a destroyed signal', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);
      signal.destroy();

      expect(() => group.attachSignal(signal)).toThrow(
        'Cannot attach a destroyed signal to a group',
      );

      group.clear();
    });

    it('detachSignal() removes a signal from the group but does not destroy it', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignal(signal);
      assertSignalsCount(1, 'signal attached');

      group.detachSignal(signal);
      assertSignalsCount(1, 'signal still exists after detach');

      signal.destroy();
    });

    it('clear() destroys attached signals', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignal(signal);
      assertSignalsCount(1, 'signal attached');

      group.clear();
      assertSignalsCount(0, 'signal destroyed after clear');
    });
  });

  describe('named signals', () => {
    it('attachSignalByName() associates a signal with a name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignalByName('mySignal', signal);

      expect(group.hasSignal('mySignal')).toBe(true);
      expect(group.signal('mySignal')).toBe(signal);

      group.clear();
    });

    it('attachSignalByName() without signal removes the name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignalByName('mySignal', signal);
      expect(group.hasSignal('mySignal')).toBe(true);

      group.attachSignalByName('mySignal');
      expect(group.hasSignal('mySignal')).toBe(false);

      signal.destroy();
      group.clear();
    });

    it('signal() returns undefined for unknown names', () => {
      const group = SignalGroup.findOrCreate({});
      expect(group.signal('unknown')).toBeUndefined();
      group.clear();
    });

    it('hasSignal() returns false for unknown names', () => {
      const group = SignalGroup.findOrCreate({});
      expect(group.hasSignal('unknown')).toBe(false);
      group.clear();
    });

    it('detachSignal() removes all associated names', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignalByName('name1', signal);
      group.attachSignalByName('name2', signal);

      expect(group.hasSignal('name1')).toBe(true);
      expect(group.hasSignal('name2')).toBe(true);

      group.detachSignal(signal);

      expect(group.hasSignal('name1')).toBe(false);
      expect(group.hasSignal('name2')).toBe(false);

      signal.destroy();
      group.clear();
    });

    it('multiple signals with the same name - last one wins', () => {
      const group = SignalGroup.findOrCreate({});
      const signal1 = createSignal(1);
      const signal2 = createSignal(2);

      group.attachSignalByName('mySignal', signal1);
      expect(group.signal('mySignal')).toBe(signal1);

      group.attachSignalByName('mySignal', signal2);
      expect(group.signal('mySignal')).toBe(signal2);

      group.clear();

      // signal1 was displaced by the rebind and left the group with it
      // (MEM-003) — it is still alive, so it is on us to destroy it.
      signal1.destroy();
    });

    it('detaching signal reverts to previous signal with same name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal1 = createSignal(1);
      const signal2 = createSignal(2);

      // explicitly attached, so the rebind below keeps it around as a
      // fallback candidate for the name (MEM-003)
      group.attachSignal(signal1);

      group.attachSignalByName('mySignal', signal1);
      group.attachSignalByName('mySignal', signal2);

      expect(group.signal('mySignal')).toBe(signal2);

      group.detachSignal(signal2);

      expect(group.signal('mySignal')).toBe(signal1);

      signal2.destroy();
      group.clear();
    });

    it('supports symbol names', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);
      const sym = Symbol('test');

      group.attachSignalByName(sym, signal);

      expect(group.hasSignal(sym)).toBe(true);
      expect(group.signal(sym)).toBe(signal);

      group.clear();
    });
  });

  describe('nested groups', () => {
    it('attachGroup() creates a parent-child relationship', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});

      parent.attachGroup(child);

      // Child groups don't expose parent, but we can verify behavior
      expect(() => parent.attachGroup(child)).not.toThrow();

      parent.clear();
    });

    it('attachGroup() throws when trying to attach to itself', () => {
      const group = SignalGroup.findOrCreate({});

      expect(() => group.attachGroup(group)).toThrow(
        'Cannot attach a group to itself',
      );

      group.clear();
    });

    it('detachGroup() removes child group', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});

      parent.attachGroup(child);
      expect(getGroupMemberCounts(parent).groups, 'child is attached').toBe(1);

      parent.detachGroup(child);
      expect(getGroupMemberCounts(parent).groups, 'child is detached').toBe(0);

      // The parent has no hold left, so clearing it must not reach the child.
      const signal = createSignal(42);
      child.attachSignal(signal);

      parent.clear();
      assertSignalsCount(
        1,
        'the detached child was not cleared with its parent',
      );

      child.clear();
      assertSignalsCount(0, 'clearing the detached child destroys its signal');
    });

    it('detachGroup() does nothing when detaching self', () => {
      const group = SignalGroup.findOrCreate({});

      expect(() => group.detachGroup(group)).not.toThrow();

      group.clear();
    });

    it('child group is detached from previous parent when attached to new parent', () => {
      const parent1 = SignalGroup.findOrCreate({});
      const parent2 = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});

      parent1.attachGroup(child);
      parent2.attachGroup(child);

      // The child is now attached to parent2 only
      parent1.clear();

      // child should still exist since it's attached to parent2
      expect(SignalGroup.get(child)).toBe(child);

      parent2.clear();
    });

    it('hasSignal() checks parent groups', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      parent.attachSignalByName('parentSignal', signal);
      parent.attachGroup(child);

      expect(child.hasSignal('parentSignal')).toBe(true);

      parent.clear();
    });

    it('signal() retrieves from parent groups', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      parent.attachSignalByName('parentSignal', signal);
      parent.attachGroup(child);

      expect(child.signal('parentSignal')).toBe(signal);

      parent.clear();
    });

    it('child group signals are preferred over parent signals', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const parentSignal = createSignal(1);
      const childSignal = createSignal(2);

      parent.attachSignalByName('mySignal', parentSignal);
      child.attachSignalByName('mySignal', childSignal);
      parent.attachGroup(child);

      expect(child.signal('mySignal')).toBe(childSignal);

      parent.clear();
    });

    it('clear() destroys child groups', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      child.attachSignal(signal);
      parent.attachGroup(child);

      assertSignalsCount(1, 'signal attached to child');

      parent.clear();

      assertSignalsCount(0, 'signal destroyed when parent cleared');
    });
  });

  describe('effects', () => {
    it('attachEffect() adds an effect to the group', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(0);
      let count = 0;

      const effect = createEffect(() => {
        count = signal.get();
      });

      // Access the internal EffectImpl
      group.attachEffect(effect[$effect]);
      group.attachSignal(signal);

      expect(count).toBe(0);

      signal.set(1);
      expect(count).toBe(1);

      group.clear();
    });

    it('runEffects() runs all effects in the group', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(0);
      let count = 0;

      const effect = createEffect(
        () => {
          count = signal.get();
        },
        {autorun: false},
      );

      // Access the internal EffectImpl
      group.attachEffect(effect[$effect]);
      group.attachSignal(signal);

      expect(count).toBe(0);

      group.runEffects();
      expect(count).toBe(0);

      signal.set(5);
      expect(count).toBe(0);

      group.runEffects();
      expect(count).toBe(5);

      group.clear();
    });

    it('runEffects() runs effects in child groups', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const signal1 = createSignal(0);
      const signal2 = createSignal(0);
      let count1 = 0;
      let count2 = 0;

      const effect1 = createEffect(
        () => {
          count1 = signal1.get();
        },
        {autorun: false},
      );

      const effect2 = createEffect(
        () => {
          count2 = signal2.get();
        },
        {autorun: false},
      );

      // Access the internal EffectImpl
      parent.attachEffect(effect1[$effect]);
      child.attachEffect(effect2[$effect]);
      parent.attachGroup(child);
      parent.attachSignal(signal1);
      child.attachSignal(signal2);

      signal1.set(10);
      signal2.set(20);

      parent.runEffects();

      expect(count1).toBe(10);
      expect(count2).toBe(20);

      parent.clear();
    });

    it('clear() destroys attached effects', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(0);

      const effect = createEffect(() => {
        signal.get();
      });

      // Access the internal EffectImpl
      group.attachEffect(effect[$effect]);
      group.attachSignal(signal);

      assertEffectsCount(1, 'effect attached');

      group.clear();

      assertEffectsCount(0, 'effect destroyed after clear');
    });
  });

  describe('links', () => {
    it('attachLink() adds a link to the group', () => {
      const group = SignalGroup.findOrCreate({});
      const source = createSignal(1);
      const target = createSignal(0);

      const signalLink = link(source, target);
      group.attachLink(signalLink);
      group.attachSignal(source);
      group.attachSignal(target);

      assertLinksCount(1, 'link attached');

      group.clear();
    });

    it('attachLink() throws when attaching a destroyed link', () => {
      const group = SignalGroup.findOrCreate({});
      const source = createSignal(1);
      const target = createSignal(0);

      const signalLink = link(source, target);
      signalLink.destroy();

      expect(() => group.attachLink(signalLink)).toThrow(
        'Cannot attach a destroyed link to a group',
      );

      source.destroy();
      target.destroy();
      group.clear();
    });

    describe('MEM-002: a destroyed link takes itself out of the group', () => {
      it('attachLink() alone is enough — the counter-edge does not depend on attach()', () => {
        const group = SignalGroup.findOrCreate({});
        const source = createSignal(1);
        const target = createSignal(0);

        const signalLink = link(source, target);
        group.attachLink(signalLink);

        expect(getGroupMemberCounts(group).links).toBe(1);

        signalLink.destroy();

        expect(getGroupMemberCounts(group).links).toBe(0);

        source.destroy();
        target.destroy();
        group.clear();
      });

      it('a throwing DESTROY listener registered before the attach cannot stop it', () => {
        const group = SignalGroup.findOrCreate({});
        const source = createSignal(1);
        const target = createSignal(0);

        const signalLink = link(source, target);

        // eventize aborts delivery at a throwing listener, so at normal
        // priority the registration order decided whether the group ever
        // heard about the destroy. The counter-edge runs at Priority.Max.
        once(signalLink, DESTROY, () => {
          throw new Error('boom');
        });

        group.attachLink(signalLink);

        expect(() => signalLink.destroy()).toThrow('boom');
        expect(getGroupMemberCounts(group).links).toBe(0);

        source.destroy();
        target.destroy();
        group.clear();
      });

      it('a throwing DESTROY listener below Priority.Max cannot swallow it either, however late it registers', () => {
        const group = SignalGroup.findOrCreate({});
        const source = createSignal(1);

        // Built directly instead of through `link()`: that function adds a
        // bookkeeping DESTROY listener of its own at normal priority, and
        // the high-priority thrower below would abort delivery before it,
        // leaving `getLinksCount()` stuck at 1. Pre-existing, unrelated to
        // what this test is about, and it would only mask it.
        const signalLink = new SignalLinkToCallback(source, () => {});
        group.attachLink(signalLink);

        // This pins the documented boundary. The counter-edge runs at
        // `Priority.Max` (`+Infinity`), so it outranks every finite
        // priority no matter when it was registered — registering the
        // thrower *after* the attach takes registration order out of the
        // picture and leaves the priority as the only thing deciding.
        // `MAX_SAFE_INTEGER` rather than `Priority.Critical`: any merely
        // large constant put in place of `Priority.Max` would still beat
        // `Critical`, so the test has to reach for the largest finite
        // priority there is to say "below Max" and mean it.
        expect(Number.MAX_SAFE_INTEGER).toBeLessThan(Priority.Max);
        once(signalLink, DESTROY, Number.MAX_SAFE_INTEGER, () => {
          throw new Error('boom');
        });

        expect(() => signalLink.destroy()).toThrow('boom');
        expect(getGroupMemberCounts(group).links).toBe(0);

        source.destroy();
        group.clear();
      });
    });

    it('detachLink() removes a link from the group but does not destroy it', () => {
      const group = SignalGroup.findOrCreate({});
      const source = createSignal(1);
      const target = createSignal(0);

      const signalLink = link(source, target);
      group.attachLink(signalLink);

      assertLinksCount(1, 'link attached');

      group.detachLink(signalLink);

      assertLinksCount(1, 'link still exists after detach');

      signalLink.destroy();
      source.destroy();
      target.destroy();
      group.clear();
    });

    it('clear() destroys attached links', () => {
      const group = SignalGroup.findOrCreate({});
      const source = createSignal(1);
      const target = createSignal(0);

      const signalLink = link(source, target);
      group.attachLink(signalLink);
      group.attachSignal(source);
      group.attachSignal(target);

      assertLinksCount(1, 'link attached');

      group.clear();

      assertLinksCount(0, 'link destroyed after clear');
    });
  });

  describe('clear() and destroy()', () => {
    it('clear() emits DESTROY event', () => {
      const group = SignalGroup.findOrCreate({});
      const destroyCallback = vi.fn();

      // Using eventize's on method
      on(group, 'destroy', destroyCallback);

      group.clear();

      expect(destroyCallback).toHaveBeenCalledWith(group);
    });

    it('clear() detaches from parent group', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});

      parent.attachGroup(child);
      expect(getGroupMemberCounts(parent).groups, 'child is attached').toBe(1);

      child.clear();

      expect(
        getGroupMemberCounts(parent).groups,
        'clear() must take the child out of its parent',
      ).toBe(0);
      expect(getGroupMemberCounts(child)).toEqual(NO_GROUP_MEMBERS);

      parent.clear();
    });

    it('destroy() is deprecated but works', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignal(signal);

      assertSignalsCount(1, 'signal attached');

      group.destroy();

      expect(warnSpy).toHaveBeenCalledWith(
        'SignalGroup#destroy is deprecated. Use SignalGroup#clear instead.',
      );

      assertSignalsCount(0, 'signal destroyed');

      warnSpy.mockRestore();
    });

    it('clear() removes group from store', () => {
      const obj = {};
      const group = SignalGroup.findOrCreate(obj);

      expect(SignalGroup.get(obj)).toBe(group);

      group.clear();

      expect(SignalGroup.get(obj)).toBeUndefined();
    });
  });

  describe('complex scenarios', () => {
    it('handles multiple signals, effects, and links together', () => {
      const group = SignalGroup.findOrCreate({});

      const signal1 = createSignal(1);
      const signal2 = createSignal(2);
      const signal3 = createSignal(0);

      let effectResult = 0;
      const effect = createEffect(() => {
        effectResult = signal1.get() + signal2.get();
      });

      const signalLink = link(signal1, signal3);

      group.attachSignal(signal1);
      group.attachSignal(signal2);
      group.attachSignal(signal3);
      group.attachEffect(effect[$effect]);
      group.attachLink(signalLink);

      assertSignalsCount(3, 'all signals attached');
      assertEffectsCount(1, 'effect attached');
      assertLinksCount(1, 'link attached');

      expect(effectResult).toBe(3);
      expect(signal3.get()).toBe(1);

      signal1.set(10);

      expect(effectResult).toBe(12);
      expect(signal3.get()).toBe(10);

      group.clear();

      assertSignalsCount(0, 'all signals destroyed');
      assertEffectsCount(0, 'effect destroyed');
      assertLinksCount(0, 'link destroyed');
    });

    it('handles deeply nested group hierarchy', () => {
      const root = SignalGroup.findOrCreate({});
      const level1 = SignalGroup.findOrCreate({});
      const level2 = SignalGroup.findOrCreate({});

      const signal = createSignal(42);

      root.attachSignalByName('rootSignal', signal);
      root.attachGroup(level1);
      level1.attachGroup(level2);

      expect(level2.hasSignal('rootSignal')).toBe(true);
      expect(level2.signal('rootSignal')).toBe(signal);

      root.clear();

      assertSignalsCount(0, 'all cleaned up');
    });
  });

  describe('edge cases and additional code paths', () => {
    it('SignalGroup.findOrCreate() returns the same group when passed a SignalGroup', () => {
      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      const sameGroup = SignalGroup.findOrCreate(group);
      expect(sameGroup).toBe(group);
      group.clear();
    });

    it('SignalGroup.delete() does nothing for non-existent object', () => {
      const obj = {};
      // Should not throw when deleting a non-existent group
      expect(() => SignalGroup.delete(obj)).not.toThrow();
    });

    it('attachSignal() returns the signal even when signal is null/undefined', () => {
      const group = SignalGroup.findOrCreate({});
      const result1 = group.attachSignal(null as any);
      const result2 = group.attachSignal(undefined as any);
      expect(result1).toBeNull();
      expect(result2).toBeUndefined();
      group.clear();
    });

    it('detachSignal() handles signal without named keys', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      // Attach without name
      group.attachSignal(signal);
      assertSignalsCount(1, 'signal attached');

      // Detach - should work without named keys
      group.detachSignal(signal);
      assertSignalsCount(1, 'signal still exists after detach');

      signal.destroy();
      group.clear();
    });

    it('detachSignal() handles null/undefined', () => {
      const group = SignalGroup.findOrCreate({});
      // Should not throw
      expect(() => group.detachSignal(null as any)).not.toThrow();
      expect(() => group.detachSignal(undefined as any)).not.toThrow();
      group.clear();
    });

    it('attachSignalByName() allows same signal with multiple names', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignalByName('name1', signal);
      group.attachSignalByName('name2', signal);

      expect(group.hasSignal('name1')).toBe(true);
      expect(group.hasSignal('name2')).toBe(true);
      expect(group.signal('name1')).toBe(signal);
      expect(group.signal('name2')).toBe(signal);

      group.clear();
    });

    it('detachSignal() removes all names when signal has multiple names', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignalByName('name1', signal);
      group.attachSignalByName('name2', signal);

      group.detachSignal(signal);

      expect(group.hasSignal('name1')).toBe(false);
      expect(group.hasSignal('name2')).toBe(false);

      signal.destroy();
      group.clear();
    });

    it('detachSignal() reverts to previous signal when detaching non-active signal with same name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal1 = createSignal(1);
      const signal2 = createSignal(2);
      const signal3 = createSignal(3);

      // Attach three signals with the same name. signal1 and signal2 are
      // additionally attached explicitly, so a rebind does not drop them from
      // the group (MEM-003) and they stay fallback candidates.
      group.attachSignal(signal1);
      group.attachSignal(signal2);

      group.attachSignalByName('mySignal', signal1);
      group.attachSignalByName('mySignal', signal2);
      group.attachSignalByName('mySignal', signal3);

      // signal3 should be the active one
      expect(group.signal('mySignal')).toBe(signal3);

      // Detach signal1 (not the active one)
      group.detachSignal(signal1);

      // signal3 should still be active since we didn't detach it
      expect(group.signal('mySignal')).toBe(signal3);
      expect(group.hasSignal('mySignal')).toBe(true);

      // Detach signal3 (the active one)
      group.detachSignal(signal3);

      // signal2 should now be active
      expect(group.signal('mySignal')).toBe(signal2);

      signal1.destroy();
      signal3.destroy();
      group.clear();
    });

    it('attachSignalByName() is idempotent for the same (name, signal) pair', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(1);

      // Binding the same (name, signal) pair again is idempotent — the
      // bookkeeping behind a name is a Set keyed by signal — so however often
      // the pair was bound, one detachSignal() has to remove the name for
      // good, with no fallback candidate left over.
      for (let i = 0; i < 100; i++) {
        group.attachSignalByName('mySignal', signal);
      }

      expect(group.signal('mySignal')).toBe(signal);

      group.detachSignal(signal);

      expect(group.hasSignal('mySignal')).toBe(false);
      expect(group.signal('mySignal')).toBeUndefined();

      signal.destroy();
      group.clear();
    });

    it('detachGroup() does nothing when group is not a child', () => {
      const parent = SignalGroup.findOrCreate({});
      const notChild = SignalGroup.findOrCreate({});

      // notChild was never attached to parent
      expect(() => parent.detachGroup(notChild)).not.toThrow();

      parent.clear();
      notChild.clear();
    });

    it('attachLink() handles null/undefined gracefully', () => {
      const group = SignalGroup.findOrCreate({});
      // Should not throw but also not add anything
      const result1 = group.attachLink(null as any);
      const result2 = group.attachLink(undefined as any);
      expect(result1).toBeNull();
      expect(result2).toBeUndefined();
      group.clear();
    });

    it('detachLink() handles null/undefined gracefully', () => {
      const group = SignalGroup.findOrCreate({});
      // Should not throw
      expect(() => group.detachLink(null as any)).not.toThrow();
      expect(() => group.detachLink(undefined as any)).not.toThrow();
      group.clear();
    });

    it('runEffects() runs all attached effects in order', () => {
      const group = SignalGroup.findOrCreate({});
      const results: number[] = [];

      const signal1 = createSignal(1);
      const signal2 = createSignal(2);

      const effect1 = createEffect(
        () => {
          results.push(signal1.get());
        },
        {autorun: false},
      );

      const effect2 = createEffect(
        () => {
          results.push(signal2.get());
        },
        {autorun: false},
      );

      group.attachEffect(effect1[$effect]);
      group.attachEffect(effect2[$effect]);
      group.attachSignal(signal1);
      group.attachSignal(signal2);

      // Run all effects
      group.runEffects();

      expect(results).toEqual([1, 2]);

      group.clear();
    });

    it('clear() properly detaches from parent before clearing store', () => {
      const parent = SignalGroup.findOrCreate({});
      const childObj = {};
      const child = SignalGroup.findOrCreate(childObj);
      const signal = createSignal(42);

      child.attachSignal(signal);
      parent.attachGroup(child);

      // Clear child - should detach from parent and remove from store
      child.clear();

      expect(SignalGroup.get(childObj)).toBeUndefined();

      // Parent should still exist
      expect(SignalGroup.get(parent)).toBe(parent);

      parent.clear();
    });

    it('attachSignalByName() with existing name but no other signals removes the name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignalByName('mySignal', signal);
      expect(group.hasSignal('mySignal')).toBe(true);

      // Detach the only signal with this name
      group.detachSignal(signal);

      // Name should be removed since there are no other signals
      expect(group.hasSignal('mySignal')).toBe(false);
      expect(group.signal('mySignal')).toBeUndefined();

      signal.destroy();
      group.clear();
    });

    it('signal() returns undefined for unknown name even with parent', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      parent.attachGroup(child);

      expect(child.signal('unknownSignal')).toBeUndefined();

      parent.clear();
    });

    it('clear() properly clears child groups', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      child.attachSignal(signal);
      parent.attachGroup(child);

      assertSignalsCount(1, 'signal attached to child');

      // Clear parent - this should clear child groups too
      parent.clear();

      assertSignalsCount(0, 'signal destroyed when parent cleared');
    });

    it('attachSignal() with same signal multiple times only adds once', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignal(signal);
      group.attachSignal(signal);
      group.attachSignal(signal);

      // Signal should only be in the set once
      assertSignalsCount(1, 'only one signal');

      group.clear();
    });

    it('attachGroup() properly re-parents a group', () => {
      const parent1 = SignalGroup.findOrCreate({});
      const parent2 = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      child.attachSignalByName('childSignal', signal);

      // Attach to first parent
      parent1.attachGroup(child);

      // Verify child can access itself
      expect(child.hasSignal('childSignal')).toBe(true);

      // Re-parent to second parent
      parent2.attachGroup(child);

      // Clearing parent1 should NOT affect child since it was re-parented
      parent1.clear();

      // Signal in child should still exist
      assertSignalsCount(1, 'signal still exists after clearing old parent');
      expect(child.signal('childSignal')).toBe(signal);

      parent2.clear();
    });

    it('detachSignal() with non-attached signal does nothing', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      // Never attached to the group
      expect(() => group.detachSignal(signal)).not.toThrow();

      signal.destroy();
      group.clear();
    });

    it('attachEffect() returns the effect', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(0);

      const effect = createEffect(
        () => {
          signal.get();
        },
        {autorun: false},
      );

      const result = group.attachEffect(effect[$effect]);
      expect(result).toBe(effect[$effect]);

      group.attachSignal(signal);
      group.clear();
    });

    it('handles createSignal with attach option', () => {
      const obj = {};
      createSignal(42, {attach: obj});

      assertSignalsCount(1, 'signal attached via option');

      const group = SignalGroup.get(obj);
      expect(group).toBeDefined();

      group!.clear();

      assertSignalsCount(0, 'signal destroyed with group');
    });
  });

  describe('cyclic group graphs (BUG-002)', () => {
    it('attachGroup() rejects a direct cycle', () => {
      const a = SignalGroup.findOrCreate({});
      const b = SignalGroup.findOrCreate({});

      a.attachGroup(b);

      expect(() => b.attachGroup(a)).toThrow(/cycle/i);

      // the rejected call must not have changed the graph
      const signal = createSignal(42);
      b.attachSignal(signal);

      expect(() => a.clear()).not.toThrow();

      assertSignalsCount(0, 'child group was cleared with its parent');
    });

    it('attachGroup() rejects a transitive cycle', () => {
      const a = SignalGroup.findOrCreate({});
      const b = SignalGroup.findOrCreate({});
      const c = SignalGroup.findOrCreate({});

      a.attachGroup(b);
      b.attachGroup(c);

      expect(() => c.attachGroup(a)).toThrow(/cycle/i);

      expect(() => a.clear()).not.toThrow();
    });

    it('attachGroup() walks a parent chain deeper than two links', () => {
      const root = SignalGroup.findOrCreate({});
      const a = SignalGroup.findOrCreate({});
      const b = SignalGroup.findOrCreate({});
      const c = SignalGroup.findOrCreate({});
      const unrelated = SignalGroup.findOrCreate({});

      root.attachGroup(a);
      a.attachGroup(b);
      b.attachGroup(c);

      // c → b → a → root: only from the third level up does the guard take its
      // second Floyd step at all.
      expect(() => c.attachGroup(root)).toThrow(
        'Cannot attach a group to one of its own descendants',
      );
      expect(
        getGroupMemberCounts(c).groups,
        'the rejected edge was not added',
      ).toBe(0);

      // Same depth, legal edge — the walk must run out at the root and let it through.
      expect(() => c.attachGroup(unrelated)).not.toThrow();
      expect(getGroupMemberCounts(c).groups).toBe(1);

      root.clear();
    });

    it('attachGroup() rejects an already cyclic parent chain instead of hanging', () => {
      const a = SignalGroup.findOrCreate({});
      const b = SignalGroup.findOrCreate({});
      const x = SignalGroup.findOrCreate({});
      const z = SignalGroup.findOrCreate({});

      a.attachGroup(x); // x → a
      b.attachGroup(a); // a → b

      // Break the forest invariant on purpose: the public API cannot produce
      // this state, attachGroup() rejects every edge that would close a cycle.
      // The Floyd guard exists for the case where it happens anyway.
      b[$setParentGroup](a); // a ↔ b

      try {
        expect(() => x.attachGroup(z)).toThrow(
          'Cannot attach a group: the parent chain of this group is already cyclic',
        );
        expect(
          getGroupMemberCounts(x).groups,
          'the rejected edge was not added',
        ).toBe(0);
      } finally {
        b[$setParentGroup](undefined);
      }

      b.clear();
      z.clear();
    });

    it('attachGroup() still allows re-parenting a group below a former sibling', () => {
      const root = SignalGroup.findOrCreate({});
      const a = SignalGroup.findOrCreate({});
      const b = SignalGroup.findOrCreate({});

      root.attachGroup(a);
      root.attachGroup(b);

      // b is not an ancestor of a — no cycle, must be allowed
      expect(() => b.attachGroup(a)).not.toThrow();

      root.clear();
    });

    it('clear() does not recurse when a DESTROY listener clears the same group', () => {
      const subscriptions = subscriptionSnapshot();

      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      const source = createSignal(42, {attach: obj});
      const target = createSignal(0, {attach: obj});

      createEffect(() => source.get(), {attach: obj});
      link(source, target, {attach: obj});

      on(group, DESTROY, () => {
        group.clear();
      });

      expect(() => group.clear()).not.toThrow();

      assertSignalsCount(0, 'group was fully cleared');
      assertEffectsCount(0, 'group was fully cleared');
      assertLinksCount(0, 'group was fully cleared');
      expect(subscriptionSnapshot()).toEqual(subscriptions);
    });

    it('off() does not recurse when an OFF listener calls off() again', () => {
      const subscriptions = subscriptionSnapshot();

      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      const source = createSignal(42, {attach: obj});
      const target = createSignal(0, {attach: obj});

      createEffect(() => source.get(), {attach: obj});
      link(source, target, {attach: obj});

      let offCount = 0;
      on(group, OFF, () => {
        offCount += 1;
        group.off();
      });

      expect(() => group.off()).not.toThrow();
      expect(offCount).toBe(1);

      assertEffectsCount(0, 'off() destroyed the attached effect');
      assertLinksCount(0, 'off() destroyed the attached link');
      assertSignalsCount(2, 'off() keeps the signals');

      group.clear();

      assertSignalsCount(0, 'clear() destroyed the signals');
      expect(subscriptionSnapshot()).toEqual(subscriptions);
    });
  });

  describe('named signal bookkeeping (MEM-003)', () => {
    it('rebinding a name destroys the signal it displaces', () => {
      const subscriptions = subscriptionSnapshot();

      const group = SignalGroup.findOrCreate({});
      const signals: ReturnType<typeof createSignal<number>>[] = [];

      for (let i = 0; i < 500; i++) {
        const signal = createSignal(i);
        signals.push(signal);
        group.attachSignalByName('slot', signal);
      }

      expect(group.signal('slot')).toBe(signals[499]);

      // The name was the group's only hold on each of them, so the 499
      // displaced ones are gone — not merely detached and left to rot.
      assertSignalsCount(1, 'only the currently bound signal is left');

      group.clear();

      assertSignalsCount(0, 'the last one goes with the group');
      expect(subscriptionSnapshot()).toEqual(subscriptions);
    });

    it('attachSignalByName(name, undefined) releases the signals held under that name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignalByName('slot', signal);
      group.attachSignalByName('slot');

      expect(group.hasSignal('slot')).toBe(false);
      assertSignalsCount(0, 'name gone, signal gone');

      group.clear();
    });

    it('attachSignalByName(name, undefined) keeps an explicitly attached signal', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignal(signal);
      group.attachSignalByName('slot', signal);

      group.attachSignalByName('slot');

      expect(group.hasSignal('slot')).toBe(false);
      assertSignalsCount(
        1,
        'the group still owns the signal, it just lost its name',
      );

      group.clear();

      assertSignalsCount(0, 'and destroys it on clear()');
    });

    it('attachSignalByName(name, undefined) leaves the other names of a signal alone', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      group.attachSignalByName('a', signal);
      group.attachSignalByName('b', signal);

      group.attachSignalByName('a');

      expect(group.hasSignal('a')).toBe(false);
      expect(group.signal('b')).toBe(signal);
      assertSignalsCount(1, 'still reachable under its other name');

      group.clear();

      assertSignalsCount(0, 'destroyed with the group');
    });

    it('a named memo recreated on every effect rerun does not pile up signals', () => {
      const subscriptions = subscriptionSnapshot();

      const obj = {};
      const trigger = createSignal(0);

      createEffect(
        () => {
          trigger.get();
          createMemo(() => 1, {attach: obj, name: 'memo'});
        },
        {attach: obj},
      );

      for (let i = 1; i <= 5; i++) {
        trigger.set(i);
      }

      // One memo signal per rerun, all bound to the same name: the previous
      // one is unreachable the moment the next one takes the name.
      assertSignalsCount(2, 'trigger plus the memo signal of the last run');

      SignalGroup.get(obj)!.clear();
      trigger.destroy();

      assertSignalsCount(0, 'nothing left behind');
      assertEffectsCount(0, 'nothing left behind');
      expect(subscriptionSnapshot()).toEqual(subscriptions);
    });

    it('a rebind keeps a signal that is also bound under another name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(1);
      const other = createSignal(2);

      group.attachSignalByName('a', signal);
      group.attachSignalByName('b', signal);

      group.attachSignalByName('a', other);

      expect(group.signal('a')).toBe(other);
      expect(group.signal('b')).toBe(signal);

      group.clear();

      assertSignalsCount(0, 'both signals are still owned by the group');
    });

    it('a rebind keeps a signal that was attached explicitly', () => {
      const group = SignalGroup.findOrCreate({});
      const signal1 = createSignal(1);
      const signal2 = createSignal(2);

      group.attachSignal(signal1);
      group.attachSignalByName('slot', signal1);
      group.attachSignalByName('slot', signal2);

      expect(group.signal('slot')).toBe(signal2);

      // explicitly attached signals stay group-owned and remain fallback
      // candidates for the name
      group.detachSignal(signal2);
      expect(group.signal('slot')).toBe(signal1);

      signal2.destroy();
      group.clear();

      assertSignalsCount(0, 'signal1 destroyed with the group');
    });
  });
});
