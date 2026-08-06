import {bench, describe} from 'vitest';
import {createMemo, createSignal} from '../src/index.js';

/*
 * Hot path #3 — memo recompute.
 *
 * A memo is a signal driven by a Priority.C effect (see createMemo.ts), so
 * writing its source signal already triggers the recompute synchronously —
 * no separate read is needed to force it. This measures exactly that:
 * source write -> memo body re-run -> derived signal write.
 */

describe('memo recompute', () => {
  const source = createSignal(0);
  const doubled = createMemo(() => source.value * 2);

  let i = 0;

  bench('write source, memo recomputes', () => {
    source.set(++i);
  });

  bench('read memo (cached)', () => {
    doubled();
  });
});

/*
 * Baseline (reference point for package 12), measured on commit 5cb75f4,
 * single run, one dev laptop — not a gate:
 *
 *   write source, memo recomputes   ~13,891,301 hz
 *   read memo (cached)              ~17,243,551 hz
 */
