import {getSubscriptionCount} from '@spearwolf/eventize';
import {assertEffectsCount} from './__testing__/assert-helpers.js';
import {$effect} from './constants.js';
import {createSignal} from './createSignal.js';
import {createEffect, getEffectsCount} from './effects.js';
import {
  globalDestroySignalQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './global-queues.js';
import {getCurrentEffect} from './globalEffectStack.js';
import {hibernate} from './hibernate.js';
import {destroySignal} from './signal-core.js';

describe('nested effects inside a static-deps effect', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
  });

  it('does not leak an orphaned child effect per rerun (MEM-001)', () => {
    const a = createSignal(0);
    const trigger = createSignal(0);

    const outer = createEffect(() => {
      createEffect(() => a.get());
    }, [trigger.get]);

    outer.run();

    const countAfterFirstRun = getEffectsCount();

    for (let i = 1; i <= 5; i++) {
      trigger.set(i);
    }

    expect(
      getEffectsCount(),
      'effects count must stay constant over 5 reruns',
    ).toBe(countAfterFirstRun);

    outer.destroy();
    destroySignal(a, trigger);
  });

  it('destroys the child effect when the parent is destroyed (MEM-001)', () => {
    const signalSubscriptionsBefore = getSubscriptionCount(globalSignalQueue);
    const effectSubscriptionsBefore = getSubscriptionCount(globalEffectQueue);
    const destroySubscriptionsBefore = getSubscriptionCount(
      globalDestroySignalQueue,
    );

    const a = createSignal(0);
    const trigger = createSignal(0);

    const childCleanup = vi.fn();
    const childRuns = vi.fn();

    const outer = createEffect(() => {
      createEffect(() => {
        childRuns(a.get());
        return childCleanup;
      });
    }, [trigger.get]);

    outer.run();

    expect(childRuns).toHaveBeenCalledTimes(1);
    expect(getEffectsCount()).toBe(2);

    trigger.set(1);

    expect(
      childCleanup,
      'child cleanup runs before the parent reruns',
    ).toHaveBeenCalledTimes(1);
    expect(childRuns).toHaveBeenCalledTimes(2);
    expect(getEffectsCount()).toBe(2);

    outer.destroy();

    expect(childCleanup).toHaveBeenCalledTimes(2);
    expect(getEffectsCount()).toBe(0);

    destroySignal(a, trigger);

    expect(getSubscriptionCount(globalSignalQueue)).toBe(
      signalSubscriptionsBefore,
    );
    expect(getSubscriptionCount(globalEffectQueue)).toBe(
      effectSubscriptionsBefore,
    );
    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      destroySubscriptionsBefore,
    );
  });

  it('still does not auto-track signals read in the callback (pitfall 7)', () => {
    const a = createSignal(0);
    const trigger = createSignal(0);

    const runs = vi.fn();

    const outer = createEffect(() => {
      runs(a.get());
    }, [trigger.get]);

    outer.run();
    expect(runs).toHaveBeenCalledTimes(1);

    a.set(1);
    expect(runs, 'a is read but not a dependency').toHaveBeenCalledTimes(1);

    trigger.set(1);
    expect(runs).toHaveBeenCalledTimes(2);

    outer.destroy();
    destroySignal(a, trigger);
  });

  it('keeps auto-tracking off after a re-entrant run returns (pitfall 7)', () => {
    // The suppression flag is saved and restored, not cleared. An effect that
    // writes its own dependency re-enters run(); when the inner run unwinds it
    // must hand the outer callback back its suppressed state. Restoring `false`
    // instead would silently re-arm subscribe-on-read for the rest of the outer
    // callback — and only for the part after the write, which is exactly the
    // kind of half-tracking nobody would ever debug.
    const a = createSignal(0);
    const trigger = createSignal(0);

    const runs = vi.fn();

    const outer = createEffect(() => {
      const n = trigger.value;
      if (n < 1) {
        trigger.set(1); // re-enters run() synchronously
      }
      runs(a.get()); // read *after* the inner run returned
    }, [trigger.get]);

    outer.run();

    expect(runs, 'outer run plus the re-entrant one').toHaveBeenCalledTimes(2);

    a.set(99);

    expect(
      runs,
      'a was read after the re-entrant run — still must not be a dependency',
    ).toHaveBeenCalledTimes(2);

    trigger.set(2);
    expect(runs).toHaveBeenCalledTimes(3);

    outer.destroy();
    destroySignal(a, trigger);
  });

  it('a dynamic child under a static-deps parent tracks its own signals', () => {
    // The suppression is per instance, not global: the parent is deaf to signal
    // reads while its callback runs, the child it spawns is not.
    const a = createSignal(0);
    const trigger = createSignal(0);

    const childRuns = vi.fn();

    const outer = createEffect(() => {
      createEffect(() => {
        childRuns(a.get());
      });
    }, [trigger.get]);

    outer.run();
    expect(childRuns).toHaveBeenCalledTimes(1);

    a.set(1);
    expect(
      childRuns,
      'the child subscribed to a on its own',
    ).toHaveBeenCalledTimes(2);
    expect(childRuns).toHaveBeenLastCalledWith(1);

    trigger.set(1); // parent reruns → child destroyed and rebuilt
    expect(childRuns).toHaveBeenCalledTimes(3);

    a.set(2);
    expect(childRuns, 'the fresh child tracks a as well').toHaveBeenCalledTimes(
      4,
    );
    expect(childRuns).toHaveBeenLastCalledWith(2);

    outer.destroy();

    a.set(3);
    expect(childRuns, 'no child outlives the parent').toHaveBeenCalledTimes(4);

    destroySignal(a, trigger);
  });

  it('creates a fresh child effect instance on every rerun (IMP-001)', () => {
    const a = createSignal(0);
    const trigger = createSignal(0);

    const childIds: symbol[] = [];

    const outer = createEffect(() => {
      const child = createEffect(() => a.get());
      childIds.push(child[$effect]!.id);
    }, [trigger.get]);

    outer.run();

    for (let i = 1; i <= 4; i++) {
      trigger.set(i);
    }

    expect(childIds).toHaveLength(5);
    expect(new Set(childIds).size, 'every rerun creates a new child').toBe(5);

    outer.destroy();
    destroySignal(a, trigger);
  });

  it('counter-probe: dynamic deps stay stable over 5 reruns', () => {
    const a = createSignal(0);
    const trigger = createSignal(0);

    const outer = createEffect(() => {
      trigger.get();
      createEffect(() => a.get());
    });

    const countAfterFirstRun = getEffectsCount();

    for (let i = 1; i <= 5; i++) {
      trigger.set(i);
    }

    expect(getEffectsCount()).toBe(countAfterFirstRun);

    outer.destroy();
    destroySignal(a, trigger);
  });

  it('hibernate() still detaches an effect from its static-deps parent', () => {
    const a = createSignal(0);
    const trigger = createSignal(0);

    let escaped!: ReturnType<typeof createEffect>;

    const outer = createEffect(() => {
      hibernate(() => {
        expect(
          getCurrentEffect(),
          'hibernate clears the stack',
        ).toBeUndefined();
        escaped ??= createEffect(() => a.get());
      });
    }, [trigger.get]);

    outer.run();
    outer.destroy();

    expect(
      getEffectsCount(),
      'an effect created under hibernate() outlives the parent',
    ).toBe(1);

    escaped.destroy();
    destroySignal(a, trigger);
  });

  it('Signal.onChange callbacks no longer orphan nested effects (MEM-001)', () => {
    const a = createSignal(0);
    const trigger = createSignal(0);

    const unsubscribe = trigger.onChange(() => {
      createEffect(() => a.get());
    });

    for (let i = 1; i <= 5; i++) {
      trigger.set(i);
    }

    expect(getEffectsCount(), 'one onChange effect + one child').toBe(2);

    unsubscribe();
    destroySignal(a, trigger);
  });
});
