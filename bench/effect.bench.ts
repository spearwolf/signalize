import {bench, describe} from 'vitest';
import {createEffect, createSignal} from '../src/index.js';

/*
 * Hot path #2 — effect setup and teardown.
 *
 * `create + destroy` measures the pair together (the common lifecycle: a
 * component mounts an effect and later unmounts it) rather than each half
 * in isolation, since `destroy()` must undo exactly what `create` did —
 * splitting them risks the two costs drifting apart unnoticed.
 */

describe('effect lifecycle', () => {
  const sig = createSignal(0);

  bench('create + destroy (1 dependency)', () => {
    const effect = createEffect(() => {
      sig.get();
    });
    effect.destroy();
  });
});

/*
 * Baseline, measured on commit 5cb75f4, single run, one dev laptop — not a
 * gate:
 *
 *   create + destroy (1 dependency)   ~329,956 hz
 */
