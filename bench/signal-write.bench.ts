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
 * Baseline, measured on commit 5cb75f4, single run, one dev laptop — ops/sec (hz),
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
 *
 * The three flush guards — no error array per rerun, no flush for an empty
 * batch, no emit on `globalEffectCalledQueue` outside a flush — measured
 * 2026-08-11 on commit 8cc46e9 against the same tree with all three in
 * place.
 *
 * Method, so the numbers are reproducible: `pnpm bench signal-write`, this
 * file in full, with the options it declares (none — Vitest's 500 ms
 * default), baseline and patched tree alternating within one session, median
 * of five runs each. Neighbour interference is not a problem in this file:
 * every case owns its signal and its effects, and four alternating full runs
 * per variant stayed inside 1-3 % — ops/sec (hz):
 *
 *   write, fans out to 1     1,913,515 -> 2,287,486  (+20 %)
 *   write, fans out to 10      373,783 ->   510,935  (+37 %)
 *   write, fans out to 100      40,004 ->    54,633  (+37 %)
 *
 * `write, no consumers` is deliberately not listed as a result: none of the
 * three guards is on its path (it has no effect at all), and it moved by
 * -2 % here and by over 10 % in either direction across samples taken in
 * separate sessions. That case measures code layout and machine mood, not
 * this change.
 *
 * 2026-08-11, measured on HEAD — several commits later, including the
 * `EffectImpl.run()` refactor and the new diagnostics channel. Same method:
 * `pnpm bench signal-write`, this file in
 * full, median of five runs, ops/sec (hz):
 *
 *   write, no consumers        11,890,299 hz
 *   write, fans out to 1        2,529,830 hz
 *   write, fans out to 10         558,768 hz
 *   write, fans out to 100         62,100 hz
 *
 * All three fan-out cases sit 9-14 % above the Package 17 numbers above
 * (2,287,486 / 510,935 / 54,633 hz). `write, no consumers` stayed inside its
 * own five-run spread here (11.59M-12.20M, ~5 %), consistent with the >10 %
 * cross-session drift already called out for that case above. Whether the
 * gap on the other three reflects the commits since Package 17 or plain
 * session noise on this machine is not established by one five-run pass —
 * that needs the same alternating-runs protocol Package 17 used, not this
 * one.
 */
