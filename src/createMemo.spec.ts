import {getSubscriptionCount, Priority} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
  getGroupMemberCounts,
} from './__testing__/assert-helpers.js';
import {createMemo} from './createMemo.js';
import {createSignal} from './createSignal.js';
import type {Effect} from './Effect.js';
import type {EffectImpl} from './EffectImpl.js';
import {createEffect, getEffectsCount, onCreateEffect} from './effects.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {SignalGroup} from './SignalGroup.js';
import {destroySignal, getSignalsCount, signalImpl} from './signal-core.js';
import type {SignalReader} from './types.js';

describe('createMemo', () => {
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

  it('non-lazy by default', () => {
    const {get: firstName, set: setFirstName} = createSignal<string>();
    const {get: lastName, set: setLastName} = createSignal<string>();

    let memoCallCount = 0;

    const fullName = createMemo(() => {
      ++memoCallCount;
      const first = firstName() ?? '';
      return lastName() ? `${first} ${lastName()}` : first;
    });

    try {
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
    } finally {
      // destroySignal() on the memo reader takes its internal effect with it.
      destroySignal(fullName, firstName, lastName);
    }
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

    try {
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
    } finally {
      destroySignal(fullName, firstName, lastName);
    }
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

      try {
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
      } finally {
        outer.destroy();
        destroySignal(trigger, src);
      }
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

      try {
        for (let i = 1; i <= 5; i++) {
          trigger.set(i);
        }

        outer.destroy();
        destroySignal(trigger, src);

        expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
          destroySubscriptionsBefore,
        );
      } finally {
        outer.destroy();
        destroySignal(trigger, src);
      }
    });

    it('a memo attached to a group outside any effect body is destroyed once, by the group', () => {
      // This memo is created outside any effect body, so the MEM-005/
      // MEM-008 lifetime hook never applies to it — it stays entirely a
      // group affair. group.clear() must still be the one and only thing
      // that destroys it, with no double-counting.
      const host = {};
      const group = SignalGroup.findOrCreate(host);
      const signalsBefore = getSignalsCount();

      const fortyTwo = createMemo(() => 42, {attach: group});

      try {
        expect(fortyTwo()).toBe(42);
        expect(getSignalsCount()).toBe(signalsBefore + 1);

        expect(() => group.clear()).not.toThrow();

        expect(getSignalsCount()).toBe(signalsBefore);
      } finally {
        destroySignal(fortyTwo);
        group.clear();
      }
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

      // The downstream effect must not exist yet when `sum()` is read for the
      // first time, so its handle is declared here and assigned inside.
      const downstreamRuns = vi.fn();
      let downstream: Effect;

      try {
        expect(sum()).toBe(3);

        downstream = createEffect(() => {
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
      } finally {
        downstream?.destroy();
        destroySignal(sum, a, b);
      }
    });

    it('a memo attached to a group with real dependencies survives SignalGroup#off()', () => {
      // The line that decides whether {attach} saves a signal from off() is
      // not {attach} itself, it is whether an effect was on the stack when
      // the memo was created. This memo is created outside any effect body,
      // so the group — not a parent effect — owns its lifetime, and off()
      // must not take it down.
      const a = createSignal(1);
      const host = {};
      const group = SignalGroup.findOrCreate(host);

      const doubled = createMemo(() => a.get() * 2, {
        attach: group,
        name: 'doubled',
      });
      try {
        expect(doubled()).toBe(2);

        const signalsBeforeOff = getSignalsCount();

        expect(() => group.off()).not.toThrow();

        expect(
          getSignalsCount(),
          'off() must not destroy attached signals',
        ).toBe(signalsBeforeOff);
        expect(doubled(), 'the signal is still readable').toBe(2);
        expect(
          group.signal('doubled'),
          'still resolvable by name — the group remains reusable',
        ).toBeDefined();
      } finally {
        destroySignal(doubled, a);
        group.clear();
      }
    });

    it('destroys the memo signal even if its effect died during its own creation (K1)', () => {
      // A memo's internal effect can be destroyed before createEffect() ever
      // returns control to createMemo() — e.g. an onCreateEffect() handler
      // that reaches for effect.destroy() synchronously. DESTROY has then
      // already been emitted once by the time createMemo() gets a chance to
      // subscribe, so a plain `once(effect, DESTROY, cb)` registered
      // afterwards would never fire and the signal would leak silently.
      const trigger = createSignal(0);

      const unsubscribe = onCreateEffect((effect: EffectImpl) => {
        if (effect.priority === Priority.C) {
          effect.destroy();
        }
      });

      const signalsBefore = getSignalsCount();

      const outer = createEffect(() => {
        trigger.get();
        createMemo(() => 42);
      });

      try {
        unsubscribe();

        expect(
          getSignalsCount(),
          'the memo signal must not be leaked even though its own effect was already destroyed before this wrapper could subscribe to it',
        ).toBe(signalsBefore);

        outer.destroy();
      } finally {
        // The onCreateEffect() handler is global: leaving it registered would
        // destroy every Priority.C effect of every later test in this file.
        unsubscribe();
        outer.destroy();
        destroySignal(trigger);
      }
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

      try {
        expect(seen).toEqual([2]);

        a.set(5);

        expect(seen, 'the outer effect must rerun on the first change').toEqual(
          [2, 10],
        );

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
      } finally {
        outer.destroy();
        destroySignal(a);
      }
    });

    it('a memo created with {attach} inside an effect body is destroyed on the parent rerun instead of piling up in the group (MEM-008)', () => {
      const host = {};
      const group = SignalGroup.findOrCreate(host);
      const trigger = createSignal(0);
      const src = createSignal(1);

      const signalsBefore = getSignalsCount();
      const destroySubscriptionsBefore = getSubscriptionCount(
        globalDestroySignalQueue,
      );

      const outer = createEffect(() => {
        trigger.get();
        createMemo(() => src.get() * 2, {attach: host});
      });

      try {
        expect(getGroupMemberCounts(group).signals).toBe(1);

        for (let i = 1; i <= 10; i++) {
          trigger.set(i);
        }

        expect(
          getGroupMemberCounts(group).signals,
          'one memo signal per group, not one per parent rerun',
        ).toBe(1);
        expect(getGroupMemberCounts(group).effects).toBe(1);
        expect(getSignalsCount(), 'trigger, src and the current memo').toBe(
          signalsBefore + 1,
        );
        expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
          destroySubscriptionsBefore + 4,
        );

        outer.destroy();

        expect(
          getGroupMemberCounts(group).signals,
          'the last memo signal dies with the effect that created it',
        ).toBe(0);

        group.clear();
        destroySignal(trigger, src);

        expect(getSignalsCount()).toBe(signalsBefore - 2);
        expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
          destroySubscriptionsBefore,
        );
      } finally {
        outer.destroy();
        destroySignal(trigger, src);
        group.clear();
      }
    });

    it('a memo created with {attach} inside an effect body dies with the effect that created it, not with the group (MEM-008)', () => {
      // {attach} gives a memo signal a group membership and, optionally, a
      // name — it does not take a memo created inside an effect body out of
      // that effect's ownership. The internal effect still dies as a child
      // effect on every parent rerun and on parent destroy(); off() reaches
      // that same child effect when it tears down the group's effects, so
      // this signal goes with it too.
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

      try {
        expect(attached()).toBe(2);

        const signalsBeforeOff = getSignalsCount();

        expect(() => group.off()).not.toThrow();

        expect(
          getSignalsCount(),
          'off() destroys the group effects, and this memo signal belongs to its effect',
        ).toBe(signalsBeforeOff - 1);
        expect(
          attached(),
          'the escaped reader keeps handing out the last computed value',
        ).toBe(2);
        expect(
          group.signal('doubled'),
          'a hard-destroyed signal loses its name (MEM-002)',
        ).toBeUndefined();
        expect(group.hasSignal('doubled')).toBe(false);
      } finally {
        outer.destroy(); // takes the memo signal it created with it
        destroySignal(a);
        group.clear();
      }
    });

    it('a memo reader that escapes the effect body freezes at its last value', () => {
      const trigger = createSignal(0);
      const src = createSignal(1);

      let escaped!: () => number;

      const outer = createEffect(() => {
        trigger.get();
        escaped = createMemo(() => src.get() * 2);
      });

      try {
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
      } finally {
        outer.destroy(); // takes the memo signal it created with it
        destroySignal(trigger, src);
      }
    });
  });

  describe('destroy-queue subscription of the internal effect (MEM-005)', () => {
    it('is released when the internal effect dies with its last dependency', () => {
      const destroySubscriptionsBefore = getSubscriptionCount(
        globalDestroySignalQueue,
      );
      const signalsBefore = getSignalsCount();
      const effectsBefore = getEffectsCount();

      const src = createSignal(1);
      const doubled = createMemo(() => src.get() * 2);

      try {
        expect(doubled()).toBe(2);

        // The memo's own effect self-destroys here: its last live
        // dependency is gone (EffectImpl[$destroySignal]).
        destroySignal(src);

        expect(getEffectsCount()).toBe(effectsBefore);
        expect(
          getSubscriptionCount(globalDestroySignalQueue),
          'the once() that ties the effect to the memo signal must go with the effect',
        ).toBe(destroySubscriptionsBefore);

        // The memo signal itself stays alive and frozen — that is the
        // documented behaviour of a memo created outside an effect body.
        expect(getSignalsCount()).toBe(signalsBefore + 1);
        expect(doubled()).toBe(2);

        destroySignal(doubled);

        expect(getSignalsCount()).toBe(signalsBefore);
      } finally {
        destroySignal(doubled, src);
      }
    });

    it('does not accumulate on the global destroy queue over many memos', () => {
      const destroySubscriptionsBefore = getSubscriptionCount(
        globalDestroySignalQueue,
      );
      const effectsBefore = getEffectsCount();

      const memos: Array<SignalReader<number>> = [];

      try {
        for (let i = 0; i < 50; i++) {
          const src = createSignal(i);
          memos.push(createMemo(() => src.get() * 2));
          destroySignal(src);
        }

        expect(getEffectsCount()).toBe(effectsBefore);
        expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
          destroySubscriptionsBefore,
        );
      } finally {
        destroySignal(...memos);
      }
    });
  });

  describe('batchWrites option (PERF-001)', () => {
    // The memo effect used to unconditionally wrap `si.set(callback())` in
    // `batch()`. Two consequences follow from that, pulling in opposite
    // directions — this describe block covers both:
    //
    // 1. A callback that itself writes *other* signals as a side effect used
    //    to have those writes grouped with the memo's own write, so a
    //    downstream effect tracking both saw one deduplicated, consistent
    //    run instead of one run per write with a torn intermediate state.
    //    Losing the batch by default costs this grouping — see the first two
    //    tests below.
    //
    // 2. `EffectImpl.run()` *used to* defer every run while a batch was open,
    //    including a dirty dependency's run triggered by `beforeRead` while
    //    the memo's own callback was reading it. Inside the old unconditional
    //    batch(), a memo callback that read another dirty (or lazy and
    //    never-autorun) memo got that memo's *stale* pre-recompute value —
    //    permanently stale for a lazy one, since nothing forced it to run on
    //    its own. That mechanism is gone: since ASYNC-003 a memo's
    //    `beforeRead` is not `e.run` but `e.runImmediately`, which recomputes
    //    past the batch gate. Both settings now read the same fresh value —
    //    see the third and fourth tests below, which are twins rather than
    //    opposites.
    //
    // Composed memos (one memo reading another) are normal use; a memo
    // callback that writes other signals as a side effect is not. `batch()`
    // is opt-in via `{batchWrites: true}` for the latter, and its price is
    // now an allocation — one `Batch` instance per recompute — not the
    // read-freshness of point 2.

    it('default (no batchWrites): a side-effect write in the callback is NOT grouped with the memo write', () => {
      const source = createSignal(0);
      const sideEffectSignal = createSignal('idle');

      const doubled = createMemo(() => {
        const v = source.get();
        sideEffectSignal.set(v > 0 ? 'touched' : 'idle');
        return v * 2;
      });

      const runs = vi.fn();
      const downstream = createEffect(() => {
        runs(doubled(), sideEffectSignal.get());
      });

      try {
        expect(runs).toHaveBeenCalledTimes(1);
        runs.mockClear();

        source.set(5);

        // Unbatched: the side-effect write and the memo write each notify on
        // their own, so the downstream effect (depending on both) reruns twice.
        expect(runs).toHaveBeenCalledTimes(2);
        // The first of those two runs sees the torn intermediate state: the
        // side-effect signal already updated, the memo's own signal not yet
        // (S1) — this is the price of the new default, spelled out.
        expect(runs).toHaveBeenNthCalledWith(1, 0, 'touched');
        expect(runs).toHaveBeenNthCalledWith(2, 10, 'touched');
      } finally {
        downstream.destroy();
        destroySignal(source, sideEffectSignal, doubled);
      }
    });

    it('{batchWrites: true} restores the old grouping: side-effect write and memo write dedupe into one downstream run', () => {
      const source = createSignal(0);
      const sideEffectSignal = createSignal('idle');

      const doubled = createMemo(
        () => {
          const v = source.get();
          sideEffectSignal.set(v > 0 ? 'touched' : 'idle');
          return v * 2;
        },
        {batchWrites: true},
      );

      const runs = vi.fn();
      const downstream = createEffect(() => {
        runs(doubled(), sideEffectSignal.get());
      });

      try {
        expect(runs).toHaveBeenCalledTimes(1);
        runs.mockClear();

        source.set(5);

        // Batched: both writes happen inside the memo effect's own batch(), so
        // the downstream effect (deduplicated by effect id) reruns exactly once
        // with the final, consistent values.
        expect(runs).toHaveBeenCalledTimes(1);
        expect(runs).toHaveBeenLastCalledWith(10, 'touched');
      } finally {
        downstream.destroy();
        destroySignal(source, sideEffectSignal, doubled);
      }
    });

    // W5 — reading a composed (lazy, dirty) memo from within another memo's
    // callback. This used to be the correctness half of the case for
    // defaulting to `false`; today it is only the record of a fixed defect.
    //
    // `EffectImpl.run()` defers any run while a batch is open (see `#run()`'s
    // `getCurrentBatch()` check), and a memo's `beforeRead` used to be
    // exactly `e.run`. With a batch open, a dirty inner memo read from inside
    // an outer memo's callback got deferred instead of recomputed — the read
    // returned the stale pre-write value. For a lazy inner memo that wasn't
    // even "deferred": `[RECALL]` only sets `shouldRun = true` and calls
    // `run()` when `autorun` is set, so a lazy memo's deferred run inside the
    // batch flush was *also* a no-op — it stayed stale until something read
    // it directly, outside any batch.
    //
    // Since ASYNC-003 `beforeRead` is `e.runImmediately`, which recomputes at
    // the read regardless of an open batch, so both settings read the same
    // fresh value. The recompute's own write still goes into the batch.

    it('{batchWrites: true}: reading a dirty lazy memo from within a batched outer memo returns its fresh value (ASYNC-003, audit 2026-08-08)', () => {
      const dep = createSignal(1);

      const inner = createMemo(() => dep.get() * 10, {lazy: true});

      // `outer` must not exist while `inner` is primed below, so its handle
      // is declared here and assigned inside the try.
      let outer!: SignalReader<number>;

      try {
        expect(inner()).toBe(10); // prime: force the first run, subscribe to dep

        outer = createMemo(() => dep.get() + inner(), {
          batchWrites: true,
        });

        expect(outer()).toBe(11);

        dep.set(2);

        // Read right after the write — nothing else has touched `inner` yet.
        // 2 + 20 = 22: `beforeRead` runs the dirty `inner` at the read, even
        // though outer's own batch() is open around the callback. This used
        // to be 12, healed only by a later unbatched read of `inner`.
        expect(
          outer(),
          "fresh on the first read, inside outer's own batch()",
        ).toBe(22);
        expect(
          signalImpl(inner)?.value,
          'inner recomputed at the read, not at some later unbatched one',
        ).toBe(20);

        // These two used to be the healing step: a direct, unbatched read of
        // `inner` forced it to catch up and dragged `outer` to 22 with it.
        // They are kept as the inverse assertion — both values are already
        // settled, so a later read must change nothing.
        expect(inner()).toBe(20);
        expect(outer()).toBe(22);
      } finally {
        destroySignal(dep, inner, outer);
      }
    });

    // The twin of the test above, not its counterpart: with no batch open
    // around the recompute there is no gate for `beforeRead` to walk past in
    // the first place, and the result is the same fresh value either way.
    it('default (no batchWrites): reading a dirty lazy memo from within an outer memo returns its fresh value too', () => {
      const dep = createSignal(1);

      const inner = createMemo(() => dep.get() * 10, {lazy: true});

      let outer!: SignalReader<number>;

      try {
        // Prime: forces inner's first run now, subscribing it to `dep` before
        // `outer` exists. This fixes the listener order on `dep`'s RECALL
        // (inner before outer, same-priority ties break on registration
        // order) that this test depends on — inner must be marked dirty
        // before outer's callback reads it. Reversed, outer's read would hit
        // `!shouldRun` and return 12 regardless of batching — for a reason
        // that has nothing to do with the point this test makes.
        expect(inner()).toBe(10);

        outer = createMemo(() => dep.get() + inner());

        expect(outer()).toBe(11);

        dep.set(2);

        // No batch open during outer's recompute, so reading the dirty `inner`
        // inside outer's callback runs it synchronously instead of deferring
        // it — outer sees the correct, fresh value on the very first read.
        expect(outer(), 'fresh on the first read, no second run needed').toBe(
          22,
        );
      } finally {
        destroySignal(dep, inner, outer);
      }
    });
  });
});
