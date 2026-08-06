import {getSubscriptionCount, Priority} from '@spearwolf/eventize';
import {createMemo} from './createMemo.js';
import {createSignal} from './createSignal.js';
import {createEffect, getEffectsCount, onCreateEffect} from './effects.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {SignalGroup} from './SignalGroup.js';
import {destroySignal, getSignalsCount} from './signal-core.js';

describe('createMemo', () => {
  it('non-lazy by default', () => {
    const {get: firstName, set: setFirstName} = createSignal<string>();
    const {get: lastName, set: setLastName} = createSignal<string>();

    let memoCallCount = 0;

    const fullName = createMemo(() => {
      ++memoCallCount;
      const first = firstName() ?? '';
      return lastName() ? `${first} ${lastName()}` : first;
    });

    expect(fullName()).toBe('');

    expect(memoCallCount).toBe(1);

    setFirstName('Spearwolf');

    expect(memoCallCount).toBe(2);

    expect(fullName()).toBe('Spearwolf');

    expect(memoCallCount).toBe(2);

    setLastName('Overlord');

    expect(memoCallCount).toBe(3);

    expect(fullName()).toBe('Spearwolf Overlord');

    for (let i = 0; i < 10; ++i) {
      fullName();
    }

    expect(memoCallCount).toBe(3);
  });

  it('lazy memo works as expected', () => {
    const {get: firstName, set: setFirstName} = createSignal<string>();
    const {get: lastName, set: setLastName} = createSignal<string>();

    let memoCallCount = 0;

    const fullName = createMemo(
      () => {
        ++memoCallCount;
        const first = firstName() ?? '';
        return lastName() ? `${first} ${lastName()}` : first;
      },
      {lazy: true},
    );

    expect(fullName()).toBe('');

    expect(memoCallCount).toBe(1);

    setFirstName('Spearwolf');

    expect(memoCallCount).toBe(1);

    expect(fullName()).toBe('Spearwolf');

    expect(memoCallCount).toBe(2);

    setLastName('Overlord');

    expect(memoCallCount).toBe(2);

    expect(fullName()).toBe('Spearwolf Overlord');

    for (let i = 0; i < 10; ++i) {
      fullName();
    }

    expect(memoCallCount).toBe(3);
  });

  describe('memo signal lifecycle inside an effect body (MEM-005)', () => {
    it('destroys the internal memo signal on every rerun instead of leaking it (Probe P)', () => {
      const trigger = createSignal(0);
      const src = createSignal(1);

      const signalsBeforeFirstRun = getSignalsCount();

      const outer = createEffect(() => {
        trigger.get();
        createMemo(() => src.get() * 2)();
      });

      const signalsAfterFirstRun = getSignalsCount();
      const effectsAfterFirstRun = getEffectsCount();
      expect(signalsAfterFirstRun).toBe(signalsBeforeFirstRun + 1);

      for (let i = 1; i <= 10; i++) {
        trigger.set(i);
      }

      expect(
        getSignalsCount(),
        'signal count must stay constant over 10 reruns',
      ).toBe(signalsAfterFirstRun);
      expect(
        getEffectsCount(),
        'effect count must stay constant over 10 reruns (MEM-001)',
      ).toBe(effectsAfterFirstRun);

      outer.destroy();

      expect(getSignalsCount()).toBe(signalsBeforeFirstRun);

      destroySignal(trigger, src);
    });

    it('does not leak the once subscription on globalDestroySignalQueue', () => {
      const destroySubscriptionsBefore = getSubscriptionCount(
        globalDestroySignalQueue,
      );

      const trigger = createSignal(0);
      const src = createSignal(1);

      const outer = createEffect(() => {
        trigger.get();
        createMemo(() => src.get() * 2)();
      });

      for (let i = 1; i <= 5; i++) {
        trigger.set(i);
      }

      outer.destroy();
      destroySignal(trigger, src);

      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroySubscriptionsBefore,
      );
    });

    it('a memo already attached to a group is destroyed once, by the group, not by the MEM-005 hook', () => {
      // {attach} takes the signal out of the MEM-005 hook entirely (the
      // group owns its lifetime instead) — group.clear() must still be the
      // one and only thing that destroys it, with no double-counting.
      const host = {};
      const group = SignalGroup.findOrCreate(host);
      const signalsBefore = getSignalsCount();

      const fortyTwo = createMemo(() => 42, {attach: group});

      expect(fortyTwo()).toBe(42);
      expect(getSignalsCount()).toBe(signalsBefore + 1);

      expect(() => group.clear()).not.toThrow();

      expect(getSignalsCount()).toBe(signalsBefore);
    });

    it('a memo created outside any effect body survives its dependencies being destroyed', () => {
      // Regression guard: an earlier version of the MEM-005 fix hooked
      // *every* memo's signal to its internal effect's DESTROY, not just the
      // ones created inside another effect's body. That broke this — the
      // memo's own effect self-destroys via EffectImpl[$destroySignal] once
      // its last tracked dependency is gone, and the over-eager hook then
      // took the memo signal down with it, cascading into any downstream
      // effect that depended on the memo.
      const a = createSignal(1);
      const b = createSignal(2);

      const sum = createMemo(() => a.get() + b.get());
      expect(sum()).toBe(3);

      const downstreamRuns = vi.fn();
      const downstream = createEffect(() => {
        downstreamRuns(sum());
      });
      expect(downstreamRuns).toHaveBeenCalledTimes(1);
      expect(downstreamRuns).toHaveBeenLastCalledWith(3);

      const signalsBeforeDepsDestroyed = getSignalsCount();
      const effectsBeforeDepsDestroyed = getEffectsCount();

      destroySignal(a, b);

      expect(
        getSignalsCount(),
        'a and b are gone, the memo signal is not — it was not created inside an effect body',
      ).toBe(signalsBeforeDepsDestroyed - 2);
      expect(
        getEffectsCount(),
        "only the memo's own effect dies here (its last dependency is gone) — the downstream effect must survive, not be swept along as collateral damage",
      ).toBe(effectsBeforeDepsDestroyed - 1);
      expect(sum(), 'reads the frozen last value').toBe(3);

      downstream.destroy();
      destroySignal(sum);
    });

    it('a memo attached to a group with real dependencies survives SignalGroup#off()', () => {
      // Regression guard for the same over-eager hook, on the off()/clear()
      // side: off() promises attached signals stay alive and the group
      // remains reusable. An attach-scoped memo whose internal effect dies
      // in off()'s effect-teardown loop must not take the signal with it.
      const a = createSignal(1);
      const host = {};
      const group = SignalGroup.findOrCreate(host);

      const doubled = createMemo(() => a.get() * 2, {
        attach: group,
        name: 'doubled',
      });
      expect(doubled()).toBe(2);

      const signalsBeforeOff = getSignalsCount();

      expect(() => group.off()).not.toThrow();

      expect(getSignalsCount(), 'off() must not destroy attached signals').toBe(
        signalsBeforeOff,
      );
      expect(doubled(), 'the signal is still readable').toBe(2);
      expect(
        group.signal('doubled'),
        'still resolvable by name — the group remains reusable',
      ).toBeDefined();

      group.clear();
      destroySignal(a);
    });

    it('destroys the memo signal even if its effect died during its own creation (K1)', () => {
      // A memo's internal effect can be destroyed before createEffect() ever
      // returns control to createMemo() — e.g. an onCreateEffect() handler
      // that reaches for effect.destroy() synchronously. DESTROY has then
      // already been emitted once by the time createMemo() gets a chance to
      // subscribe, so a plain `once(effect, DESTROY, cb)` registered
      // afterwards would never fire and the signal would leak silently.
      const trigger = createSignal(0);

      const unsubscribe = onCreateEffect((effect) => {
        if (effect.priority === Priority.C) {
          effect.destroy();
        }
      });

      const signalsBefore = getSignalsCount();

      const outer = createEffect(() => {
        trigger.get();
        createMemo(() => 42);
      });

      unsubscribe();

      expect(
        getSignalsCount(),
        'the memo signal must not be leaked even though its own effect was already destroyed before this wrapper could subscribe to it',
      ).toBe(signalsBefore);

      outer.destroy();
      destroySignal(trigger);
    });

    it('an effect whose only dependency is a self-created memo keeps rerunning (K2)', () => {
      // The memo signal is the *only* thing the outer effect reads. Tearing
      // the memo down on rerun therefore empties the outer effect's
      // dependency set for a moment — mid-run, while it is rebuilding it.
      // That moment must not be mistaken for "nothing can ever trigger me
      // again" and make the effect destroy itself from inside its own run().
      const a = createSignal(1);
      const seen: number[] = [];

      const signalsBefore = getSignalsCount();
      const effectsBefore = getEffectsCount();

      const outer = createEffect(() => {
        const total = createMemo(() => a.get() * 2);
        seen.push(total());
      });

      expect(seen).toEqual([2]);

      a.set(5);

      expect(seen, 'the outer effect must rerun on the first change').toEqual([
        2, 10,
      ]);

      a.set(7);

      expect(seen, 'and on every change after that').toEqual([2, 10, 14]);

      expect(getSignalsCount(), 'no signal leaks across the reruns').toBe(
        signalsBefore + 1, // only the current memo signal
      );
      expect(getEffectsCount(), 'no zombie effect is left behind').toBe(
        effectsBefore + 2, // the outer effect and the current memo effect
      );

      outer.destroy();

      expect(getSignalsCount()).toBe(signalsBefore);
      expect(getEffectsCount()).toBe(effectsBefore);

      destroySignal(a);
    });

    it('a memo created with {attach} inside an effect body survives SignalGroup#off()', () => {
      // Covers the `group == null` half of the MEM-005 guard: with `{attach}`
      // the group owns the signal, so the hook must stay off even though a
      // parent effect is on the stack. off() promises attached signals stay
      // alive and the group remains reusable.
      const a = createSignal(1);
      const host = {};
      const group = SignalGroup.findOrCreate(host);

      let attached!: () => number;

      const outer = createEffect(() => {
        attached = createMemo(() => a.get() * 2, {
          attach: group,
          name: 'doubled',
        });
      });

      expect(attached()).toBe(2);

      const signalsBeforeOff = getSignalsCount();

      expect(() => group.off()).not.toThrow();

      expect(
        getSignalsCount(),
        'off() must not destroy a signal the group owns, not the parent effect',
      ).toBe(signalsBeforeOff);
      expect(attached(), 'the signal is still readable').toBe(2);
      expect(
        group.signal('doubled'),
        'still resolvable by name — the group remains reusable',
      ).toBeDefined();

      outer.destroy();
      group.clear();
      destroySignal(a);
    });

    it('a memo reader that escapes the effect body freezes at its last value', () => {
      const trigger = createSignal(0);
      const src = createSignal(1);

      let escaped!: () => number;

      const outer = createEffect(() => {
        trigger.get();
        escaped = createMemo(() => src.get() * 2);
      });

      expect(escaped()).toBe(2);

      const signalsBeforeDestroy = getSignalsCount();

      outer.destroy();

      expect(
        getSignalsCount(),
        'the memo signal dies with the effect that created it',
      ).toBe(signalsBeforeDestroy - 1);

      src.set(100); // the memo effect is gone, no recompute can happen

      expect(
        escaped(),
        'the escaped reader keeps returning the last computed value',
      ).toBe(2);

      destroySignal(trigger, src);
    });
  });
});
