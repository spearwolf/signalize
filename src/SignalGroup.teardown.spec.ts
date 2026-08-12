import {getSubscriptionCount, on} from '@spearwolf/eventize';
import type {MockInstance} from 'vitest';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
  getGroupMemberCounts,
  NO_GROUP_MEMBERS,
} from './__testing__/assert-helpers.js';
import {DESTROY, OFF} from './constants.js';
import {createSignal} from './createSignal.js';
import {signal} from './decorators.js';
import {createEffect, getEffectsCount} from './effects.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {getLinksCount, link} from './link.js';
import {findObjectSignalByName} from './object-signals.js';
import {
  clearGroupFromFinalizer,
  getSignalGroupsCount,
  SignalGroup,
} from './SignalGroup.js';
import {destroySignal, getSignalsCount, signalImpl} from './signal-core.js';

describe('SignalGroup teardown robustness', () => {
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

  it('clear() finishes the teardown even when an effect cleanup throws', () => {
    const signalsBefore = getSignalsCount();
    const effectsBefore = getEffectsCount();
    const linksBefore = getLinksCount();
    const groupsBefore = getSignalGroupsCount();

    const host = {};
    const group = SignalGroup.findOrCreate(host);

    const sig = createSignal(0, {attach: host});

    let siblingCleanupCalls = 0;

    createEffect(
      () => {
        sig.get();
        return () => {
          throw new Error('cleanup boom');
        };
      },
      {attach: host},
    );

    createEffect(
      () => {
        sig.get();
        return () => {
          siblingCleanupCalls += 1;
        };
      },
      {attach: host},
    );

    link(sig, () => {}, {attach: host});

    try {
      expect(getSignalGroupsCount()).toBe(groupsBefore + 1);

      expect(() => {
        group.clear();
      }).toThrow('cleanup boom');

      expect(siblingCleanupCalls, 'sibling cleanup must still run').toBe(1);
      expect(getEffectsCount(), 'effects after clear').toBe(effectsBefore);
      expect(getSignalsCount(), 'signals after clear').toBe(signalsBefore);
      expect(getLinksCount(), 'links after clear').toBe(linksBefore);
      expect(getSignalGroupsCount(), 'groups after clear').toBe(groupsBefore);
    } finally {
      // A failure before the `clear()` above leaves the throwing cleanup
      // armed; an unguarded teardown here would report `cleanup boom`
      // instead of the assertion that actually failed.
      try {
        group.clear();
      } catch {
        /* ignore */
      }
    }
  });

  it('off() finishes the teardown even when an effect cleanup throws', () => {
    const effectsBefore = getEffectsCount();
    const linksBefore = getLinksCount();

    const host = {};
    const group = SignalGroup.findOrCreate(host);

    const sig = createSignal(0, {attach: host});

    let offEvents = 0;
    on(group, OFF, () => {
      offEvents += 1;
    });

    createEffect(
      () => {
        sig.get();
        return () => {
          throw new Error('cleanup boom');
        };
      },
      {attach: host},
    );

    createEffect(
      () => {
        sig.get();
      },
      {attach: host},
    );

    link(sig, () => {}, {attach: host});

    try {
      expect(() => {
        group.off();
      }).toThrow('cleanup boom');

      expect(getEffectsCount(), 'effects after off').toBe(effectsBefore);
      expect(getLinksCount(), 'links after off').toBe(linksBefore);
      expect(offEvents, 'OFF must be emitted exactly once').toBe(1);

      // The signal survives `off()` — the group stays reusable.
      expect(sig.value).toBe(0);
    } finally {
      // Same as above: the cleanup throws on the first teardown that
      // reaches it, whichever one that turns out to be.
      try {
        group.clear();
      } catch {
        /* ignore */
      }
    }
  });

  it('reports every teardown error: AggregateError for several, unchanged for one', () => {
    const errA = new Error('boom A');
    const errB = new Error('boom B');

    const hostA = {};
    const groupA = SignalGroup.findOrCreate(hostA);
    const sigA = createSignal(0, {attach: hostA});

    createEffect(
      () => {
        sigA.get();
        return () => {
          throw errA;
        };
      },
      {attach: hostA},
    );

    createEffect(
      () => {
        sigA.get();
        return () => {
          throw errB;
        };
      },
      {attach: hostA},
    );

    // The lone-failure half is arranged up front too: a group of its own,
    // untouched by `groupA.clear()`, and a handle the `finally` can reach.
    const errC = new Error('boom C');

    const hostB = {};
    const groupB = SignalGroup.findOrCreate(hostB);
    const sigB = createSignal(0, {attach: hostB});

    createEffect(
      () => {
        sigB.get();
        return () => {
          throw errC;
        };
      },
      {attach: hostB},
    );

    try {
      let caught: unknown;
      try {
        groupA.clear();
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect((caught as AggregateError).errors).toEqual([errA, errB]);

      // A lone failure is rethrown as-is, not wrapped.
      let caughtSingle: unknown;
      try {
        groupB.clear();
      } catch (err) {
        caughtSingle = err;
      }

      expect(caughtSingle).toBe(errC);
    } finally {
      try {
        groupA.clear();
      } catch {
        /* ignore */
      }
      try {
        groupB.clear();
      } catch {
        /* ignore */
      }
    }
  });

  it('drops destroyed effects and signals from the group by itself', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    try {
      for (let i = 0; i < 50; i += 1) {
        createEffect(() => {}, {attach: host}).destroy();
      }

      for (let i = 0; i < 50; i += 1) {
        destroySignal(createSignal(i, {attach: host}));
      }

      expect(getEffectsCount(), 'no effect survives').toBe(0);
      expect(getSignalsCount(), 'no signal survives').toBe(0);

      expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
    } finally {
      group.clear();
    }
  });

  it('drops a hard-destroyed signal from its name bindings too', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    const names: string[] = [];

    try {
      for (let i = 0; i < 50; i += 1) {
        const name = `sig${i}`;
        names.push(name);
        const sig = createSignal(i);
        group.attachSignalByName(name, sig);
        destroySignal(sig);
      }

      expect(getSignalsCount(), 'no signal survives').toBe(0);

      for (const name of names) {
        expect(group.hasSignal(name), `${name} must be unbound`).toBe(false);
        expect(group.signal(name), `${name} must resolve to nothing`).toBe(
          undefined,
        );
      }

      expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
    } finally {
      // A name is a hold: whatever the loop got as far as attaching is
      // destroyed with the group.
      group.clear();
    }
  });

  it('promotes the remaining candidate when a destroyed signal vacates a name', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    const first = createSignal(1);
    const second = createSignal(2);

    try {
      group.attachSignalByName('slot', first);
      group.attachSignal(first); // keeps `first` alive across the rebind
      group.attachSignalByName('slot', second);

      expect(group.signal('slot')).toBe(second);

      destroySignal(second);

      // `first` is still listed under the name, so it takes the slot back —
      // the same fallback `detachSignal()` applies.
      expect(group.hasSignal('slot')).toBe(true);
      expect(group.signal('slot')).toBe(first);
    } finally {
      // Both signals are born unattached: a failure before the first
      // `attachSignalByName()` leaves the group without a hold on them.
      destroySignal(first, second);
      group.clear();
    }
  });

  it('drops a hard-destroyed @signal accessor from its host group', () => {
    class Host {
      @signal() accessor foo = 23;
    }

    const host = new Host();
    const group = SignalGroup.findOrCreate(host);

    try {
      expect(group.hasSignal('foo')).toBe(true);
      expect(host.foo).toBe(23);

      destroySignal(findObjectSignalByName(host, 'foo'));

      expect(group.hasSignal('foo'), 'the name must be unbound').toBe(false);
      expect(group.signal('foo')).toBeUndefined();
      expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
    } finally {
      group.clear();
    }
  });

  it('detachSignal() restores the destroy-queue subscription baseline', () => {
    const baseline = getSubscriptionCount(globalDestroySignalQueue);

    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const sig = createSignal(1, {attach: host});

    try {
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline + 1);

      group.detachSignal(sig);

      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline);

      destroySignal(sig);
      group.clear();

      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline);
    } finally {
      // `detachSignal()` takes the group's hold away mid-test, so the
      // signal needs a handle of its own here.
      destroySignal(sig);
      group.clear();
    }
  });

  it('releasing a name restores the destroy-queue subscription baseline', () => {
    const baseline = getSubscriptionCount(globalDestroySignalQueue);

    const host = {};
    const group = SignalGroup.findOrCreate(host);

    try {
      // Releasing the name outright: the name was the group's only hold, so
      // the signal is destroyed and its subscription must go with it.
      group.attachSignalByName('a', createSignal(1));
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline + 1);

      group.attachSignalByName('a');
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline);

      // Rebinding a name: the displaced signal is released, the new one
      // subscribes — one in, one out.
      group.attachSignalByName('b', createSignal(1));
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline + 1);

      group.attachSignalByName('b', createSignal(2));
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline + 1);

      group.clear();

      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline);
    } finally {
      // Every signal here is handed straight to the group, so the group is
      // the only handle there is — and the only one needed.
      group.clear();
    }
  });

  it('static SignalGroup.clear() sweeps every group even when one of them throws', () => {
    let siblingCleanupCalls = 0;

    const groups = [0, 1, 2].map((i) => {
      const host = {};
      const group = SignalGroup.findOrCreate(host);
      const sig = createSignal(0, {attach: host});

      createEffect(
        () => {
          sig.get();
          return () => {
            if (i === 0) {
              throw new Error('cleanup boom');
            }
            siblingCleanupCalls += 1;
          };
        },
        {attach: host},
      );

      link(sig, () => {}, {attach: host});

      return group;
    });

    try {
      expect(() => {
        SignalGroup.clear();
      }).toThrow('cleanup boom');

      expect(
        siblingCleanupCalls,
        'the groups after the throwing one must still be torn down',
      ).toBe(2);
      expect(
        getSignalGroupsCount(),
        'the registry is empty after one sweep',
      ).toBe(0);
      expect(getEffectsCount()).toBe(0);
      expect(getSignalsCount()).toBe(0);
      expect(getLinksCount()).toBe(0);
      for (const group of groups) {
        expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
      }
    } finally {
      try {
        SignalGroup.clear();
      } catch {
        /* ignore */
      }
    }
  });

  it('static SignalGroup.clear() reports every failing group, AggregateError for several', () => {
    for (const i of [0, 1, 2]) {
      const host = {};
      SignalGroup.findOrCreate(host);
      const sig = createSignal(0, {attach: host});

      createEffect(
        () => {
          sig.get();
          return () => {
            if (i === 0 || i === 2) {
              throw new Error(`cleanup boom ${i}`);
            }
          };
        },
        {attach: host},
      );

      link(sig, () => {}, {attach: host});
    }

    try {
      let caught: unknown;
      try {
        SignalGroup.clear();
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect(
        (caught as AggregateError).errors.map((e: Error) => e.message),
      ).toEqual(['cleanup boom 0', 'cleanup boom 2']);

      expect(getSignalGroupsCount()).toBe(0);
      expect(getEffectsCount()).toBe(0);
      expect(getSignalsCount()).toBe(0);
      expect(getLinksCount()).toBe(0);
    } finally {
      // The three hosts are locals of the loop above — the static sweep is
      // the only handle on their groups.
      try {
        SignalGroup.clear();
      } catch {
        /* ignore */
      }
    }
  });

  it('static SignalGroup.clear() keeps a group created during the sweep registered (BUG-009)', () => {
    const signalsBefore = getSignalsCount();
    const groupsBefore = getSignalGroupsCount();

    const hostA = {};
    const hostB = {};

    const groupA = SignalGroup.findOrCreate(hostA);
    createSignal(0, {attach: hostA});

    let groupB!: SignalGroup;

    on(groupA, DESTROY, () => {
      groupB = SignalGroup.findOrCreate(hostB);
      createSignal(0, {attach: hostB});
    });

    try {
      SignalGroup.clear();

      expect(
        getSignalGroupsCount(),
        'the group born during the sweep is still counted',
      ).toBe(groupsBefore + 1);
      expect(
        SignalGroup.findOrCreate(hostB),
        'store still hands out the same instance',
      ).toBe(groupB);
      expect(getGroupMemberCounts(groupB)).toEqual({
        ...NO_GROUP_MEMBERS,
        signals: 1,
      });

      // The second sweep is the cleanup: it must reach the group this time.
      SignalGroup.clear();

      expect(getSignalsCount()).toBe(signalsBefore);
      expect(getSignalGroupsCount()).toBe(groupsBefore);
    } finally {
      // Two sweeps, and that is the point of the test: the first one runs
      // the DESTROY listener that spawns `groupB`, the second collects it.
      SignalGroup.clear();
      SignalGroup.clear();
    }
  });

  it('the FinalizationRegistry backstop still works for a group created during the sweep (BUG-009)', () => {
    const signalsBefore = getSignalsCount();

    const hostA = {};
    const hostB = {};

    const groupA = SignalGroup.findOrCreate(hostA);
    createSignal(0, {attach: hostA});

    let groupB!: SignalGroup;

    on(groupA, DESTROY, () => {
      groupB = SignalGroup.findOrCreate(hostB);
      createSignal(0, {attach: hostB});
    });

    try {
      SignalGroup.clear();

      clearGroupFromFinalizer(groupB);

      expect(
        getGroupMemberCounts(groupB),
        'the backstop must still find the group registered',
      ).toEqual(NO_GROUP_MEMBERS);
      expect(getSignalsCount()).toBe(signalsBefore);
    } finally {
      // Same two-pass reason as above.
      SignalGroup.clear();
      SignalGroup.clear();
    }
  });

  it('clearGroupFromFinalizer() reports a throwing teardown instead of letting it escape', () => {
    const signalsBefore = getSignalsCount();
    const effectsBefore = getEffectsCount();
    const linksBefore = getLinksCount();
    const groupsBefore = getSignalGroupsCount();

    const host = {};
    const group = SignalGroup.findOrCreate(host);

    const sig = createSignal(0, {attach: host});

    let siblingCleanupCalls = 0;

    createEffect(
      () => {
        sig.get();
        return () => {
          throw new Error('cleanup boom');
        };
      },
      {attach: host},
    );

    createEffect(
      () => {
        sig.get();
        return () => {
          siblingCleanupCalls += 1;
        };
      },
      {attach: host},
    );

    link(sig, () => {}, {attach: host});

    const errorSpy: MockInstance = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      expect(() => {
        clearGroupFromFinalizer(group);
      }, 'the finalizer must never let a teardown error escape').not.toThrow();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain('FinalizationRegistry');
      expect(errorSpy.mock.calls[0][1]).toBeInstanceOf(Error);
      expect((errorSpy.mock.calls[0][1] as Error).message).toBe('cleanup boom');

      expect(siblingCleanupCalls, 'sibling cleanup must still run').toBe(1);
      expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
      expect(getSignalGroupsCount(), 'groups after the finalizer').toBe(
        groupsBefore,
      );
      expect(getEffectsCount()).toBe(effectsBefore);
      expect(getSignalsCount()).toBe(signalsBefore);
      expect(getLinksCount()).toBe(linksBefore);
    } finally {
      errorSpy.mockRestore();
      // `clearGroupFromFinalizer()` swallows the throw; a plain `clear()`
      // here does not, so it needs the guard.
      try {
        group.clear();
      } catch {
        /* ignore */
      }
    }
  });

  it('the backstop leaves a group alone that is no longer registered (TEST-020)', () => {
    // The counterpart to the test above: there the group is still filed in
    // the registry and the backstop has to reach it. Here it was cleared
    // explicitly first, and the membership check is all that keeps a
    // finalizer job that was already queued from running a second teardown
    // over it. `clear()` unregisters from both FinalizationRegistries, so
    // the only way to reach this code path at all is the direct call the
    // seam exists for.
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    createSignal(0, {attach: host});

    let destroyEmits = 0;

    try {
      group.clear();

      // After the explicit teardown — `clear()` runs `off(this)`, so a
      // listener from before would not be heard either way and would prove
      // nothing.
      on(group, DESTROY, () => {
        destroyEmits += 1;
      });

      clearGroupFromFinalizer(group);

      expect(
        destroyEmits,
        'a group that already left the registry is not torn down twice',
      ).toBe(0);
    } finally {
      // The second `clear()` is the idempotent belt: it emits `DESTROY` once
      // more, after the assertion, and takes the listener off with it.
      group.clear();
    }
  });

  describe('every teardown step collects instead of aborting', () => {
    it('off() collects a throwing child group and still tears down its own members', () => {
      const parentHost = {};
      const childHost = {};
      const parent = SignalGroup.findOrCreate(parentHost);
      const child = SignalGroup.findOrCreate(childHost);

      parent.attachGroup(child);

      on(child, OFF, () => {
        throw new Error('child off boom');
      });

      const sig = createSignal(0, {attach: parentHost});
      let cleanupCalls = 0;

      createEffect(
        () => {
          sig.get();
          return () => {
            cleanupCalls += 1;
          };
        },
        {attach: parentHost},
      );

      try {
        expect(() => parent.off()).toThrow('child off boom');

        expect(cleanupCalls).toBe(1);
        expect(getEffectsCount()).toBe(0);
      } finally {
        // No guard needed: the thrower sits on OFF, and `clear()` emits
        // DESTROY. Measured — removing the guard leaves the message intact.
        parent.clear();
        child.clear();
      }
    });

    it('off() collects a throwing link teardown and still destroys the sibling link', () => {
      const host = {};
      const group = SignalGroup.findOrCreate(host);
      const sig = createSignal(0, {attach: host});

      const boomLink = link(sig, () => {}, {attach: host});
      on(boomLink, DESTROY, () => {
        throw new Error('link teardown boom');
      });

      let siblingDestroyed = 0;
      const sibling = link(sig, (v: number) => v, {attach: host});
      on(sibling, DESTROY, () => {
        siblingDestroyed += 1;
      });

      try {
        expect(() => group.off()).toThrow('link teardown boom');

        expect(siblingDestroyed).toBe(1);
        expect(sibling.isDestroyed).toBe(true);
        expect(getLinksCount()).toBe(0);
      } finally {
        try {
          group.clear();
        } catch {
          /* ignore */
        }
      }
    });

    it('off() collects a throwing detach listener and still notifies the remaining signals', () => {
      const host = {};
      const group = SignalGroup.findOrCreate(host);

      const first = createSignal(0, {attach: host});
      const second = createSignal(0, {attach: host});

      const unsubscribeFirst = on(
        globalDestroySignalQueue,
        signalImpl(first).id,
        (_id: symbol, params?: {detach?: boolean}) => {
          if (params?.detach) {
            throw new Error('detach boom');
          }
        },
      );

      let secondDetachEvents = 0;
      const unsubscribeSecond = on(
        globalDestroySignalQueue,
        signalImpl(second).id,
        (_id: symbol, params?: {detach?: boolean}) => {
          if (params?.detach) {
            secondDetachEvents += 1;
          }
        },
      );

      try {
        expect(() => group.off()).toThrow('detach boom');
        expect(secondDetachEvents).toBe(1);
        expect(first.value).toBe(0);
      } finally {
        // The thrower only fires on a detach, and it is gone before the
        // `clear()` below destroys the two signals for good.
        unsubscribeFirst();
        unsubscribeSecond();
        group.clear();
      }
    });

    it('off() collects a throwing OFF listener after the teardown is complete', () => {
      const host = {};
      const group = SignalGroup.findOrCreate(host);
      const sig = createSignal(0, {attach: host});

      let cleanupCalls = 0;
      createEffect(
        () => {
          sig.get();
          return () => {
            cleanupCalls += 1;
          };
        },
        {attach: host},
      );

      link(sig, () => {}, {attach: host});

      on(group, OFF, () => {
        throw new Error('off listener boom');
      });

      try {
        expect(() => group.off()).toThrow('off listener boom');

        expect(cleanupCalls).toBe(1);
        expect(getEffectsCount()).toBe(0);
        expect(getLinksCount()).toBe(0);
        expect(sig.value).toBe(0);
      } finally {
        // Same as the child-group case above: OFF is not on the `clear()`
        // path, so the teardown here stays silent.
        group.clear();
      }
    });

    it('clear() collects a throwing DESTROY listener and still dismantles the group', () => {
      const groupsBefore = getSignalGroupsCount();

      const host = {};
      const group = SignalGroup.findOrCreate(host);
      const sig = createSignal(0, {attach: host});

      let cleanupCalls = 0;
      createEffect(
        () => {
          sig.get();
          return () => {
            cleanupCalls += 1;
          };
        },
        {attach: host},
      );

      link(sig, () => {}, {attach: host});

      on(group, DESTROY, () => {
        throw new Error('destroy listener boom');
      });

      try {
        expect(() => group.clear()).toThrow('destroy listener boom');

        expect(cleanupCalls).toBe(1);
        expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
        expect(getEffectsCount()).toBe(0);
        expect(getSignalsCount()).toBe(0);
        expect(getLinksCount()).toBe(0);
        expect(getSignalGroupsCount()).toBe(groupsBefore);
      } finally {
        try {
          group.clear();
        } catch {
          /* ignore */
        }
      }
    });

    it('clear() collects a throwing child group and still clears its own members', () => {
      const groupsBefore = getSignalGroupsCount();

      const parentHost = {};
      const childHost = {};
      const parent = SignalGroup.findOrCreate(parentHost);
      const child = SignalGroup.findOrCreate(childHost);

      parent.attachGroup(child);

      on(child, DESTROY, () => {
        throw new Error('child destroy boom');
      });

      const sig = createSignal(0, {attach: parentHost});
      let cleanupCalls = 0;

      createEffect(
        () => {
          sig.get();
          return () => {
            cleanupCalls += 1;
          };
        },
        {attach: parentHost},
      );

      try {
        expect(() => parent.clear()).toThrow('child destroy boom');

        expect(cleanupCalls).toBe(1);
        expect(getGroupMemberCounts(parent)).toEqual(NO_GROUP_MEMBERS);
        expect(getGroupMemberCounts(child)).toEqual(NO_GROUP_MEMBERS);
        expect(getSignalsCount()).toBe(0);
        expect(getSignalGroupsCount()).toBe(groupsBefore);
      } finally {
        try {
          parent.clear();
        } catch {
          /* ignore */
        }
        try {
          child.clear();
        } catch {
          /* ignore */
        }
      }
    });

    it('clear() collects a throwing destroy-queue listener and still releases its subscriptions', () => {
      const destroyQueueBaseline = getSubscriptionCount(
        globalDestroySignalQueue,
      );

      const host = {};
      const group = SignalGroup.findOrCreate(host);

      const first = createSignal(0);
      const second = createSignal(0);

      const unsubscribeBoom = on(
        globalDestroySignalQueue,
        signalImpl(first).id,
        () => {
          throw new Error('destroy queue boom');
        },
      );

      group.attachSignal(first);
      group.attachSignal(second);

      try {
        expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
          destroyQueueBaseline + 3,
        );

        expect(() => group.clear()).toThrow('destroy queue boom');
        expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
          destroyQueueBaseline + 1,
        );

        unsubscribeBoom();

        expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
          destroyQueueBaseline,
        );
        expect(getSignalsCount()).toBe(0);
        expect(signalImpl(second).destroyed).toBe(true);
        expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
      } finally {
        // Unsubscribing first is what makes the rest of this block silent:
        // the thrower fires on `first` being destroyed, and destroying it
        // is exactly what `clear()` does. Calling it twice is a no-op.
        unsubscribeBoom();
        destroySignal(first, second);
        group.clear();
      }
    });

    it('clear() collects a throwing link teardown on a foreign source', () => {
      const host = {};
      const group = SignalGroup.findOrCreate(host);

      const external = createSignal(0);

      const boomLink = link(external, () => {}, {attach: host});
      on(boomLink, DESTROY, () => {
        throw new Error('link clear boom');
      });

      let siblingDestroyed = 0;
      const sibling = link(external, (v: number) => v, {attach: host});
      on(sibling, DESTROY, () => {
        siblingDestroyed += 1;
      });

      // A group signal too, so the signal loop runs before the link loop.
      createSignal(0, {attach: host});

      try {
        expect(() => group.clear()).toThrow('link clear boom');

        expect(siblingDestroyed).toBe(1);
        expect(getLinksCount()).toBe(0);
        expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);

        destroySignal(external);
        expect(getSignalsCount()).toBe(0);
      } finally {
        // The group owns both links, so it goes first: destroying the
        // foreign source would tear them down outside of any guard.
        try {
          group.clear();
        } catch {
          /* ignore */
        }
        destroySignal(external);
      }
    });
  });

  describe('the teardown order is part of the contract (TEST-019)', () => {
    it('clear() emits DESTROY before it takes anything apart', () => {
      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      const source = createSignal(1, {attach: obj});
      const target = createSignal(0, {attach: obj});
      const child = SignalGroup.findOrCreate({});

      createEffect(() => source.get(), {attach: obj});
      link(source, target, {attach: obj});

      let calls = 0;
      let seen: ReturnType<typeof getGroupMemberCounts> | undefined;

      try {
        group.attachGroup(child);

        on(group, DESTROY, () => {
          calls += 1;
          seen = getGroupMemberCounts(group);
        });

        group.clear();

        expect(calls, 'the DESTROY listener ran exactly once').toBe(1);
        expect(seen, 'the listener saw the group still intact').toEqual({
          signals: 2,
          namedSignals: 0,
          signalsByName: 0,
          effects: 1,
          links: 1,
          groups: 1,
        });
      } finally {
        group.clear();
        child.clear();
        destroySignal(source, target);
      }
    });

    it('clear() destroys the effects before the signals', () => {
      const obj = {};
      const group = SignalGroup.findOrCreate(obj);
      const source = createSignal(1, {attach: obj});
      const order: string[] = [];

      createEffect(
        () => {
          source.get();
          return () => {
            order.push(`effect cleanup: ${getSignalsCount()} signal(s) alive`);
          };
        },
        {attach: obj},
      );

      try {
        group.clear();

        expect(
          order,
          'the cleanup callback still sees the signal it depended on',
        ).toEqual(['effect cleanup: 1 signal(s) alive']);
      } finally {
        group.clear();
        destroySignal(source);
      }
    });

    it('off() switches the child groups off before its own members', () => {
      const parentObj = {};
      const childObj = {};
      const parent = SignalGroup.findOrCreate(parentObj);
      const child = SignalGroup.findOrCreate(childObj);
      const parentSignal = createSignal(1, {attach: parentObj});
      const childSignal = createSignal(2, {attach: childObj});
      const order: string[] = [];

      createEffect(
        () => {
          parentSignal.get();
          return () => {
            order.push('parent effect');
          };
        },
        {attach: parentObj},
      );

      createEffect(
        () => {
          childSignal.get();
          return () => {
            order.push('child effect');
          };
        },
        {attach: childObj},
      );

      try {
        parent.attachGroup(child);

        parent.off();

        expect(order, 'depth-first: the child goes first').toEqual([
          'child effect',
          'parent effect',
        ]);
      } finally {
        parent.clear();
        child.clear();
        destroySignal(parentSignal, childSignal);
      }
    });
  });
});
