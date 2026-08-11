import {
  getSubscribedEventNames,
  getSubscriptionCount,
  on,
} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
  getGroupMemberCounts,
  NO_GROUP_MEMBERS,
} from './__testing__/assert-helpers.js';
import {createMemo} from './createMemo.js';
import {createSignal} from './createSignal.js';
import type {EffectImpl} from './EffectImpl.js';
import {createEffect, onCreateEffect, onDestroyEffect} from './effects.js';
import {
  globalDestroySignalQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './global-queues.js';
import {SignalGroup} from './SignalGroup.js';
import {destroySignal, signalImpl} from './signal-core.js';

describe('a creation that throws leaves nothing behind (P1, P2)', () => {
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

  describe('createEffect', () => {
    it('destroys an effect whose first run threw after reading a signal (P1)', () => {
      const sig = createSignal(1);
      const boom = new Error('boom');

      let impl: EffectImpl | undefined;
      const unsubCreate = onCreateEffect((created) => {
        impl = created as EffectImpl;
      });

      // Snapshot behind the capture handler: it subscribes to the effect
      // queue itself, and the baseline has to answer "what did createEffect()
      // leave", not "what does this test hold".
      const effectQueueBefore = getSubscriptionCount(globalEffectQueue);
      const signalQueueBefore = getSubscriptionCount(globalSignalQueue);
      const destroyQueueBefore = getSubscriptionCount(globalDestroySignalQueue);

      let caught: unknown;
      try {
        try {
          createEffect(() => {
            sig.get();
            throw boom;
          });
        } catch (err) {
          caught = err;
        }

        expect(caught, 'the run error reaches the caller unchanged').toBe(boom);
        expect(
          impl,
          'the effect did exist — onCreateEffect saw it',
        ).toBeDefined();
        expect(
          impl.destroyed,
          'an effect that never escaped createEffect() must not survive it',
        ).toBe(true);
        assertEffectsCount(0, 'a creation that threw leaves nothing counted');
        expect(
          getSubscriptionCount(globalEffectQueue),
          'the RECALL subscription the constructor made must be gone',
        ).toBe(effectQueueBefore);
        expect(
          getSubscriptionCount(globalSignalQueue),
          'so must the RECALL subscription on the signal the callback read',
        ).toBe(signalQueueBefore);
        expect(
          getSubscriptionCount(globalDestroySignalQueue),
          'and the destroy-watch that came with it',
        ).toBe(destroyQueueBefore);
        expect(
          getSubscribedEventNames(globalSignalQueue),
          'and it is that signal id that is gone, not some other',
        ).not.toContain(signalImpl(sig).id);
      } finally {
        unsubCreate();
        impl?.destroy();
        destroySignal(sig);
      }
    });

    it('destroys an effect whose first run threw before reading anything (P1)', () => {
      const boom = new Error('boom');

      let impl: EffectImpl | undefined;
      const unsubCreate = onCreateEffect((created) => {
        impl = created as EffectImpl;
      });

      const effectQueueBefore = getSubscriptionCount(globalEffectQueue);

      let caught: unknown;
      try {
        try {
          createEffect(() => {
            throw boom;
          });
        } catch (err) {
          caught = err;
        }

        expect(caught, 'the run error reaches the caller unchanged').toBe(boom);
        expect(
          impl.destroyed,
          'the case with no rescue path at all: nothing was read, so no signal destruction can ever collect this effect',
        ).toBe(true);
        assertEffectsCount(0, 'a creation that threw leaves nothing counted');
        expect(
          getSubscriptionCount(globalEffectQueue),
          'the RECALL subscription the constructor made must be gone',
        ).toBe(effectQueueBefore);
      } finally {
        unsubCreate();
        impl?.destroy();
      }
    });

    it('destroys the effect when an onCreateEffect() handler throws (P1)', () => {
      const boom = new Error('handler boom');

      let impl: EffectImpl | undefined;
      const unsubCreate = onCreateEffect((created) => {
        impl = created as EffectImpl;
      });
      const unsubThrow = onCreateEffect(() => {
        throw boom;
      });

      const effectQueueBefore = getSubscriptionCount(globalEffectQueue);

      let caught: unknown;
      try {
        try {
          createEffect(() => {});
        } catch (err) {
          caught = err;
        }

        expect(caught, 'the handler error reaches the caller unchanged').toBe(
          boom,
        );
        expect(
          impl.destroyed,
          'the $createEffect notification is inside the guarded region, same as the run',
        ).toBe(true);
        assertEffectsCount(0, 'a creation that threw leaves nothing counted');
        expect(getSubscriptionCount(globalEffectQueue)).toBe(effectQueueBefore);
      } finally {
        unsubThrow();
        unsubCreate();
        impl?.destroy();
      }
    });

    it('reports a failing rollback next to the run error instead of in its place (BUG-012)', () => {
      const boom = new Error('boom');
      const reporterBoom = new Error('reporter boom');

      let impl: EffectImpl | undefined;
      const unsubCreate = onCreateEffect((created) => {
        impl = created as EffectImpl;
      });
      const unsubDestroy = onDestroyEffect(() => {
        throw reporterBoom;
      });

      let caught: unknown;
      try {
        try {
          createEffect(() => {
            throw boom;
          });
        } catch (err) {
          caught = err;
        }

        expect(
          caught,
          'two failures, so the collected form — not one of them dropped',
        ).toBeInstanceOf(AggregateError);
        const errors = (caught as AggregateError).errors;
        expect(
          errors,
          'the run error first, the rollback behind it, both unwrapped',
        ).toHaveLength(2);
        expect(errors[0], 'and both by identity, not by message').toBe(boom);
        expect(errors[1]).toBe(reporterBoom);
        expect(impl.destroyed, 'the rollback ran to its end').toBe(true);
        assertEffectsCount(
          0,
          'the counter comes back down even when the rollback reports',
        );
      } finally {
        unsubDestroy();
        unsubCreate();
        impl?.destroy();
      }
    });

    it('keeps an effect whose first run threw when {attach} gives it a holder', () => {
      const host = {};
      const sig = createSignal(0);
      const boom = new Error('boom');
      let runs = 0;

      let impl: EffectImpl | undefined;
      const unsubCreate = onCreateEffect((created) => {
        impl = created as EffectImpl;
      });

      let caught: unknown;
      try {
        try {
          createEffect(
            () => {
              runs++;
              sig.get();
              if (runs === 1) throw boom;
            },
            {attach: host},
          );
        } catch (err) {
          caught = err;
        }

        expect(caught, 'the run error reaches the caller unchanged').toBe(boom);
        expect(
          impl.destroyed,
          'the group holds this effect, so there is no leak to roll back',
        ).toBe(false);
        assertEffectsCount(1, 'and the counter says so');
        expect(
          getGroupMemberCounts(SignalGroup.findOrCreate(host)),
          'it is still a member of the group it was attached to',
        ).toEqual({...NO_GROUP_MEMBERS, effects: 1});

        sig.set(1);

        expect(
          runs,
          'and it is still usable: the next write runs it again, as docs/api.md promises',
        ).toBe(2);
      } finally {
        unsubCreate();
        // The group is the holder — so the group is what takes it down again,
        // and no counter guard fires afterwards.
        SignalGroup.delete(host);
        destroySignal(sig);
      }
    });

    it('leaves an effect alone that throws on a later run', () => {
      const sig = createSignal(0);
      const boom = new Error('later boom');
      let runs = 0;

      const effect = createEffect(() => {
        runs++;
        if (sig.get() > 0) throw boom;
      });

      try {
        expect(runs, 'the first run went through').toBe(1);

        let caught: unknown;
        try {
          sig.set(1);
        } catch (err) {
          caught = err;
        }

        expect(caught, 'the write reports the effect failure').toBe(boom);
        expect(runs).toBe(2);
        assertEffectsCount(
          1,
          'a failed rerun is not a failed creation — the effect stays',
        );
      } finally {
        effect.destroy();
        destroySignal(sig);
      }
    });

    it('rolls nothing back when nothing threw ({autorun: false})', () => {
      const effect = createEffect(
        () => {
          throw new Error('never runs at creation time');
        },
        {autorun: false},
      );

      try {
        assertEffectsCount(1, 'the creation itself did not throw');
      } finally {
        effect.destroy();
      }
    });

    it('a constructor that throws never counted anything to roll back (BUG-003)', () => {
      const host = {};

      let caught: unknown;
      try {
        createEffect(() => {}, {dependencies: ['nope'], attach: host});
      } catch (err) {
        caught = err;
      }

      try {
        expect(
          (caught as Error).message,
          'the name lookup fails inside the constructor',
        ).toMatch(/cannot resolve dependency "nope"/);
        assertEffectsCount(
          0,
          'the guarded region starts after the constructor because the constructor counts and subscribes last',
        );
      } finally {
        SignalGroup.delete(host);
      }
    });
  });

  describe('createMemo', () => {
    it('keeps the memo signal and its effect when {attach} gives them a holder (P2)', () => {
      const host = {};
      const boom = new Error('memo boom');

      let caught: unknown;
      try {
        try {
          createMemo(
            () => {
              throw boom;
            },
            {attach: host, name: 'answer'},
          );
        } catch (err) {
          caught = err;
        }

        expect(caught, 'the compute error reaches the caller unchanged').toBe(
          boom,
        );
        assertSignalsCount(1, 'nothing is rolled back while a holder exists');
        assertEffectsCount(1, 'the memo effect is held by the same group');
        expect(
          getGroupMemberCounts(SignalGroup.findOrCreate(host)),
          'signal and effect are both group members — clear() reaches them',
        ).toEqual({
          ...NO_GROUP_MEMBERS,
          signals: 1,
          namedSignals: 1,
          otherSignals: 1,
          effects: 1,
        });
      } finally {
        SignalGroup.delete(host);
      }
    });

    it('destroys the memo signal when the first compute throws (P2)', () => {
      const boom = new Error('memo boom');

      let impl: EffectImpl | undefined;
      const unsubCreate = onCreateEffect((created) => {
        impl = created as EffectImpl;
      });

      const effectQueueBefore = getSubscriptionCount(globalEffectQueue);

      let caught: unknown;
      try {
        try {
          createMemo(() => {
            throw boom;
          });
        } catch (err) {
          caught = err;
        }

        expect(caught, 'the compute error reaches the caller unchanged').toBe(
          boom,
        );
        assertSignalsCount(
          0,
          'without {attach} nobody holds this signal — a leak here is permanent',
        );
        assertEffectsCount(0, 'and neither must the memo effect survive');
        expect(getSubscriptionCount(globalEffectQueue)).toBe(effectQueueBefore);
      } finally {
        unsubCreate();
        impl?.destroy();
      }
    });

    it('reports a failing signal teardown next to the compute error (BUG-012)', () => {
      const boom = new Error('memo boom');
      const destroyBoom = new Error('destroy boom');

      let impl: EffectImpl | undefined;
      const unsubCreate = onCreateEffect((created) => {
        impl = created as EffectImpl;
      });
      const unsubDestroyQueue = on(globalDestroySignalQueue, () => {
        throw destroyBoom;
      });

      let caught: unknown;
      try {
        try {
          createMemo(() => {
            throw boom;
          });
        } catch (err) {
          caught = err;
        }

        expect(
          caught,
          'two failures, so the collected form — not one of them dropped',
        ).toBeInstanceOf(AggregateError);
        const errors = (caught as AggregateError).errors;
        expect(
          errors,
          'the compute error first, the signal teardown behind it',
        ).toHaveLength(2);
        expect(errors[0], 'and both by identity, not by message').toBe(boom);
        expect(errors[1]).toBe(destroyBoom);
        assertSignalsCount(
          0,
          'the signal is gone even though its destroy notification threw',
        );
      } finally {
        unsubDestroyQueue();
        unsubCreate();
        impl?.destroy();
      }
    });
  });
});
