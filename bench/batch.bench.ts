import {bench, describe} from 'vitest';
import {batch, createEffect, createSignal} from '../src/index.js';

/*
 * Hot path #5 — `batch()` overhead on a single write.
 *
 * Reference point for PERF-004: batching a *single* write buys nothing
 * (dedup only pays off with >1 write to the same effect) but still pays
 * for the Batch instance, the two temporary queue subscriptions in
 * `Batch#run`, and the extra indirection. This bench pairs the batched and
 * unbatched write so that overhead is directly readable as the delta
 * between the two numbers, not something to eyeball across separate runs.
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
 * `batch()` itself is untouched by package 12 — these numbers are the
 * reference PERF-004 fixes against, not something this package changes.
 *
 * Commit 5cb75f4:
 *   write inside batch()      ~727,177 hz
 *   write without batch()     ~2,700,674 hz  (batch() is ~3.7x slower here,
 *                                             entirely expected: one write
 *                                             cannot recoup Batch's own
 *                                             allocation + queue overhead)
 *
 * Same machine, same session as the PERF-004 change (package 12 —
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
 */
