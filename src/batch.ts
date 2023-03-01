import {globalSignalQueue} from './globalQueues';
import {BatchCallback} from './types';
import {UniqIdGen} from './UniqIdGen';

let globalBatch: Batch | undefined;

class Batch {
  static readonly idGen = new UniqIdGen('ba');

  readonly id: symbol;

  readonly delayedEffects: symbol[] = [];
  readonly unsubscribe: () => void;

  constructor() {
    this.id = Batch.idGen.make();
    this.unsubscribe = globalSignalQueue.on(this.id, 'batch', this);
  }

  batch(effectId: symbol) {
    if (this.delayedEffects.indexOf(effectId) === -1) {
      this.delayedEffects.push(effectId);
    }
  }

  execute() {
    globalSignalQueue.emit(this.delayedEffects);
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
