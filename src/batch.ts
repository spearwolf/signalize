import {Effect} from './Effect';
import {globalEffectQueue} from './global-queues';
import {BatchCallback} from './types';

class Batch {
  static current?: Batch;

  readonly #delayedEffects = new Set<symbol>();

  batch(effect: Effect) {
    this.#delayedEffects.add(effect.id);
  }

  execute() {
    globalEffectQueue.emit(Array.from(this.#delayedEffects));
    this.#delayedEffects.clear();
  }
}

export const getCurrentBatch = (): Batch | undefined => Batch.current;

export function batch(callback: BatchCallback): void {
  let currentBatch = Batch.current;
  if (!currentBatch) {
    currentBatch = Batch.current = new Batch();
  } else {
    currentBatch = undefined;
  }
  try {
    callback();
  } finally {
    if (currentBatch) {
      Batch.current = undefined;
      currentBatch.execute();
    }
  }
}
