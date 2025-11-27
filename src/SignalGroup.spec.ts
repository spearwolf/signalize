import {on} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './assert-helpers.js';
import {$effect} from './constants.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {link} from './link.js';
import {SignalGroup} from './SignalGroup.js';

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
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
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
    });

    it('detaching signal reverts to previous signal with same name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal1 = createSignal(1);
      const signal2 = createSignal(2);

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
      parent.detachGroup(child);

      // After detach, child can be attached elsewhere
      const newParent = SignalGroup.findOrCreate({});
      newParent.attachGroup(child);

      parent.clear();
      newParent.clear();
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
      const destroyCallback = jest.fn();

      // Using eventize's on method
      on(group, 'destroy', destroyCallback);

      group.clear();

      expect(destroyCallback).toHaveBeenCalledWith(group);
    });

    it('clear() detaches from parent group', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});

      parent.attachGroup(child);
      child.clear();

      // After clearing, we can attach the child elsewhere
      const newParent = SignalGroup.findOrCreate({});
      newParent.attachGroup(child);

      parent.clear();
      newParent.clear();
    });

    it('destroy() is deprecated but works', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
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

      // Attach three signals with the same name
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

    it('clear() calls deprecated destroy() on child groups', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      child.attachSignal(signal);
      parent.attachGroup(child);

      // Clear parent - this calls destroy() on child (deprecated)
      parent.clear();

      // destroy() was called on child
      expect(warnSpy).toHaveBeenCalledWith(
        'SignalGroup#destroy is deprecated. Use SignalGroup#clear instead.',
      );

      warnSpy.mockRestore();
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
});
