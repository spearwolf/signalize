import {getSubscriptionCount, on, once, Priority} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
  getGroupMemberCounts,
  NO_GROUP_MEMBERS,
} from './__testing__/assert-helpers.js';
import {$effect, DESTROY, OFF} from './constants.js';
import {createMemo} from './create-memo.js';
import {createSignal} from './create-signal.js';
import {createEffect} from './effects.js';
import {
  globalDestroySignalQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './global-queues.js';
import {link} from './link.js';
import {
  $groupResources,
  $setParentGroup,
  SHARED_EMPTY_COLLECTIONS,
  SignalGroup,
} from './SignalGroup.js';
import {SignalLinkToCallback} from './SignalLink.js';
import {onSignalizeError} from './signalize-error.js';
import type {SignalizeErrorPayload} from './types.js';

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
      try {
        expect(SignalGroup.get(obj)).toBe(group);
      } finally {
        group.clear();
      }
    });

    it('SignalGroup.get() returns self when passed a SignalGroup', () => {
      const group = SignalGroup.findOrCreate({});
      try {
        expect(SignalGroup.get(group)).toBe(group);
      } finally {
        group.clear();
      }
    });

    it('SignalGroup.findOrCreate() creates a new group', () => {
      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      try {
        expect(group).toBeInstanceOf(SignalGroup);
        expect(SignalGroup.get(obj)).toBe(group);
      } finally {
        group.clear();
      }
    });

    it('SignalGroup.findOrCreate() returns existing group', () => {
      const obj = {};
      const group1 = SignalGroup.findOrCreate(obj);
      const group2 = SignalGroup.findOrCreate(obj);
      try {
        expect(group1).toBe(group2);
      } finally {
        group1.clear();
      }
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
      try {
        group.attachSignal(signal);

        assertSignalsCount(1, 'after attach');

        SignalGroup.delete(obj);

        assertSignalsCount(0, 'after delete');
        expect(SignalGroup.get(obj)).toBeUndefined();
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('SignalGroup.delete() takes the group itself, like get() and findOrCreate()', () => {
      const host = {};
      const group = SignalGroup.findOrCreate(host);
      const signal = createSignal(1);
      const effect = createEffect(() => {}, {attach: host});
      try {
        group.attachSignal(signal);

        assertSignalsCount(1, 'after attach');
        assertEffectsCount(1, 'after attach');

        SignalGroup.delete(group);

        assertSignalsCount(0, 'the attached signal is destroyed');
        assertEffectsCount(0, 'the attached effect is destroyed');
        expect(
          getGroupMemberCounts(group),
          'the group let go of every member',
        ).toEqual(NO_GROUP_MEMBERS);
        expect(
          SignalGroup.get(host),
          'and the store entry under the host went with it',
        ).toBeUndefined();
      } finally {
        signal.destroy();
        effect.destroy();
        group.clear();
      }
    });

    it('SignalGroup.clear() removes all groups', () => {
      const obj1 = {};
      const obj2 = {};
      const group1 = SignalGroup.findOrCreate(obj1);
      const group2 = SignalGroup.findOrCreate(obj2);

      const signal1 = createSignal(1);
      const signal2 = createSignal(2);

      try {
        group1.attachSignal(signal1);
        group2.attachSignal(signal2);

        assertSignalsCount(2, 'after attaching signals');

        SignalGroup.clear();

        assertSignalsCount(0, 'after clear');
        expect(SignalGroup.get(obj1)).toBeUndefined();
        expect(SignalGroup.get(obj2)).toBeUndefined();
      } finally {
        signal1.destroy();
        signal2.destroy();
        group1.clear();
        group2.clear();
      }
    });

    it('SignalGroup.destroy() is deprecated but works', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      const signal = createSignal(1);
      try {
        group.attachSignal(signal);

        assertSignalsCount(1, 'after attach');

        SignalGroup.destroy(obj);

        expect(warnSpy).toHaveBeenCalledWith(
          '[signalize] SignalGroup.destroy(obj) is deprecated. Use SignalGroup.delete(obj) instead.',
        );

        assertSignalsCount(0, 'after destroy');
        expect(SignalGroup.get(obj)).toBeUndefined();
      } finally {
        warnSpy.mockRestore();
        signal.destroy();
        group.clear();
      }
    });

    it('reports the deprecation once per process, not once per call', () => {
      // Zero, not one — and that is the whole assertion. The witness right
      // above already spent this call site's single notice, and the gate in
      // `deprecation-warnings.ts` is module-scoped, so nothing is left for
      // these two calls — the once-per-call-site gate is what keeps it at one.
      // Same shape as `create-signal.deprecation.spec.ts`'s second test.
      const seen: SignalizeErrorPayload[] = [];
      const unsubscribe = onSignalizeError((payload) => {
        seen.push(payload);
      });
      const obj = {};
      SignalGroup.findOrCreate(obj);

      try {
        SignalGroup.destroy(obj);
        SignalGroup.destroy(obj);

        expect(seen).toHaveLength(0);
      } finally {
        unsubscribe();
        SignalGroup.delete(obj);
      }
    });
  });

  describe('signal management', () => {
    it('attachSignal() adds a signal to the group', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        group.attachSignal(signal);

        assertSignalsCount(1, 'signal attached');
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('attachSignal() throws when attaching a destroyed signal', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);
      signal.destroy();

      try {
        expect(() => group.attachSignal(signal)).toThrow(
          'Cannot attach a destroyed signal to a group',
        );
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('detachSignal() removes a signal from the group but does not destroy it', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        group.attachSignal(signal);
        assertSignalsCount(1, 'signal attached');

        group.detachSignal(signal);
        assertSignalsCount(1, 'signal still exists after detach');
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('clear() destroys attached signals', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        group.attachSignal(signal);
        assertSignalsCount(1, 'signal attached');

        group.clear();
        assertSignalsCount(0, 'signal destroyed after clear');
      } finally {
        signal.destroy();
        group.clear();
      }
    });
  });

  describe('named signals', () => {
    it('attachSignalByName() associates a signal with a name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        group.attachSignalByName('mySignal', signal);

        expect(group.hasSignal('mySignal')).toBe(true);
        expect(group.signal('mySignal')).toBe(signal);
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('attachSignalByName() without signal removes the name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        group.attachSignalByName('mySignal', signal);
        expect(group.hasSignal('mySignal')).toBe(true);

        group.attachSignalByName('mySignal');
        expect(group.hasSignal('mySignal')).toBe(false);
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('signal() returns undefined for unknown names', () => {
      const group = SignalGroup.findOrCreate({});
      try {
        expect(group.signal('unknown')).toBeUndefined();
      } finally {
        group.clear();
      }
    });

    it('hasSignal() returns false for unknown names', () => {
      const group = SignalGroup.findOrCreate({});
      try {
        expect(group.hasSignal('unknown')).toBe(false);
      } finally {
        group.clear();
      }
    });

    it('detachSignal() removes all associated names', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        group.attachSignalByName('name1', signal);
        group.attachSignalByName('name2', signal);

        expect(group.hasSignal('name1')).toBe(true);
        expect(group.hasSignal('name2')).toBe(true);

        group.detachSignal(signal);

        expect(group.hasSignal('name1')).toBe(false);
        expect(group.hasSignal('name2')).toBe(false);
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('multiple signals with the same name - last one wins', () => {
      const group = SignalGroup.findOrCreate({});
      const signal1 = createSignal(1);
      const signal2 = createSignal(2);

      try {
        group.attachSignalByName('mySignal', signal1);
        expect(group.signal('mySignal')).toBe(signal1);

        group.attachSignalByName('mySignal', signal2);
        expect(group.signal('mySignal')).toBe(signal2);
      } finally {
        // signal1 was displaced by the rebind and left the group with it
        // — it is still alive, so it is on us to destroy it.
        signal1.destroy();
        signal2.destroy();
        group.clear();
      }
    });

    it('detaching signal reverts to previous signal with same name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal1 = createSignal(1);
      const signal2 = createSignal(2);

      try {
        // explicitly attached, so the rebind below keeps it around as a
        // fallback candidate for the name
        group.attachSignal(signal1);

        group.attachSignalByName('mySignal', signal1);
        group.attachSignalByName('mySignal', signal2);

        expect(group.signal('mySignal')).toBe(signal2);

        group.detachSignal(signal2);

        expect(group.signal('mySignal')).toBe(signal1);
      } finally {
        signal1.destroy();
        signal2.destroy();
        group.clear();
      }
    });

    it('supports symbol names', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);
      const sym = Symbol('test');

      try {
        group.attachSignalByName(sym, signal);

        expect(group.hasSignal(sym)).toBe(true);
        expect(group.signal(sym)).toBe(signal);
      } finally {
        signal.destroy();
        group.clear();
      }
    });
  });

  describe('nested groups', () => {
    it('attachGroup() creates a parent-child relationship', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});

      try {
        parent.attachGroup(child);

        // Child groups don't expose parent, but we can verify behavior
        expect(() => parent.attachGroup(child)).not.toThrow();
      } finally {
        parent.clear();
        child.clear();
      }
    });

    it('attachGroup() throws when trying to attach to itself', () => {
      const group = SignalGroup.findOrCreate({});

      try {
        expect(() => group.attachGroup(group)).toThrow(
          'Cannot attach a group to itself',
        );
      } finally {
        group.clear();
      }
    });

    it('detachGroup() removes child group', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        parent.attachGroup(child);
        expect(getGroupMemberCounts(parent).groups, 'child is attached').toBe(
          1,
        );

        parent.detachGroup(child);
        expect(getGroupMemberCounts(parent).groups, 'child is detached').toBe(
          0,
        );

        // The parent has no hold left, so clearing it must not reach the child.
        child.attachSignal(signal);

        parent.clear();
        assertSignalsCount(
          1,
          'the detached child was not cleared with its parent',
        );

        child.clear();
        assertSignalsCount(
          0,
          'clearing the detached child destroys its signal',
        );
      } finally {
        signal.destroy();
        parent.clear();
        child.clear();
      }
    });

    it('detachGroup() does nothing when detaching self', () => {
      const group = SignalGroup.findOrCreate({});

      try {
        expect(() => group.detachGroup(group)).not.toThrow();
      } finally {
        group.clear();
      }
    });

    it('child group is detached from previous parent when attached to new parent', () => {
      const parent1 = SignalGroup.findOrCreate({});
      const parent2 = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});

      try {
        parent1.attachGroup(child);
        parent2.attachGroup(child);

        // The child is now attached to parent2 only
        parent1.clear();

        // child should still exist since it's attached to parent2
        expect(SignalGroup.get(child)).toBe(child);
      } finally {
        parent1.clear();
        parent2.clear();
        child.clear();
      }
    });

    it('hasSignal() checks parent groups', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        parent.attachSignalByName('parentSignal', signal);
        parent.attachGroup(child);

        expect(child.hasSignal('parentSignal')).toBe(true);
      } finally {
        signal.destroy();
        parent.clear();
        child.clear();
      }
    });

    it('signal() retrieves from parent groups', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        parent.attachSignalByName('parentSignal', signal);
        parent.attachGroup(child);

        expect(child.signal('parentSignal')).toBe(signal);
      } finally {
        signal.destroy();
        parent.clear();
        child.clear();
      }
    });

    it('child group signals are preferred over parent signals', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const parentSignal = createSignal(1);
      const childSignal = createSignal(2);

      try {
        parent.attachSignalByName('mySignal', parentSignal);
        child.attachSignalByName('mySignal', childSignal);
        parent.attachGroup(child);

        expect(child.signal('mySignal')).toBe(childSignal);
      } finally {
        parentSignal.destroy();
        childSignal.destroy();
        parent.clear();
        child.clear();
      }
    });

    it('clear() destroys child groups', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        child.attachSignal(signal);
        parent.attachGroup(child);

        assertSignalsCount(1, 'signal attached to child');

        parent.clear();

        assertSignalsCount(0, 'signal destroyed when parent cleared');
      } finally {
        signal.destroy();
        parent.clear();
        child.clear();
      }
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

      try {
        // Access the internal EffectImpl
        group.attachEffect(effect[$effect]);
        group.attachSignal(signal);

        expect(count).toBe(0);

        signal.set(1);
        expect(count).toBe(1);
      } finally {
        effect.destroy();
        signal.destroy();
        group.clear();
      }
    });

    it('attachEffect() called repeatedly adds no second DESTROY listener', () => {
      // The counterpart to the two `attachLink()` tests in `link.spec.ts`
      // (`re-attaching the same group on repeated cache hits …`, `no
      // combination of the two attach routes …`): eventize dedupes only
      // object and named-method listeners, so the plain function passed to
      // `once(effect, DESTROY, …)` is registered again on every call. The
      // guard in `attachEffect()` is the only thing keeping a repeated
      // attach of the same effect from growing that list without bound.
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(0);

      const effect = createEffect(() => {
        signal.get();
      });
      const effectImpl = effect[$effect];

      try {
        const subscriptionsBefore = getSubscriptionCount(effectImpl);

        group.attachEffect(effectImpl);
        group.attachEffect(effectImpl);
        group.attachEffect(effectImpl);

        expect(
          getSubscriptionCount(effectImpl) - subscriptionsBefore,
          'exactly one DESTROY listener for three attaches',
        ).toBe(1);

        expect(getGroupMemberCounts(group).effects).toBe(1);
      } finally {
        effect.destroy();
        signal.destroy();
        group.clear();
      }
    });

    it('attachEffect() takes the effect back out even when a DESTROY listener throws first', () => {
      // The counterpart to `attachLink()`'s hook, which has carried
      // `Priority.Max`. eventize ends the delivery at the
      // first throwing listener, so a bookkeeping hook on normal priority
      // is at the mercy of whoever subscribed before it: the group kept the
      // dead `EffectImpl` and its callback closure until the next
      // `clear()`. The group's own accounting comes before application
      // code.
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(0);

      const effect = createEffect(() => {
        signal.get();
      });
      const effectImpl = effect[$effect];

      try {
        group.attachEffect(effectImpl);
        expect(getGroupMemberCounts(group).effects).toBe(1);

        on(effectImpl, DESTROY, Priority.High, () => {
          throw new Error('listener boom');
        });

        expect(
          () => effect.destroy(),
          'the listener error still reaches the caller',
        ).toThrow('listener boom');

        assertEffectsCount(0, 'the effect itself is destroyed either way');

        expect(
          getGroupMemberCounts(group).effects,
          'the group let go of the dead effect, listener or no listener',
        ).toBe(0);
      } finally {
        effect.destroy();
        signal.destroy();
        group.clear();
      }
    });

    it('attachEffect() refuses a destroyed effect, like its two siblings', () => {
      // `#addSignal()` and `attachLink()` both reject a corpse; this one
      // took it and held it. A destroyed `EffectImpl` has emitted its
      // DESTROY and run `off(this)`, so the `once(effect, DESTROY, …)`
      // counter-hook below never fires again — the group would carry the
      // effect and its callback closure until `clear()`.
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(0);

      const effect = createEffect(() => {
        signal.get();
      });
      const effectImpl = effect[$effect];

      try {
        effect.destroy();
        assertEffectsCount(0, 'the effect is gone before the attach');

        expect(() => group.attachEffect(effectImpl)).toThrow(
          'Cannot attach a destroyed effect to a group',
        );

        expect(
          getGroupMemberCounts(group).effects,
          'the group did not take the corpse',
        ).toBe(0);
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('attachEffect() lets go of an attached wrapper when it is destroyed', () => {
      // The half no compiler sees: without the unwrapping, a wrapper pushed
      // in with `as any` is stored as-is and the DESTROY hook waits on an
      // object that never fires it — the group keeps the dead effect until
      // `clear()`, and this assertion reads 1.
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(0);

      const effect = createEffect(() => {
        signal.get();
      });

      try {
        group.attachEffect(effect);
        expect(getGroupMemberCounts(group).effects).toBe(1);

        effect.destroy();

        expect(
          getGroupMemberCounts(group).effects,
          'the wrapper took itself out, just like the impl does',
        ).toBe(0);
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('attachEffect() refuses a destroyed wrapper, like a destroyed impl', () => {
      // The other half: `Effect` has no `destroyed` getter, so an unwrapped
      // guard read `undefined` on a wrapper and waved the corpse through.
      // Now the method unwraps first and asks the instance.
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(0);

      const effect = createEffect(() => {
        signal.get();
      });

      try {
        effect.destroy();
        assertEffectsCount(0, 'the effect is gone before the attach');

        expect(() => group.attachEffect(effect)).toThrow(
          'Cannot attach a destroyed effect to a group',
        );

        expect(
          getGroupMemberCounts(group).effects,
          'the group did not take the corpse',
        ).toBe(0);
      } finally {
        signal.destroy();
        group.clear();
      }
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

      try {
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
      } finally {
        effect.destroy();
        signal.destroy();
        group.clear();
      }
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

      try {
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
      } finally {
        effect1.destroy();
        effect2.destroy();
        signal1.destroy();
        signal2.destroy();
        parent.clear();
        child.clear();
      }
    });

    it('clear() destroys attached effects', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(0);

      const effect = createEffect(() => {
        signal.get();
      });

      try {
        // Access the internal EffectImpl
        group.attachEffect(effect[$effect]);
        group.attachSignal(signal);

        assertEffectsCount(1, 'effect attached');

        group.clear();

        assertEffectsCount(0, 'effect destroyed after clear');
      } finally {
        effect.destroy();
        signal.destroy();
        group.clear();
      }
    });
  });

  describe('links', () => {
    it('attachLink() adds a link to the group', () => {
      const group = SignalGroup.findOrCreate({});
      const source = createSignal(1);
      const target = createSignal(0);

      const signalLink = link(source, target);
      try {
        group.attachLink(signalLink);
        group.attachSignal(source);
        group.attachSignal(target);

        assertLinksCount(1, 'link attached');
      } finally {
        signalLink.destroy();
        source.destroy();
        target.destroy();
        group.clear();
      }
    });

    it('attachLink() throws when attaching a destroyed link', () => {
      const group = SignalGroup.findOrCreate({});
      const source = createSignal(1);
      const target = createSignal(0);

      const signalLink = link(source, target);
      signalLink.destroy();

      try {
        expect(() => group.attachLink(signalLink)).toThrow(
          'Cannot attach a destroyed link to a group',
        );
      } finally {
        signalLink.destroy();
        source.destroy();
        target.destroy();
        group.clear();
      }
    });

    describe('A destroyed link takes itself out of the group', () => {
      it('attachLink() alone is enough — the counter-edge does not depend on attach()', () => {
        const group = SignalGroup.findOrCreate({});
        const source = createSignal(1);
        const target = createSignal(0);

        const signalLink = link(source, target);
        try {
          group.attachLink(signalLink);

          expect(getGroupMemberCounts(group).links).toBe(1);

          signalLink.destroy();

          expect(getGroupMemberCounts(group).links).toBe(0);
        } finally {
          signalLink.destroy();
          source.destroy();
          target.destroy();
          group.clear();
        }
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

        try {
          group.attachLink(signalLink);

          expect(() => signalLink.destroy()).toThrow('boom');
          expect(getGroupMemberCounts(group).links).toBe(0);
        } finally {
          // The DESTROY listener above throws on purpose. A failure before
          // the destroy below leaves it armed, and an unguarded teardown
          // here would replace the real error message.
          try {
            signalLink.destroy();
          } catch {
            /* ignore */
          }
          source.destroy();
          target.destroy();
          group.clear();
        }
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
        try {
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
        } finally {
          // Same as above: the thrower registered inside the try may still
          // be armed when we get here.
          try {
            signalLink.destroy();
          } catch {
            /* ignore */
          }
          source.destroy();
          group.clear();
        }
      });
    });

    it('detachLink() removes a link from the group but does not destroy it', () => {
      const group = SignalGroup.findOrCreate({});
      const source = createSignal(1);
      const target = createSignal(0);

      const signalLink = link(source, target);
      try {
        group.attachLink(signalLink);

        assertLinksCount(1, 'link attached');

        group.detachLink(signalLink);

        assertLinksCount(1, 'link still exists after detach');
      } finally {
        signalLink.destroy();
        source.destroy();
        target.destroy();
        group.clear();
      }
    });

    it('clear() destroys attached links', () => {
      const group = SignalGroup.findOrCreate({});
      const source = createSignal(1);
      const target = createSignal(0);

      const signalLink = link(source, target);
      try {
        group.attachLink(signalLink);
        group.attachSignal(source);
        group.attachSignal(target);

        assertLinksCount(1, 'link attached');

        group.clear();

        assertLinksCount(0, 'link destroyed after clear');
      } finally {
        signalLink.destroy();
        source.destroy();
        target.destroy();
        group.clear();
      }
    });
  });

  describe('clear() and destroy()', () => {
    it('clear() emits DESTROY event', () => {
      const group = SignalGroup.findOrCreate({});
      const destroyCallback = vi.fn();

      try {
        // Using eventize's on method
        on(group, 'destroy', destroyCallback);

        group.clear();

        expect(destroyCallback).toHaveBeenCalledWith(group);
      } finally {
        group.clear();
      }
    });

    it('clear() detaches from parent group', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});

      try {
        parent.attachGroup(child);
        expect(getGroupMemberCounts(parent).groups, 'child is attached').toBe(
          1,
        );

        child.clear();

        expect(
          getGroupMemberCounts(parent).groups,
          'clear() must take the child out of its parent',
        ).toBe(0);
        expect(getGroupMemberCounts(child)).toEqual(NO_GROUP_MEMBERS);
      } finally {
        parent.clear();
        child.clear();
      }
    });

    it('clear() on a group without a parent does not throw', () => {
      const group = SignalGroup.findOrCreate({});

      try {
        expect(() => group.clear()).not.toThrow();
      } finally {
        group.clear();
      }
    });

    it('destroy() is deprecated but works', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        group.attachSignal(signal);

        assertSignalsCount(1, 'signal attached');

        group.destroy();

        expect(warnSpy).toHaveBeenCalledWith(
          '[signalize] SignalGroup#destroy is deprecated. Use SignalGroup#clear instead.',
        );

        assertSignalsCount(0, 'signal destroyed');
      } finally {
        warnSpy.mockRestore();
        signal.destroy();
        group.clear();
      }
    });

    it('reports the deprecation once per process, not once per call', () => {
      // Zero, not one — see the sibling witness for the static
      // `SignalGroup.destroy(obj)`: the test above already spent this call
      // site's single notice — the once-per-call-site gate keeps it at one.
      const seen: SignalizeErrorPayload[] = [];
      const unsubscribe = onSignalizeError((payload) => {
        seen.push(payload);
      });
      const group = SignalGroup.findOrCreate({});

      try {
        group.destroy();
        group.destroy();

        expect(seen).toHaveLength(0);
      } finally {
        unsubscribe();
        group.clear();
      }
    });

    it('clear() removes group from store', () => {
      const obj = {};
      const group = SignalGroup.findOrCreate(obj);

      try {
        expect(SignalGroup.get(obj)).toBe(group);

        group.clear();

        expect(SignalGroup.get(obj)).toBeUndefined();
      } finally {
        group.clear();
      }
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

      try {
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
      } finally {
        signalLink.destroy();
        effect.destroy();
        signal1.destroy();
        signal2.destroy();
        signal3.destroy();
        group.clear();
      }
    });

    it('handles deeply nested group hierarchy', () => {
      const root = SignalGroup.findOrCreate({});
      const level1 = SignalGroup.findOrCreate({});
      const level2 = SignalGroup.findOrCreate({});

      const signal = createSignal(42);

      try {
        root.attachSignalByName('rootSignal', signal);
        root.attachGroup(level1);
        level1.attachGroup(level2);

        expect(level2.hasSignal('rootSignal')).toBe(true);
        expect(level2.signal('rootSignal')).toBe(signal);

        root.clear();

        assertSignalsCount(0, 'all cleaned up');
      } finally {
        signal.destroy();
        root.clear();
        level1.clear();
        level2.clear();
      }
    });
  });

  describe('edge cases and additional code paths', () => {
    it('SignalGroup.findOrCreate() returns the same group when passed a SignalGroup', () => {
      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      const sameGroup = SignalGroup.findOrCreate(group);
      try {
        expect(sameGroup).toBe(group);
      } finally {
        group.clear();
      }
    });

    it('SignalGroup.delete() does nothing for non-existent object', () => {
      const obj = {};
      // Should not throw when deleting a non-existent group
      expect(() => SignalGroup.delete(obj)).not.toThrow();
    });

    it('attachSignal() returns the signal even when signal is null/undefined', () => {
      const group = SignalGroup.findOrCreate({});
      try {
        const result1 = group.attachSignal(null as any);
        const result2 = group.attachSignal(undefined as any);
        expect(result1).toBeNull();
        expect(result2).toBeUndefined();
      } finally {
        group.clear();
      }
    });

    it('detachSignal() handles signal without named keys', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        // Attach without name
        group.attachSignal(signal);
        assertSignalsCount(1, 'signal attached');

        // Detach - should work without named keys
        group.detachSignal(signal);
        assertSignalsCount(1, 'signal still exists after detach');
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('detachSignal() handles null/undefined', () => {
      const group = SignalGroup.findOrCreate({});
      try {
        // Should not throw
        expect(() => group.detachSignal(null as any)).not.toThrow();
        expect(() => group.detachSignal(undefined as any)).not.toThrow();
      } finally {
        group.clear();
      }
    });

    it('attachSignalByName() allows same signal with multiple names', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        group.attachSignalByName('name1', signal);
        group.attachSignalByName('name2', signal);

        expect(group.hasSignal('name1')).toBe(true);
        expect(group.hasSignal('name2')).toBe(true);
        expect(group.signal('name1')).toBe(signal);
        expect(group.signal('name2')).toBe(signal);
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('detachSignal() removes all names when signal has multiple names', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        group.attachSignalByName('name1', signal);
        group.attachSignalByName('name2', signal);

        group.detachSignal(signal);

        expect(group.hasSignal('name1')).toBe(false);
        expect(group.hasSignal('name2')).toBe(false);
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('detachSignal() reverts to previous signal when detaching non-active signal with same name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal1 = createSignal(1);
      const signal2 = createSignal(2);
      const signal3 = createSignal(3);

      try {
        // Attach three signals with the same name. signal1 and signal2 are
        // additionally attached explicitly, so a rebind does not drop them from
        // the group and they stay fallback candidates.
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
      } finally {
        signal1.destroy();
        signal2.destroy();
        signal3.destroy();
        group.clear();
      }
    });

    it('detachSignal() hands the name to the most recently bound candidate, not the first', () => {
      // The neighbour above stops one candidate short: after its two
      // detaches exactly one signal is left under the name, and "the last
      // one" and "the first one" are then the same signal. With two
      // candidates left the rule becomes visible — and it is the rule that
      // decides what `group.signal(name)` returns after a detach.
      const group = SignalGroup.findOrCreate({});
      const first = createSignal(1);
      const second = createSignal(2);
      const active = createSignal(3);

      try {
        // Explicitly attached, so the rebind does not destroy them and they
        // stay fallback candidates.
        group.attachSignal(first);
        group.attachSignal(second);

        group.attachSignalByName('slot', first);
        group.attachSignalByName('slot', second);
        group.attachSignalByName('slot', active);

        expect(group.signal('slot')).toBe(active);

        group.detachSignal(active);

        expect(
          group.signal('slot'),
          'the youngest remaining candidate takes the slot',
        ).toBe(second);

        group.detachSignal(second);

        expect(group.signal('slot'), 'and the next one after that').toBe(first);
      } finally {
        first.destroy();
        second.destroy();
        active.destroy();
        group.clear();
      }
    });

    it('attachSignalByName() is idempotent for the same (name, signal) pair', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(1);

      try {
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
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('detachGroup() does nothing when group is not a child', () => {
      const parent = SignalGroup.findOrCreate({});
      const notChild = SignalGroup.findOrCreate({});

      try {
        // notChild was never attached to parent
        expect(() => parent.detachGroup(notChild)).not.toThrow();
      } finally {
        parent.clear();
        notChild.clear();
      }
    });

    it('attachLink() handles null/undefined gracefully', () => {
      const group = SignalGroup.findOrCreate({});
      try {
        // Should not throw but also not add anything
        const result1 = group.attachLink(null as any);
        const result2 = group.attachLink(undefined as any);
        expect(result1).toBeNull();
        expect(result2).toBeUndefined();
      } finally {
        group.clear();
      }
    });

    it('detachLink() handles null/undefined gracefully', () => {
      const group = SignalGroup.findOrCreate({});
      try {
        // Should not throw
        expect(() => group.detachLink(null as any)).not.toThrow();
        expect(() => group.detachLink(undefined as any)).not.toThrow();
      } finally {
        group.clear();
      }
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

      try {
        group.attachEffect(effect1[$effect]);
        group.attachEffect(effect2[$effect]);
        group.attachSignal(signal1);
        group.attachSignal(signal2);

        // Run all effects
        group.runEffects();

        expect(results).toEqual([1, 2]);
      } finally {
        effect1.destroy();
        effect2.destroy();
        signal1.destroy();
        signal2.destroy();
        group.clear();
      }
    });

    it('clear() properly detaches from parent before clearing store', () => {
      const parent = SignalGroup.findOrCreate({});
      const childObj = {};
      const child = SignalGroup.findOrCreate(childObj);
      const signal = createSignal(42);

      try {
        child.attachSignal(signal);
        parent.attachGroup(child);

        // Clear child - should detach from parent and remove from store
        child.clear();

        expect(SignalGroup.get(childObj)).toBeUndefined();

        // Parent should still exist
        expect(SignalGroup.get(parent)).toBe(parent);
      } finally {
        signal.destroy();
        parent.clear();
        child.clear();
      }
    });

    it('attachSignalByName() with existing name but no other signals removes the name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        group.attachSignalByName('mySignal', signal);
        expect(group.hasSignal('mySignal')).toBe(true);

        // Detach the only signal with this name
        group.detachSignal(signal);

        // Name should be removed since there are no other signals
        expect(group.hasSignal('mySignal')).toBe(false);
        expect(group.signal('mySignal')).toBeUndefined();
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('signal() returns undefined for unknown name even with parent', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      try {
        parent.attachGroup(child);

        expect(child.signal('unknownSignal')).toBeUndefined();
      } finally {
        parent.clear();
        child.clear();
      }
    });

    it('clear() properly clears child groups', () => {
      const parent = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        child.attachSignal(signal);
        parent.attachGroup(child);

        assertSignalsCount(1, 'signal attached to child');

        // Clear parent - this should clear child groups too
        parent.clear();

        assertSignalsCount(0, 'signal destroyed when parent cleared');
      } finally {
        signal.destroy();
        parent.clear();
        child.clear();
      }
    });

    it('attachSignal() with same signal multiple times only adds once', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        group.attachSignal(signal);
        group.attachSignal(signal);
        group.attachSignal(signal);

        // Signal should only be in the set once
        assertSignalsCount(1, 'only one signal');
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('attachGroup() properly re-parents a group', () => {
      const parent1 = SignalGroup.findOrCreate({});
      const parent2 = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
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
      } finally {
        signal.destroy();
        parent1.clear();
        parent2.clear();
        child.clear();
      }
    });

    it('detachSignal() with non-attached signal does nothing', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        // Never attached to the group
        expect(() => group.detachSignal(signal)).not.toThrow();
      } finally {
        signal.destroy();
        group.clear();
      }
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

      try {
        const result = group.attachEffect(effect[$effect]);
        expect(result).toBe(effect[$effect]);

        group.attachSignal(signal);

        // The effect the group just took must not survive its teardown, and
        // this line is where that is promised rather than left to the
        // `afterEach` counter: drop the effect loop from
        // `SignalGroup#clear()` and this line goes red, not the rest of the
        // file.
        group.clear();
        assertEffectsCount(0, 'clear() destroyed the attached effect');
      } finally {
        effect.destroy();
        signal.destroy();
        group.clear();
      }
    });

    it('handles createSignal with attach option', () => {
      const obj = {};
      const signal = createSignal(42, {attach: obj});

      try {
        assertSignalsCount(1, 'signal attached via option');

        const group = SignalGroup.get(obj);
        expect(group).toBeDefined();

        group!.clear();

        assertSignalsCount(0, 'signal destroyed with group');
      } finally {
        signal.destroy();
        SignalGroup.get(obj)?.clear();
      }
    });
  });

  describe('cyclic group graphs', () => {
    it('attachGroup() rejects a direct cycle', () => {
      const a = SignalGroup.findOrCreate({});
      const b = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        a.attachGroup(b);

        expect(() => b.attachGroup(a)).toThrow(/cycle/i);

        // the rejected call must not have changed the graph
        b.attachSignal(signal);

        expect(() => a.clear()).not.toThrow();

        assertSignalsCount(0, 'child group was cleared with its parent');
      } finally {
        signal.destroy();
        a.clear();
        b.clear();
      }
    });

    it('attachGroup() rejects a transitive cycle', () => {
      const a = SignalGroup.findOrCreate({});
      const b = SignalGroup.findOrCreate({});
      const c = SignalGroup.findOrCreate({});

      try {
        a.attachGroup(b);
        b.attachGroup(c);

        expect(() => c.attachGroup(a)).toThrow(/cycle/i);

        expect(() => a.clear()).not.toThrow();
      } finally {
        a.clear();
        b.clear();
        c.clear();
      }
    });

    it('attachGroup() walks a parent chain deeper than two links', () => {
      const root = SignalGroup.findOrCreate({});
      const a = SignalGroup.findOrCreate({});
      const b = SignalGroup.findOrCreate({});
      const c = SignalGroup.findOrCreate({});
      const unrelated = SignalGroup.findOrCreate({});

      try {
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
      } finally {
        root.clear();
        a.clear();
        b.clear();
        c.clear();
        unrelated.clear();
      }
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
        // The forest invariant goes back before anything is cleared, so the
        // teardown below runs against a graph the public API could produce.
        b[$setParentGroup](undefined);
        b.clear();
        a.clear();
        x.clear();
        z.clear();
      }
    });

    it('attachGroup() still allows re-parenting a group below a former sibling', () => {
      const root = SignalGroup.findOrCreate({});
      const a = SignalGroup.findOrCreate({});
      const b = SignalGroup.findOrCreate({});

      try {
        root.attachGroup(a);
        root.attachGroup(b);

        // b is not an ancestor of a — no cycle, must be allowed
        expect(() => b.attachGroup(a)).not.toThrow();
      } finally {
        root.clear();
        a.clear();
        b.clear();
      }
    });

    it('clear() does not recurse when a DESTROY listener clears the same group', () => {
      const subscriptions = subscriptionSnapshot();

      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      const source = createSignal(42, {attach: obj});
      const target = createSignal(0, {attach: obj});

      createEffect(() => source.get(), {attach: obj});
      link(source, target, {attach: obj});

      try {
        on(group, DESTROY, () => {
          group.clear();
        });

        expect(() => group.clear()).not.toThrow();

        assertSignalsCount(0, 'group was fully cleared');
        assertEffectsCount(0, 'group was fully cleared');
        assertLinksCount(0, 'group was fully cleared');
        expect(subscriptionSnapshot()).toEqual(subscriptions);
      } finally {
        group.clear();
        source.destroy();
        target.destroy();
      }
    });

    it('off() does not recurse when an OFF listener calls off() again', () => {
      const subscriptions = subscriptionSnapshot();

      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      const source = createSignal(42, {attach: obj});
      const target = createSignal(0, {attach: obj});

      createEffect(() => source.get(), {attach: obj});
      link(source, target, {attach: obj});

      try {
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
      } finally {
        group.clear();
        source.destroy();
        target.destroy();
      }
    });

    it('hasSignal() answers instead of hanging when the parent chain is cyclic', () => {
      const a = SignalGroup.findOrCreate({});
      const b = SignalGroup.findOrCreate({});
      const inB = createSignal(1);

      b.attachSignalByName('inB', inB);

      // Break the forest invariant on purpose, exactly as the Floyd test
      // above does: `attachGroup()` rejects every edge that would close a
      // cycle, so this is the only way to reach the guard.
      b.attachGroup(a); // a → b
      b[$setParentGroup](a); // a ↔ b

      try {
        expect(
          () => a.hasSignal('nobody'),
          'the walk ends instead of running until the stack gives out',
        ).not.toThrow();

        expect(
          a.hasSignal('nobody'),
          'a cyclic chain answers like an unknown name',
        ).toBe(false);

        expect(
          a.hasSignal('inB'),
          'one hop up the cyclic chain still answers',
        ).toBe(true);
      } finally {
        b[$setParentGroup](undefined);
        b.clear();
        a.clear();
        inB.destroy();
      }
    });

    it('signal() answers instead of hanging when the parent chain is cyclic', () => {
      const a = SignalGroup.findOrCreate({});
      const b = SignalGroup.findOrCreate({});
      const inB = createSignal(1);

      b.attachSignalByName('inB', inB);

      b.attachGroup(a); // a → b
      b[$setParentGroup](a); // a ↔ b

      try {
        expect(
          () => a.signal('nobody'),
          'the walk ends instead of running until the stack gives out',
        ).not.toThrow();

        expect(
          a.signal('nobody'),
          'a cyclic chain answers like an unknown name',
        ).toBeUndefined();

        expect(
          a.signal('inB'),
          'one hop up the cyclic chain still answers',
        ).toBe(inB);
      } finally {
        b[$setParentGroup](undefined);
        b.clear();
        a.clear();
        inB.destroy();
      }
    });

    it('runEffects() ignores a re-entrant call from an effect callback', () => {
      const group = SignalGroup.findOrCreate({});
      const order: string[] = [];

      const first = createEffect(
        () => {
          order.push('first: enter');
          group.runEffects();
          order.push('first: leave');
        },
        {autorun: false},
      );

      const second = createEffect(
        () => {
          order.push('second');
        },
        {autorun: false},
      );

      try {
        group.attachEffect(first[$effect]);
        group.attachEffect(second[$effect]);

        group.runEffects();

        expect(order, 'the re-entrant call ran nothing at all').toEqual([
          'first: enter',
          'first: leave',
          'second',
        ]);
      } finally {
        first.destroy();
        second.destroy();
        group.clear();
      }
    });
  });

  describe('named signal bookkeeping', () => {
    it('signal churn leaves no dead handles in the held value', () => {
      // `#dropSignalSubscription()` takes the handle out of
      // `[$groupResources].unsubs` as well as out of
      // `#signalDestroySubscriptions`. Only the second one is load-bearing
      // for the group's own behaviour, which is why the first survives every
      // functional test — measured, the whole suite stays green without it.
      // The set is the held value of the resource finalizer, so a handle
      // left in it is a closure held strongly for as long as the group
      // lives. Measured without the line: 5000 attach/destroy cycles leave
      // 5000 dead handles behind, and 5000 attach/detach cycles another
      // 5000 on top.
      const group = SignalGroup.findOrCreate({});
      const resources = group[$groupResources];
      const warmup = createSignal(0);
      const detached: ReturnType<typeof createSignal<number>>[] = [];

      try {
        expect(resources.unsubs.size).toBe(0);
        group.attachSignal(warmup);
        expect(resources.unsubs.size, 'the set really is in use').toBe(1);
        group.detachSignal(warmup);
        warmup.destroy();

        // Route 1: the signal is destroyed from the outside and leaves through
        // the group's own destroy hook.
        for (let i = 0; i < 50; i += 1) {
          const signal = createSignal(i);
          group.attachSignal(signal);
          signal.destroy();
        }
        expect(resources.unsubs.size, 'after 50 attach/destroy cycles').toBe(0);

        // Route 2: the signal is detached while it stays alive.
        for (let i = 0; i < 50; i += 1) {
          const signal = createSignal(i);
          detached.push(signal);
          group.attachSignal(signal);
          group.detachSignal(signal);
        }
        expect(resources.unsubs.size, 'after 50 attach/detach cycles').toBe(0);

        for (const signal of detached) {
          signal.destroy();
        }
        group.clear();
        assertSignalsCount(0, 'no signal survived either route');
      } finally {
        warmup.destroy();
        for (const signal of detached) {
          signal.destroy();
        }
        group.clear();
      }
    });

    it('rebinding a name destroys the signal it displaces', () => {
      const subscriptions = subscriptionSnapshot();

      const group = SignalGroup.findOrCreate({});
      const signals: ReturnType<typeof createSignal<number>>[] = [];

      try {
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
      } finally {
        for (const signal of signals) {
          signal.destroy();
        }
        group.clear();
      }
    });

    it('attachSignalByName(name, undefined) releases the signals held under that name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        group.attachSignalByName('slot', signal);
        group.attachSignalByName('slot');

        expect(group.hasSignal('slot')).toBe(false);
        assertSignalsCount(0, 'name gone, signal gone');
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('attachSignalByName(name, undefined) keeps an explicitly attached signal', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
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
      } finally {
        signal.destroy();
        group.clear();
      }
    });

    it('attachSignalByName(name, undefined) leaves the other names of a signal alone', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(42);

      try {
        group.attachSignalByName('a', signal);
        group.attachSignalByName('b', signal);

        group.attachSignalByName('a');

        expect(group.hasSignal('a')).toBe(false);
        expect(group.signal('b')).toBe(signal);
        assertSignalsCount(1, 'still reachable under its other name');

        group.clear();

        assertSignalsCount(0, 'destroyed with the group');
      } finally {
        signal.destroy();
        group.clear();
      }
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

      try {
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
      } finally {
        SignalGroup.get(obj)?.clear();
        trigger.destroy();
      }
    });

    it('a rebind keeps a signal that is also bound under another name', () => {
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(1);
      const other = createSignal(2);

      try {
        group.attachSignalByName('a', signal);
        group.attachSignalByName('b', signal);

        group.attachSignalByName('a', other);

        expect(group.signal('a')).toBe(other);
        expect(group.signal('b')).toBe(signal);

        group.clear();

        assertSignalsCount(0, 'both signals are still owned by the group');
      } finally {
        signal.destroy();
        other.destroy();
        group.clear();
      }
    });

    it('a rebind keeps a signal that was attached explicitly', () => {
      const group = SignalGroup.findOrCreate({});
      const signal1 = createSignal(1);
      const signal2 = createSignal(2);

      try {
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
      } finally {
        signal1.destroy();
        signal2.destroy();
        group.clear();
      }
    });
  });

  describe('lazy member collections', () => {
    it('the shared empty stand-ins refuse every write', () => {
      // The stand-ins are shared by every SignalGroup in the process, so a
      // forgotten `own*()` call would not corrupt one group, it would
      // corrupt all of them at once. These four throws are what turns that
      // into an immediate, loud failure instead of a slow one.
      const key = {};

      expect(() => SHARED_EMPTY_COLLECTIONS.set.add(key)).toThrow(
        /shared empty stand-in/,
      );
      expect(() => SHARED_EMPTY_COLLECTIONS.map.set(key, key)).toThrow(
        /shared empty stand-in/,
      );
      expect(() => SHARED_EMPTY_COLLECTIONS.weakMap.set(key, key)).toThrow(
        /shared empty stand-in/,
      );
      expect(() => SHARED_EMPTY_COLLECTIONS.weakSet.add(key)).toThrow(
        /shared empty stand-in/,
      );

      expect(SHARED_EMPTY_COLLECTIONS.set.size).toBe(0);
      expect(SHARED_EMPTY_COLLECTIONS.map.size).toBe(0);
    });

    it("one group's first attach leaves every other group untouched", () => {
      const a = SignalGroup.findOrCreate({});
      const b = SignalGroup.findOrCreate({});
      const child = SignalGroup.findOrCreate({});
      const direct = createSignal(1);
      const named = createSignal(2);
      const source = createSignal(3);
      const target = createSignal(0);
      const signalLink = link(source, target);

      try {
        // b is created first and never written to: whatever the writes on a
        // touch, b is the group that would show it.
        a.attachGroup(child);
        a.attachSignal(direct);
        a.attachSignalByName('name', named);
        a.attachLink(signalLink);

        expect(getGroupMemberCounts(b)).toEqual(NO_GROUP_MEMBERS);
        expect(b.hasSignal('name')).toBe(false);
        expect(b.signal('name')).toBeUndefined();
      } finally {
        signalLink.destroy();
        source.destroy();
        target.destroy();
        direct.destroy();
        named.destroy();
        child.clear();
        b.clear();
        a.clear();
      }
    });

    it('a group that never held anything survives clear(), off() and a second clear()', () => {
      const group = SignalGroup.findOrCreate({});

      try {
        group.clear();
        expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);

        group.off();
        expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);

        group.clear();
        expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
      } finally {
        group.clear();
      }
    });

    it('a DESTROY hook that fires after clear() still finds its collection', () => {
      // The trap this rebuild could have set: `clear()` handing a field back
      // to the shared stand-in would make the `once(…, DESTROY,
      // Priority.Max, …)` hooks throw at the head of an eventize delivery,
      // and eventize ends a delivery at the first throwing listener — every
      // application DESTROY listener would go away empty-handed. The
      // takeover is one-way for exactly this reason.
      //
      // `detachLink()` is the one route that outlives a `clear()`: it takes
      // a *live* link back out of `#links` while `#linksWithDestroyHook`
      // keeps the link (that is the whole point of the WeakSet guard), so
      // the hook is still registered and fires whenever the link is
      // destroyed — here long after the group was dismantled. An effect has
      // no such route: `clear()` destroys it, and its hook runs inside the
      // teardown rather than after it, which the second half checks.
      const group = SignalGroup.findOrCreate({});
      const signal = createSignal(0);
      const source = createSignal(1);
      const target = createSignal(0);

      const effect = createEffect(() => {
        signal.get();
      });
      const signalLink = link(source, target);

      let effectListener = 0;
      let linkListener = 0;

      try {
        group.attachEffect(effect[$effect]);
        group.attachLink(signalLink);
        group.detachLink(signalLink);

        on(effect[$effect], DESTROY, () => {
          effectListener += 1;
        });
        on(signalLink, DESTROY, () => {
          linkListener += 1;
        });

        expect(() => group.clear()).not.toThrow();

        expect(
          effectListener,
          'the effect hook ran inside clear() and let the application listener through',
        ).toBe(1);
        expect(linkListener, 'the detached link is still alive').toBe(0);

        expect(() => signalLink.destroy()).not.toThrow();

        expect(
          linkListener,
          'the link DESTROY listener ran once, after clear()',
        ).toBe(1);

        // The other half of the hook's job: it does not merely fail to
        // throw, it actually takes the link back out. "No throw" is the
        // loud half — under this design the quiet half is the one worth
        // stating, because a `delete()` that ran into the void would leave
        // the group holding a dead link and say nothing about it.
        expect(
          getGroupMemberCounts(group).links,
          'the group is not holding the destroyed link',
        ).toBe(0);
      } finally {
        effect.destroy();
        signalLink.destroy();
        signal.destroy();
        source.destroy();
        target.destroy();
        group.clear();
      }
    });
  });
});
