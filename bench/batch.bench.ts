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
 * Baseline (reference point for package 12 / PERF-004), measured on commit
 * 5cb75f4, single run, one dev laptop — not a gate:
 *
 *   write inside batch()      ~727,177 hz
 *   write without batch()     ~2,700,674 hz  (batch() is ~3.7x slower here,
 *                                             entirely expected: one write
 *                                             cannot recoup Batch's own
 *                                             allocation + queue overhead)
 */
