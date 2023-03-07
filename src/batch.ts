import {Effect} from './Effect';
import {globalEffectQueue} from './global-queues';
import {BatchCallback} from './types';

class Batch {
  static current?: Batch;

  readonly #effects = new Map<symbol, Effect>();
  readonly #delayedEffects = new Set<symbol>();

  batch(effect: Effect) {
    this.#effects.set(effect.id, effect);
    this.#delayedEffects.add(effect.id);
  }

  execute() {
    const runEffectIds: symbol[] = [];

    // TODO write tests for this
    for (const effectId of this.#delayedEffects) {
      const effect = this.#effects.get(effectId);
      if (
        effect?.parentEffect == null ||
        !this.#delayedEffects.has(effect.parentEffect.id)
      ) {
        runEffectIds.push(effectId);
      }
    }

    this.#effects.clear();
    this.#delayedEffects.clear();

    globalEffectQueue.emit(runEffectIds);
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
