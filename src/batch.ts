import {Effect} from './Effect';
import {globalEffectQueue} from './global-queues';
import {BatchCallback} from './types';
import {UniqIdGen} from './UniqIdGen';

class Batch {
  static current?: Batch;

  private static readonly idCreator = new UniqIdGen('ba');

  readonly id: symbol;

  readonly #delayedEffects = new Set<symbol>();

  constructor() {
    this.id = Batch.idCreator.make();
  }

  batch(effect: Effect) {
    this.#delayedEffects.add(effect.id);
  }

  execute() {
    // TODO batch: check for child effects (if their parentEffect exists in delayedEffects we don't wanna call them multiple times)
    globalEffectQueue.emit(Array.from(this.#delayedEffects));
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
