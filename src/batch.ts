import {emit} from '@spearwolf/eventize';
import {globalEffectQueue} from './global-queues.js';
import type {VoidFunc} from './types.js';

class Batch {
  static current?: Batch;

  readonly #delayedEffects = new Set<symbol>();

  batch(effectId: symbol) {
    this.#delayedEffects.add(effectId);
  }

  run() {
    emit(globalEffectQueue, Array.from(this.#delayedEffects));
  }
}

export const getCurrentBatch = (): Batch | undefined => Batch.current;

// XXX `batch()` is a _hint_ not a _guarantee_ to run all effects in just _one_ strike.

export function batch(callback: VoidFunc): void {
  // if there is a current batch context, we use it, otherwise we just create a new one.
  // the batch is executed after the callback, but only if we have created the batch ourselves.
  let curBatch = Batch.current;
  if (!curBatch) {
    curBatch = Batch.current = new Batch();
  } else {
    curBatch = undefined;
  }
  try {
    callback();
  } finally {
    if (curBatch) {
      Batch.current = undefined;
      curBatch.run();
    }
  }
}
