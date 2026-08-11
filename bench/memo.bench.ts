import {bench, describe} from 'vitest';
import {createEffect, createMemo, createSignal} from '../src/index.js';

/*
 * Hot path #3 — memo recompute, no dependent effect.
 *
 * A memo is a signal driven by a Priority.C effect (see createMemo.ts), so
 * writing its source signal already triggers the recompute synchronously —
 * no separate read is needed to force it. This measures exactly that:
 * source write -> memo body re-run -> derived signal write.
 *
 * The source read inside the memo callback must be the *tracked* read
 * (`source.get()`), not `.value` (the untracked read, see `Signal.ts`) — an
 * untracked read means the memo never subscribes to `source` at all,
 * `source.set()` then triggers no RECALL, and the memo body is never
 * entered by the "write source" case below. An earlier version of this
 * suite used `.value` here and silently benchmarked a no-op write instead
 * of a recompute — caught by comparing against
 * `signal-write.bench.ts > signal write, no consumers`, which reported the
 * same throughput as this suite's "recompute" case; a real recompute
 * (effect run + signal write) cannot be as fast as a write with zero
 * subscribers.
 */

describe('memo recompute, no dependent effect', () => {
  const source = createSignal(0);
  const doubled = createMemo(() => source.get() * 2);

  let i = 0;

  bench('write source, memo recomputes', () => {
    source.set(++i);
  });

  bench('read memo (cached)', () => {
    doubled();
  });

  // Paired with {batchWrites: true} (reproduces the old unconditional
  // batch()) so the PERF-001 (2026-07 audit) delta is readable even without
  // a dependent effect — see the baseline comment below for why it is small
  // here.
  const sourceBatched = createSignal(0);
  const doubledBatched = createMemo(() => sourceBatched.get() * 2, {
    batchWrites: true,
  });

  let k = 0;

  bench(
    'write source, memo (batchWrites: true) recomputes, no dependent effect',
    () => {
      sourceBatched.set(++k);
    },
  );

  bench('read memo (batchWrites: true, cached)', () => {
    doubledBatched();
  });
});

/*
 * Hot path #3b — memo recompute *with* a dependent effect.
 *
 * PERF-001 (2026-07 audit) is about the batch() machinery in `Batch#run()`:
 * a queue drained through two temporary listeners on `globalEffectQueue` /
 * `globalEffectCalledQueue`, redispatching each deferred effect id. That
 * machinery only does anything when there is something to defer — a
 * downstream effect subscribed to the memo's own signal. The suite above
 * has none, so it never exercises that path (see PERF-001 (2026-07 audit)
 * note in the baseline comment below). This suite does: {batchWrites: true}
 * forces the old unconditional batch() back on and is paired against the
 * default so the deferred-dispatch overhead PERF-001 (2026-07 audit) is
 * about is directly readable as the delta between the two numbers.
 */

describe('memo recompute, with a dependent effect', () => {
  const sourceA = createSignal(0);
  const doubledA = createMemo(() => sourceA.get() * 2, {batchWrites: true});
  createEffect(() => {
    doubledA();
  });

  let a = 0;

  bench(
    'write source, memo (batchWrites: true) recomputes, effect reacts',
    () => {
      sourceA.set(++a);
    },
  );

  const sourceB = createSignal(0);
  const doubledB = createMemo(() => sourceB.get() * 2); // batchWrites: false (default)
  createEffect(() => {
    doubledB();
  });

  let b = 0;

  bench('write source, memo (default) recomputes, effect reacts', () => {
    sourceB.set(++b);
  });
});

/*
 * Baseline history, single run, one dev laptop each time — not a gate.
 *
 * The commit-5cb75f4 numbers below are retired and must not be compared
 * against. That run read the source via `source.value` — the untracked
 * getter (see `Signal.ts`) — so the memo had no dependency at all:
 * `source.set()` triggered no RECALL, and "write source, memo recomputes"
 * silently benchmarked a no-op write instead of a real recompute. Caught by
 * cross-checking against `signal-write.bench.ts > signal write, no
 * consumers`, which reported the *same* throughput on that commit — a real
 * recompute (effect run + signal write) cannot be as fast as a write with
 * zero subscribers, let alone identical:
 *
 *   write source, memo recomputes (BOGUS, .value bug)   ~13,891,301 hz
 *   read memo (cached)                                  ~17,243,551 hz
 *
 * First trustworthy measurement, `.get()` fix applied, same machine, same
 * session, immediately before/after the PERF-001 (2026-07 audit) change — "before" reproduced
 * via `{batchWrites: true}` on identical code, not a separate old commit:
 *
 * No dependent effect (`memo recompute, no dependent effect`):
 *   batchWrites: true (old default, forced back on): 677,309 hz
 *   default (no batchWrites):                       2,059,320 hz  (~3.04x)
 *   (sanity check: 2,059,320 hz now sits next to
 *   `signal-write.bench.ts > signal write, 1 effect(s) subscribed`
 *   [1,968,005 hz], not next to "no consumers" [12,384,078 hz] — this is a
 *   real recompute now.)
 *
 * With a dependent effect (`memo recompute, with a dependent effect`) — the
 * case PERF-001 (2026-07 audit) is actually about, since only here does `Batch#run()` have a
 * delayed effect to redispatch through its two temporary queue listeners:
 *   batchWrites: true (old default, forced back on):   506,934 hz
 *   default (no batchWrites):                         1,333,333 hz  (~2.63x)
 *
 * Both cases (~3.04x, ~2.63x) land below batch.bench.ts's isolated ~3.6-4x —
 * expected, not a discrepancy: that suite measures batch() overhead against
 * nothing else happening, while a real recompute adds its own fixed cost on
 * top (dependency tracking, the derived-signal write, and — in the
 * with-effect case — the dependent effect's own run), diluting the
 * batch-only savings without changing its absolute size. batch.bench.ts is
 * the ceiling this delta approaches as the rest of the recompute gets
 * cheaper, not a number these two should match. Confirms PERF-001 (2026-07
 * audit) against a real recompute instead of noise either way.
 *
 * Package 17 (PERF-001, PERF-002, PERF-003), measured 2026-08-11 on commit
 * 8cc46e9 against the same tree with all three guards.
 *
 * Method, so the numbers are reproducible: one `pnpm bench memo -t "<case>"`
 * per case — *not* a full run of this file, which shifts its own neighbours
 * by up to 20 % (a case untouched by the change read -6 % that way) — with
 * the options this file declares (none — Vitest's 500 ms default), baseline
 * and patched tree alternating within one session, median of three runs
 * each. Case names as they appear here, ops/sec (hz):
 *
 *   write source, memo recomputes                  1,962,074 -> 2,360,227
 *   … memo (batchWrites: true) …, no dependent eff.  756,036 -> 2,244,935
 *   … memo (default) …, effect reacts              1,208,494 -> 1,572,036
 *   … memo (batchWrites: true) …, effect reacts      510,550 ->   549,365
 *
 * The interesting row is the second: without a dependent effect there is
 * nothing to defer, so PERF-002's early return skips the whole flush and
 * `{batchWrites: true}` lands within 5 % of the default instead of a factor
 * of 2.6 behind it. The reason the default is still `false` is the fourth
 * row: with a dependent effect the flush really runs, and a whole flush for
 * a single deferred effect stays ~2.9x a plain recompute.
 */
