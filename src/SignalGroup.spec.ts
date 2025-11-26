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
});
