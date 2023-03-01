import {EffectCallback, VoidCallback} from './types';

import {getCurrentBatchId} from './batch';
import {runWithinEffect} from './globalEffectStack';
import {
  globalBatchQueue,
  globalEffectQueue,
  globalSignalQueue,
  $runAgain,
} from './globalQueues';
import {UniqIdGen} from './UniqIdGen';

export class Effect {
  static idGen = new UniqIdGen('ef');

  readonly id: symbol;
  readonly callback: EffectCallback;

  readonly signals: Set<symbol> = new Set();
  readonly childEffects: Set<Effect> = new Set();

  #unsubscribeCallback: VoidCallback;

  constructor(callback: EffectCallback) {
    this.callback = callback;

    this.id = Effect.idGen.make();

    globalEffectQueue.on(this.id, $runAgain, this);
  }

  runFirstTime(): void {
    this.#unsubscribeCallback = runWithinEffect(this, this.callback);
  }

  [$runAgain](): void {
    const curBatchId = getCurrentBatchId();
    if (curBatchId) {
      globalBatchQueue.emit(curBatchId, this.id);
    } else {
      this.unsubscribe();
      this.runFirstTime();
    }
  }

  runAgainOnSignal(signalId: symbol): void {
    if (!this.signals.has(signalId)) {
      this.signals.add(signalId);
      globalSignalQueue.on(signalId, $runAgain, this);
    }
  }

  unsubscribe(): void {
    globalSignalQueue.off(this);
    globalEffectQueue.off(this);

    this.signals.clear();

    for (const effect of this.childEffects.values()) {
      effect.unsubscribe();
    }

    this.childEffects.clear();

    if (this.#unsubscribeCallback) {
      this.#unsubscribeCallback();
      this.#unsubscribeCallback = undefined;
    }
  }

  addChild(effect: Effect): void {
    this.childEffects.add(effect);
  }
}
