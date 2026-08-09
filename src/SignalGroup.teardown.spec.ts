import {getSubscriptionCount, on} from '@spearwolf/eventize';
import type {MockInstance} from 'vitest';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
  getGroupMemberCounts,
  NO_GROUP_MEMBERS,
} from './assert-helpers.js';
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

    expect(getSignalGroupsCount()).toBe(groupsBefore + 1);

    expect(() => {
      group.clear();
    }).toThrow('cleanup boom');

    expect(siblingCleanupCalls, 'sibling cleanup must still run').toBe(1);
    expect(getEffectsCount(), 'effects after clear').toBe(effectsBefore);
    expect(getSignalsCount(), 'signals after clear').toBe(signalsBefore);
    expect(getLinksCount(), 'links after clear').toBe(linksBefore);
    expect(getSignalGroupsCount(), 'groups after clear').toBe(groupsBefore);
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

    expect(() => {
      group.off();
    }).toThrow('cleanup boom');

    expect(getEffectsCount(), 'effects after off').toBe(effectsBefore);
    expect(getLinksCount(), 'links after off').toBe(linksBefore);
    expect(offEvents, 'OFF must be emitted exactly once').toBe(1);

    // The signal survives `off()` — the group stays reusable.
    expect(sig.value).toBe(0);

    group.clear();
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

    let caught: unknown;
    try {
      groupA.clear();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors).toEqual([errA, errB]);

    // A lone failure is rethrown as-is, not wrapped.
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

    let caughtSingle: unknown;
    try {
      groupB.clear();
    } catch (err) {
      caughtSingle = err;
    }

    expect(caughtSingle).toBe(errC);
  });

  it('drops destroyed effects and signals from the group by itself', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    for (let i = 0; i < 50; i += 1) {
      createEffect(() => {}, {attach: host}).destroy();
    }

    for (let i = 0; i < 50; i += 1) {
      destroySignal(createSignal(i, {attach: host}));
    }

    expect(getEffectsCount(), 'no effect survives').toBe(0);
    expect(getSignalsCount(), 'no signal survives').toBe(0);

    expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);

    group.clear();
  });

  it('drops a hard-destroyed signal from its name bindings too', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    const names: string[] = [];

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

    group.clear();
  });

  it('promotes the remaining candidate when a destroyed signal vacates a name', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    const first = createSignal(1);
    const second = createSignal(2);

    group.attachSignalByName('slot', first);
    group.attachSignal(first); // keeps `first` alive across the rebind
    group.attachSignalByName('slot', second);

    expect(group.signal('slot')).toBe(second);

    destroySignal(second);

    // `first` is still listed under the name, so it takes the slot back —
    // the same fallback `detachSignal()` applies.
    expect(group.hasSignal('slot')).toBe(true);
    expect(group.signal('slot')).toBe(first);

    group.clear();
  });

  it('drops a hard-destroyed @signal accessor from its host group', () => {
    class Host {
      @signal() accessor foo = 23;
    }

    const host = new Host();
    const group = SignalGroup.findOrCreate(host);

    expect(group.hasSignal('foo')).toBe(true);
    expect(host.foo).toBe(23);

    destroySignal(findObjectSignalByName(host, 'foo'));

    expect(group.hasSignal('foo'), 'the name must be unbound').toBe(false);
    expect(group.signal('foo')).toBeUndefined();
    expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);

    group.clear();
  });

  it('detachSignal() restores the destroy-queue subscription baseline', () => {
    const baseline = getSubscriptionCount(globalDestroySignalQueue);

    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const sig = createSignal(1, {attach: host});

    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline + 1);

    group.detachSignal(sig);

    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline);

    destroySignal(sig);
    group.clear();

    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline);
  });

  it('releasing a name restores the destroy-queue subscription baseline', () => {
    const baseline = getSubscriptionCount(globalDestroySignalQueue);

    const host = {};
    const group = SignalGroup.findOrCreate(host);

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

    SignalGroup.clear();

    clearGroupFromFinalizer(groupB);

    expect(
      getGroupMemberCounts(groupB),
      'the backstop must still find the group registered',
    ).toEqual(NO_GROUP_MEMBERS);
    expect(getSignalsCount()).toBe(signalsBefore);
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
    } finally {
      errorSpy.mockRestore();
    }

    expect(siblingCleanupCalls, 'sibling cleanup must still run').toBe(1);
    expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
    expect(getSignalGroupsCount(), 'groups after the finalizer').toBe(
      groupsBefore,
    );
    expect(getEffectsCount()).toBe(effectsBefore);
    expect(getSignalsCount()).toBe(signalsBefore);
    expect(getLinksCount()).toBe(linksBefore);
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

      expect(() => parent.off()).toThrow('child off boom');

      expect(cleanupCalls).toBe(1);
      expect(getEffectsCount()).toBe(0);

      parent.clear();
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

      expect(() => group.off()).toThrow('link teardown boom');

      expect(siblingDestroyed).toBe(1);
      expect(sibling.isDestroyed).toBe(true);
      expect(getLinksCount()).toBe(0);

      group.clear();
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
        unsubscribeFirst();
        unsubscribeSecond();
      }

      group.clear();
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

      expect(() => group.off()).toThrow('off listener boom');

      expect(cleanupCalls).toBe(1);
      expect(getEffectsCount()).toBe(0);
      expect(getLinksCount()).toBe(0);
      expect(sig.value).toBe(0);

      group.clear();
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

      expect(() => group.clear()).toThrow('destroy listener boom');

      expect(cleanupCalls).toBe(1);
      expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
      expect(getEffectsCount()).toBe(0);
      expect(getSignalsCount()).toBe(0);
      expect(getLinksCount()).toBe(0);
      expect(getSignalGroupsCount()).toBe(groupsBefore);
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

      expect(() => parent.clear()).toThrow('child destroy boom');

      expect(cleanupCalls).toBe(1);
      expect(getGroupMemberCounts(parent)).toEqual(NO_GROUP_MEMBERS);
      expect(getGroupMemberCounts(child)).toEqual(NO_GROUP_MEMBERS);
      expect(getSignalsCount()).toBe(0);
      expect(getSignalGroupsCount()).toBe(groupsBefore);
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

      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroyQueueBaseline + 3,
      );

      try {
        expect(() => group.clear()).toThrow('destroy queue boom');
        expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
          destroyQueueBaseline + 1,
        );
      } finally {
        unsubscribeBoom();
      }

      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroyQueueBaseline,
      );
      expect(getSignalsCount()).toBe(0);
      expect(signalImpl(second).destroyed).toBe(true);
      expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);
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

      expect(() => group.clear()).toThrow('link clear boom');

      expect(siblingDestroyed).toBe(1);
      expect(getLinksCount()).toBe(0);
      expect(getGroupMemberCounts(group)).toEqual(NO_GROUP_MEMBERS);

      destroySignal(external);
      expect(getSignalsCount()).toBe(0);
    });
  });
});
