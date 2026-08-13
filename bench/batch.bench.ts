import {bench, describe} from 'vitest';
import {batch, createEffect, createSignal} from '../src/index.js';

/*
 * Hot path #5 — `batch()` overhead on a single write.
 *
 * Reference point: batching a *single* write buys nothing
 * (dedup only pays off with >1 write to the same effect) but still pays
 * for the Batch instance, the two temporary queue subscriptions in
 * `Batch#run`, and the extra indirection. This bench pairs the batched and
 * unbatched write so that overhead is directly readable as the delta
 * between the two numbers, not something to eyeball across separate runs.
 *
 * Deliberately not measured here: an empty `batch()`, a batch whose writes
 * reach no effect, and a static-deps effect's rerun. All three are cheap by
 * construction (early returns / no subscription to walk) and a case that
 * only proves an early return is fast would be measuring the compiler, not
 * this library.
 */

describe('batch() around a single write', () => {
  const sigA = createSignal(0);
  createEffect(() => {
    sigA.get();
  });

  let i = 0;

  bench('write inside batch()', () => {
    batch(() => {
      sigA.set(++i);
    });
  });

  const sigB = createSignal(0);
  createEffect(() => {
    sigB.get();
  });

  let j = 0;

  bench('write without batch()', () => {
    sigB.set(++j);
  });
});

/*
 * Baseline history, single run, one dev laptop each time — not a gate.
 * `batch()` itself is untouched by the early-return work — these numbers
 * are what it is measured against, not something it changes.
 *
 * Commit 5cb75f4:
 *   write inside batch()      ~727,177 hz
 *   write without batch()     ~2,700,674 hz  (batch() is ~3.7x slower here,
 *                                             entirely expected: one write
 *                                             cannot recoup Batch's own
 *                                             allocation + queue overhead)
 *
 * Same machine, same session as the early-return change (
 * `SignalAutoMap.updateFromProps()` now computes its entries before
 * opening a batch and returns early when there are none, matching
 * `update()`'s existing `props.size` guard; the cost measured below is
 * what an empty `updateFromProps()` call now skips entirely instead of
 * paying once per call):
 *   before: write inside batch()      644,480 hz
 *   after:  write inside batch()      691,055 hz
 *   before: write without batch()   2,596,498 hz
 *   after:  write without batch()   2,496,550 hz
 *   (batch() is ~3.6-4.0x slower than a raw write across both runs — run-to-
 *   run noise on this machine, not a regression from this package)
 *
 * The three flush guards, measured 2026-08-11 on commit
 * 8cc46e9 against the same tree with all three guards. Method: `pnpm bench
 * batch.bench`, this file in full, with the options it declares (none —
 * Vitest's 500 ms default), baseline and patched tree alternating within one
 * session, median of five runs each — ops/sec (hz):
 *
 *   write inside batch()        679,469 ->   712,210  (+5 %)
 *   write without batch()     2,485,489 -> 3,189,668  (+28 %)
 *
 * Note what this file cannot show. The flush is skipped when a batch
 * deferred nothing, and *both* cases here keep an effect subscribed, so the
 * queue is never empty and that early return never fires: the +5 % is the
 * other two guards inside the flush, and the number to watch is that it does
 * not go *down*. The cases that skip is about — an empty `batch()`, and a
 * batch whose writes reach no effect — do not exist in this file or anywhere
 * in `bench/`. They were measured (629 ns -> 50 ns and 712 ns -> 120 ns) in a
 * throwaway copy outside the repo and are **not** reproducible from here; the
 * decision not to add them permanently belongs to the review of this suite's
 * scope, not to a performance fix.
 *
 * The pairing this file exists for widens as a side effect: `batch()` around
 * a single write went from ~3.7x to ~4.5x the cost of the raw write, because
 * the raw write got faster and the flush around it did not.
 */
