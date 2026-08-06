import {bench, describe} from 'vitest';
import {createEffect, createSignal} from '../src/index.js';

/*
 * Hot path #1 — writing a signal.
 *
 * "no consumers" isolates the writer itself (compare + store + emit-with-
 * zero-subscribers). "with n effects" adds the synchronous RECALL fan-out
 * that dominates once a signal actually has dependents — the case that
 * matters for real apps. n is deliberately small/medium/large so a
 * regression that only shows up under fan-out doesn't hide behind n=1.
 *
 * Each signal/effect set is created once per describe block (outside the
 * timed `bench` callback) and then written to repeatedly — steady-state
 * cost, not setup cost. The value alternates every call so the writer's
 * `compare` never short-circuits into the no-op branch.
 */

describe('signal write, no consumers', () => {
  const sig = createSignal(0);
  let i = 0;

  bench('write', () => {
    sig.set(++i);
  });
});

for (const n of [1, 10, 100]) {
  describe(`signal write, ${n} effect(s) subscribed`, () => {
    const sig = createSignal(0);

    for (let e = 0; e < n; e++) {
      createEffect(() => {
        sig.get();
      });
    }

    let i = 0;

    bench(`write (fans out to ${n})`, () => {
      sig.set(++i);
    });
  });
}

/*
 * Baseline (reference point for package 12 / PERF-001, PERF-002, PERF-004),
 * measured on commit 5cb75f4, single run, one dev laptop — ops/sec (hz),
 * not a gate, just "was it in this ballpark before":
 *
 *   write, no consumers        ~13,685,001 hz
 *   write, fans out to 1       ~ 2,877,523 hz
 *   write, fans out to 10      ~   411,171 hz
 *   write, fans out to 100     ~    42,520 hz
 *
 * The 0 -> 1 subscriber drop (~4.8x) is the eventize on/emit round trip;
 * from there it scales roughly linearly with subscriber count, as expected
 * for a synchronous fan-out with no batching.
 */
