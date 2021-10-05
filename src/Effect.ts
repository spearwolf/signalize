import {EffectCallback, VoidCallback} from './types';

import {UniqIdGen} from './UniqIdGen';
import {getCurrentBatchId} from './batch';
import globalSignals from './globalSignals';
import {runWithinEffect} from './globalEffectStack';

export class Effect {
  static idGen = new UniqIdGen('ef');

  readonly id: symbol;
  readonly callback: EffectCallback;

  readonly signals: Set<symbol>;
  readonly childEffects: Set<Effect>;

  #unsubscribeEffect: VoidCallback;
  #unsubscribeCallback: VoidCallback;

  constructor(callback: EffectCallback) {
    this.id = Effect.idGen.make();
    this.callback = callback;
    this.signals = new Set();
    this.childEffects = new Set();
    this.#unsubscribeEffect = globalSignals.on(this.id, () => this.rerun());
  }

  run(): void {
    this.#unsubscribeCallback = runWithinEffect(this, this.callback);
  }

  rerun(): void {
    const curBatchId = getCurrentBatchId();
    if (curBatchId) {
      globalSignals.emit(curBatchId, this.id);
    } else {
      this.unsubscribe();
      this.run();
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

    if (this.#unsubscribeCallback) {
      this.#unsubscribeCallback();
      this.#unsubscribeCallback = undefined;
    }
  }

  destroy(): void {
    this.unsubscribe();
    this.#unsubscribeEffect();
  }

  addChild(effect: Effect): void {
    this.childEffects.add(effect);
  }
}
