import {$batch, globalBatchQueue, globalEffectQueue} from './globalQueues';
import {BatchCallback} from './types';
import {UniqIdGen} from './UniqIdGen';

let globalBatch: Batch | undefined;

class Batch {
  static readonly idCreator = new UniqIdGen('ba');

  readonly id: symbol;

  readonly delayedEffects = new Set<symbol>();
  readonly unsubscribe: () => void;

  constructor() {
    this.id = Batch.idCreator.make();
    // TODO do we need a global queue here? maybe just a batch() method is enough?
    this.unsubscribe = globalBatchQueue.on(this.id, $batch, this);
  }

  [$batch](effectId: symbol) {
    this.delayedEffects.add(effectId);
  }

  execute() {
    globalEffectQueue.emit(Array.from(this.delayedEffects));
  }
}

export const getCurrentBatchId = (): symbol | undefined => globalBatch?.id;

export function batch(callback: BatchCallback): void {
  let currentBatch = globalBatch;
  if (!currentBatch) {
    currentBatch = globalBatch = new Batch();
  } else {
    currentBatch = undefined;
  }
  try {
    callback();
  } finally {
    if (currentBatch) {
      currentBatch.unsubscribe();
      globalBatch = undefined;
      currentBatch.execute();
    }
  }
}
