import {UniqIdGen} from './UniqIdGen';
import globalSignals from './globalSignals';
import {BatchCallback} from './types';

let globalBatch: Batch | undefined;

class Batch {
  static readonly idGen = new UniqIdGen('ba');

  readonly id: symbol;

  readonly delayedEffects: symbol[] = [];
  readonly unsubscribe: () => void;

  constructor() {
    this.id = Batch.idGen.make();
    this.unsubscribe = globalSignals.on(this.id, 'batch', this);
  }

  batch(effectId: symbol) {
    if (this.delayedEffects.indexOf(effectId) === -1) {
      this.delayedEffects.push(effectId);
    }
  }

  execute() {
    console.log(
      'execute batch:',
      this.id,
      'effects:',
      this.delayedEffects.map((s) => s.toString()).join(','),
    );
    globalSignals.emit(this.delayedEffects);
  }
}

export const getCurrentBatchId = (): symbol | undefined => globalBatch?.id;

export function batch(callback: BatchCallback): void {
  let currentBatch = globalBatch;
  if (!currentBatch) {
    currentBatch = globalBatch = new Batch();
    console.log('create new batch:', currentBatch.id);
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
