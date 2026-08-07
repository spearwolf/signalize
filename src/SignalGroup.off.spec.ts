import {getSubscriptionCount, on} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './assert-helpers.js';
import {beQuiet} from './bequiet.js';
import {OFF} from './constants.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import {link} from './link.js';
import {SignalGroup} from './SignalGroup.js';

describe('SignalGroup#off()', () => {
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

  it('destroys attached effects and runs their cleanup callbacks', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const sig = createSignal(0, {attach: host});

    let cleanupCalls = 0;
    let runs = 0;
    createEffect(
      () => {
        runs += 1;
        sig.get();
        return () => {
          cleanupCalls += 1;
        };
      },
      {attach: host},
    );

    expect(runs).toBe(1);
    expect(cleanupCalls).toBe(0);

    group.off();

    expect(cleanupCalls).toBe(1);
    assertEffectsCount(0, 'after off');

    // Signal still alive
    sig.set(1);
    expect(sig.value).toBe(1);
    expect(runs).toBe(1); // effect did not rerun — it was destroyed

    group.clear();
  });

  it('destroys attached links', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const source = createSignal(1, {attach: host});

    let received: number | undefined;
    link(
      source,
      (v: number) => {
        received = v;
      },
      {attach: host},
    );

    source.set(2);
    expect(received).toBe(2);

    group.off();

    assertLinksCount(0, 'after off');

    // Link was destroyed: further writes do not propagate.
    source.set(3);
    expect(received).toBe(2);

    group.clear();
  });

  it('signals stay alive and readable/writable after off()', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const sig = createSignal(42, {attach: host});

    group.off();

    assertSignalsCount(1, 'signal alive after off');
    expect(sig.value).toBe(42);
    sig.set(99);
    expect(sig.value).toBe(99);

    group.clear();
    assertSignalsCount(0, 'after clear');
  });

  it('named signal lookup keeps working after off()', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const sig = createSignal(1);
    group.attachSignalByName('foo', sig);

    group.off();

    expect(group.hasSignal('foo')).toBe(true);
    expect(group.signal('foo')).toBe(sig);

    group.clear();
    sig.destroy();
  });

  it('attaching a new effect after off() works and reruns on signal change', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const sig = createSignal(0, {attach: host});

    createEffect(
      () => {
        sig.get();
      },
      {attach: host},
    );
    group.off();
    assertEffectsCount(0, 'after off');

    let runs = 0;
    createEffect(
      () => {
        runs += 1;
        sig.get();
      },
      {attach: host},
    );
    expect(runs).toBe(1);

    sig.set(7);
    expect(runs).toBe(2);

    group.clear();
  });

  it('group remains registered in the store after off()', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    group.off();

    expect(SignalGroup.get(host)).toBe(group);
    expect(SignalGroup.findOrCreate(host)).toBe(group);

    group.clear();
    expect(SignalGroup.get(host)).toBeUndefined();
  });

  it('external effect with only group signal as dep is destroyed by off()', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const sig = createSignal(0, {attach: host});

    let runs = 0;
    let cleanupCalls = 0;
    // Effect is NOT attached to the group
    createEffect(() => {
      runs += 1;
      sig.get();
      return () => {
        cleanupCalls += 1;
      };
    });

    expect(runs).toBe(1);

    group.off();

    expect(cleanupCalls).toBe(1);
    assertEffectsCount(0, 'external effect auto-destroyed');

    group.clear();
  });

  it('external effect is destroyed by off() even after one dep was destroyed first (MEM-006)', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const a = createSignal(0, {attach: host});
    const b = createSignal(0, {attach: host});

    let runs = 0;
    let cleanupCalls = 0;

    // Nicht an die Gruppe attached — der Effect hängt nur über seine
    // Signal-Reads an ihr.
    createEffect(() => {
      runs += 1;
      a.get();
      b.get();
      return () => {
        cleanupCalls += 1;
      };
    });

    expect(runs).toBe(1);

    // Harte Zerstörung zuerst: der Effect behält `a` in #signals, nur
    // unsubscribed. Danach der Soft-Detach über off().
    a.destroy();
    group.off();

    expect(cleanupCalls).toBe(1);
    assertEffectsCount(0, 'after hard destroy then off()');

    group.clear();
  });

  it('external effect with mixed deps survives off(); group signal re-subscribes on rerun', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const groupSig = createSignal(0, {attach: host});
    const otherSig = createSignal(0); // NOT attached

    let runs = 0;
    let lastSeen = 0;
    createEffect(() => {
      runs += 1;
      lastSeen = groupSig.get() + otherSig.get();
    });

    expect(runs).toBe(1);

    group.off();

    // Effect survives — it still has otherSig as a dep
    assertEffectsCount(1, 'mixed-dep effect survives');

    // group signal no longer triggers
    groupSig.set(10);
    expect(runs).toBe(1);

    // external signal still triggers; during the rerun the effect re-reads
    // groupSig and re-subscribes to it
    otherSig.set(5);
    expect(runs).toBe(2);
    expect(lastSeen).toBe(15);

    // now groupSig changes trigger the effect again (re-subscribed)
    groupSig.set(20);
    expect(runs).toBe(3);
    expect(lastSeen).toBe(25);

    group.clear();
    // external effect now has no remaining live deps (groupSig destroyed,
    // otherSig still alive); destroy explicitly via otherSig to clean up.
    otherSig.destroy();
  });

  it('static-deps effect with mixed deps survives off() and re-declares its deps on the next run (BUG-003)', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    const sigQueueBaseline = getSubscriptionCount(globalSignalQueue);

    const groupSig = createSignal(0, {attach: host});
    const otherSig = createSignal(0); // NOT attached

    let runs = 0;
    let lastSeen = 0;
    // Static deps: the reads inside the callback subscribe to nothing —
    // only the two declared signals can ever trigger this effect.
    createEffect(() => {
      runs += 1;
      lastSeen = groupSig.get() + otherSig.get();
    }, [groupSig, otherSig]);

    // Static deps do not auto-run on creation, but they do subscribe.
    expect(runs).toBe(0);
    expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline + 2);

    groupSig.set(1);
    expect(runs).toBe(1);

    group.off();

    assertEffectsCount(1, 'static-deps effect survives off()');
    expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline + 1);

    // The pause holds: the detached signal no longer reaches the effect.
    groupSig.set(10);
    expect(runs).toBe(1);

    // The surviving dependency still does — and that run re-declares the
    // static set, which re-subscribes to the group signal.
    otherSig.set(5);
    expect(runs).toBe(2);
    expect(lastSeen).toBe(15);
    expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline + 2);

    // ... so the group signal triggers it again.
    groupSig.set(20);
    expect(runs).toBe(3);
    expect(lastSeen).toBe(25);

    group.clear();
    otherSig.destroy();
    expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline);
  });

  it('static-deps effect whose only dep is a group signal is still destroyed by off() (BUG-003)', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const sig = createSignal(0, {attach: host});

    let runs = 0;
    let cleanupCalls = 0;
    createEffect(() => {
      runs += 1;
      return () => {
        cleanupCalls += 1;
      };
    }, [sig]);

    sig.set(1);
    expect(runs).toBe(1);

    group.off();

    expect(cleanupCalls).toBe(1);
    assertEffectsCount(0, 'sole static dep detached => effect destroyed');

    // and it stays gone — the detached signal cannot wake it
    sig.set(2);
    expect(runs).toBe(1);

    group.clear();
  });

  it('a static dep destroyed while detached is not re-subscribed on the next run (BUG-003)', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    const sigQueueBaseline = getSubscriptionCount(globalSignalQueue);
    const destroyQueueBaseline = getSubscriptionCount(globalDestroySignalQueue);

    const groupSig = createSignal(0, {attach: host});
    const otherSig = createSignal(0);

    let runs = 0;
    createEffect(() => {
      runs += 1;
    }, [groupSig, otherSig]);

    group.off();

    // The effect dropped its `once` on the destroy queue when it
    // detached, so it never hears this one.
    groupSig.destroy();

    otherSig.set(1);
    expect(runs).toBe(1);

    // The destroyed dependency was skipped — only otherSig is subscribed.
    expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline + 1);

    // ... so losing the last live dependency still ends the effect.
    otherSig.destroy();
    assertEffectsCount(0, 'last live dep destroyed => effect destroyed');
    expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline);
    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      destroyQueueBaseline,
    );

    group.clear();
  });

  it('the re-declaration works inside a beQuiet() frame (BUG-003)', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const groupSig = createSignal(0, {attach: host});
    const otherSig = createSignal(0);

    let runs = 0;
    const eff = createEffect(
      () => {
        runs += 1;
      },
      [groupSig, otherSig],
      {autorun: false},
    );

    group.off();

    groupSig.set(1);
    expect(runs).toBe(0);

    // Flags shouldRun without running (autorun: false), then run the
    // whole thing inside a quiet frame. `whenSignalIsRead()` is not
    // quiet-gated, so the declared set is re-declared here.
    otherSig.set(1);
    beQuiet(() => {
      eff.run();
    });
    expect(runs).toBe(1);

    // The group signal reaches the effect again.
    groupSig.set(2);
    eff.run();
    expect(runs).toBe(2);

    eff.destroy();
    group.clear();
    otherSig.destroy();
  });

  it('re-declares the static deps before the callback, so a throwing rerun still re-subscribes (BUG-003)', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    const sigQueueBaseline = getSubscriptionCount(globalSignalQueue);

    const groupSig = createSignal(0, {attach: host});
    const otherSig = createSignal(0);

    let runs = 0;
    const eff = createEffect(() => {
      runs += 1;
      throw new Error('boom');
    }, [groupSig, otherSig]);

    expect(() => groupSig.set(1)).toThrow('boom');
    expect(runs).toBe(1);

    group.off();
    expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline + 1);

    // The rerun fails again — and a deterministically failing callback never
    // has a successful run to heal on. The re-declaration therefore has to
    // happen *before* the callback: moving it behind the call re-opens
    // BUG-003 for every effect in this shape, with all other tests still
    // green.
    expect(() => otherSig.set(1)).toThrow('boom');
    expect(runs).toBe(2);
    expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline + 2);

    // ... so the detached signal reaches the effect again.
    expect(() => groupSig.set(2)).toThrow('boom');
    expect(runs).toBe(3);

    eff.destroy();
    group.clear();
    otherSig.destroy();
    expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline);
  });

  it('external link sourced from a group signal is destroyed by off()', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const source = createSignal(1, {attach: host});

    let received: number | undefined;
    link(source, (v: number) => {
      received = v;
    });

    source.set(2);
    expect(received).toBe(2);

    group.off();

    assertLinksCount(0, 'external link destroyed');

    source.set(3);
    expect(received).toBe(2);

    group.clear();
  });

  it('is idempotent — calling off() twice does not throw', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const sig = createSignal(0, {attach: host});
    createEffect(
      () => {
        sig.get();
      },
      {attach: host},
    );

    expect(() => {
      group.off();
      group.off();
    }).not.toThrow();

    assertEffectsCount(0);
    assertSignalsCount(1);

    group.clear();
  });

  it('recurses into child groups', () => {
    const parentHost = {};
    const childHost = {};
    const parent = SignalGroup.findOrCreate(parentHost);
    const child = SignalGroup.findOrCreate(childHost);
    parent.attachGroup(child);

    const parentSig = createSignal(0, {attach: parentHost});
    const childSig = createSignal(0, {attach: childHost});

    let parentRuns = 0;
    let childRuns = 0;
    createEffect(
      () => {
        parentRuns += 1;
        parentSig.get();
      },
      {attach: parentHost},
    );
    createEffect(
      () => {
        childRuns += 1;
        childSig.get();
      },
      {attach: childHost},
    );

    parent.off();

    assertEffectsCount(0, 'both effects destroyed');
    expect(parentSig.value).toBe(0);
    expect(childSig.value).toBe(0);

    // signals in both groups stay alive
    parentSig.set(1);
    childSig.set(1);
    expect(parentRuns).toBe(1);
    expect(childRuns).toBe(1);

    parent.clear();
  });

  it('emits an OFF event on the group', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    let offEmits = 0;
    on(group, OFF, () => {
      offEmits += 1;
    });

    group.off();
    expect(offEmits).toBe(1);

    group.off();
    expect(offEmits).toBe(2);

    group.clear();
  });

  it('restores subscription baselines on the global signal queues', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);

    const sigQueueBaseline = getSubscriptionCount(globalSignalQueue);
    const destroyQueueBaseline = getSubscriptionCount(globalDestroySignalQueue);

    const sig = createSignal(0, {attach: host});
    createEffect(
      () => {
        sig.get();
      },
      {attach: host},
    );
    link(sig, () => {}, {attach: host});

    expect(getSubscriptionCount(globalSignalQueue)).toBeGreaterThan(
      sigQueueBaseline,
    );
    expect(getSubscriptionCount(globalDestroySignalQueue)).toBeGreaterThan(
      destroyQueueBaseline,
    );

    group.off();

    // The effect's and the link's subscriptions are gone, and the signal
    // itself doesn't keep a subscription on its own id.
    expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline);

    // One subscription survives `off()` by design (MEM-002): the group's own
    // destroy hook for `sig`. `off()` keeps the signal attached and the group
    // reusable, so the group must still hear about that signal being
    // destroyed later — otherwise a dead SignalImpl would sit in `#signals`
    // until `clear()`. It is released together with the signal.
    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      destroyQueueBaseline + 1,
    );

    group.clear();

    expect(getSubscriptionCount(globalSignalQueue)).toBe(sigQueueBaseline);
    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      destroyQueueBaseline,
    );
  });

  it('off() then clear() leaves no leaks', () => {
    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const sig = createSignal(0, {attach: host});
    createEffect(
      () => {
        sig.get();
      },
      {attach: host},
    );
    link(sig, () => {}, {attach: host});

    group.off();
    assertSignalsCount(1, 'signal alive after off');
    assertEffectsCount(0);
    assertLinksCount(0);

    group.clear();
    assertSignalsCount(0, 'signal destroyed after clear');
  });
});
