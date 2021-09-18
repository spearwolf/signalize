import {UniqIdGen} from './UniqIdGen';
import {getCurrentBatchId} from './batch';
import {runWithinEffect} from './globalEffectStack';
import globalSignals from './globalSignals';
import {EffectCallback} from './types';

export class Effect {
  static idGen = new UniqIdGen('ef');

  readonly id: symbol;
  readonly callback: EffectCallback;

  readonly signals: Set<symbol>;
  readonly childEffects: Set<Effect>;

  #unsubscribeEffect: () => void;

  constructor(callback: EffectCallback) {
    this.id = Effect.idGen.make();
    this.callback = callback;
    this.signals = new Set();
    this.childEffects = new Set();
    this.#unsubscribeEffect = globalSignals.on(this.id, () => this.rerun());
  }

  rerun(): void {
    const curBatchId = getCurrentBatchId();
    if (curBatchId) {
      globalSignals.emit(curBatchId, this.id);
    } else {
      this.unsubscribe();
      runWithinEffect(this, this.callback);
    }
  }

  rerunOnSignal(signalId: symbol): void {
    if (!this.signals.has(signalId)) {
      this.signals.add(signalId);
      globalSignals.on(signalId, 'rerun', this);
    }
  }

  unsubscribe(): void {
    globalSignals.off(this);

    this.signals.clear();

    for (const effect of this.childEffects.values()) {
      effect.unsubscribe();
    }

    this.childEffects.clear();
  }

  destroy(): void {
    this.unsubscribe();
    this.#unsubscribeEffect();
  }

  addChild(effect: Effect): void {
    this.childEffects.add(effect);
  }
}
