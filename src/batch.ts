import {Effect} from './Effect';
import {globalEffectQueue} from './global-queues';
import {BatchCallback} from './types';

class Batch {
  static current?: Batch;

  readonly #delayedEffects = new Set<symbol>();

  batch(effect: Effect) {
    this.#delayedEffects.add(effect.id);
  }

  run() {
    globalEffectQueue.emit(Array.from(this.#delayedEffects));
  }
}

export const getCurrentBatch = (): Batch | undefined => Batch.current;

export function batch(callback: BatchCallback): void {
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
