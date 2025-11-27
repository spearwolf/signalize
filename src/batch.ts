import {emit, on} from '@spearwolf/eventize';
import {RECALL} from './constants.js';
import {globalEffectCalledQueue, globalEffectQueue} from './global-queues.js';
import type {VoidFunc} from './types.js';

class Batch {
  static current?: Batch;

  readonly delayedEffects: Array<[number, Set<symbol>]> = [];

  batch(effectId: symbol, priority: number) {
    const len = this.delayedEffects.length;
    for (let i = 0; i < len; i++) {
      const [prio, effects] = this.delayedEffects[i];
      if (prio > priority) {
        continue;
      } else if (prio === priority) {
        effects.add(effectId);
        return;
      } else {
        this.delayedEffects.splice(i, 0, [priority, new Set([effectId])]);
        return;
      }
    }
    this.delayedEffects.push([priority, new Set([effectId])]);
  }

  run() {
    const alreadyBeenCalled = new Set<symbol>();

    // TODO -> v0.25.0
    // - track effects _output_ signals
    //   - effects may have multiple output signals
    //   - memos are effects they always have one output signal at minimum
    // - create effects dependency graph to avoid re-calling effects that have already been called
    // - call effects in topological order (respecting priorities)

    const unsubscribe = [
      on(globalEffectQueue, (effectId, actionType) => {
        if (actionType === RECALL) {
          alreadyBeenCalled.add(effectId);
        }
      }),
      on(globalEffectCalledQueue, (effectId) => {
        alreadyBeenCalled.add(effectId);
      }),
    ];

    const delayedEffects = this.delayedEffects.flatMap(([, effects]) =>
      Array.from(effects),
    );

    for (const effectId of delayedEffects) {
      if (alreadyBeenCalled.has(effectId)) {
        continue;
      }
      emit(globalEffectQueue, effectId, effectId, RECALL);
    }

    unsubscribe.forEach((unsub) => {
      unsub();
    });
  }
}

export const getCurrentBatch = (): Batch | undefined => Batch.current;

export const clearBatch = (): void => {
  Batch.current = undefined;
};

export const restoreBatch = (batch: Batch | undefined): void => {
  Batch.current = batch;
};

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
