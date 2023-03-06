import {EffectCallback, VoidCallback} from './types';

import {getCurrentBatchId} from './batch';
import {runWithinEffect} from './globalEffectStack';
import {
  globalBatchQueue,
  globalEffectQueue,
  globalSignalQueue,
  $runAgain,
  $destroySignal,
  globalDestroySignalQueue,
} from './globalQueues';
import {UniqIdGen} from './UniqIdGen';

export class Effect {
  static idGen = new UniqIdGen('ef');

  /** global effect counter */
  static count = 0;

  /** unique effect id */
  readonly id: symbol;

  readonly signals: Set<symbol> = new Set();
  readonly destroyedSignals: Set<symbol> = new Set();

  readonly callback: EffectCallback;
  #cleanupCallback?: VoidCallback;

  readonly childEffects: Set<Effect> = new Set();

  #destroyed = false;

  /**
   * An effect subscribes to the globalEffectQueue by its `id`.
   * When triggered by its `id`, the _effect callback_ is executed.
   *
   * While the _effect callback_ is being executed, the effect instance is pushed onto the _global effect stack_.
   * If a _signal_ is read during the execution of the _effect callback
   * it recognises the signal and executes the `effect.onReadSignal()` method.
   *
   * The effect then knows which signals are calling it and subscribes to those signal ids in the `globalSignalsQueue'.
   */
  constructor(callback: EffectCallback) {
    this.callback = callback;

    this.id = Effect.idGen.make();

    globalEffectQueue.on(this.id, $runAgain, this);

    ++Effect.count;
  }

  addChild(effect: Effect): void {
    this.childEffects.add(effect);
  }

  /**
   * Executes the effect callback.
   *
   * Before the effect callback is executed, the _cleanup callback_ (if any) is executed.
   *
   * While the effect callback is being executed, the effect instance is placed on the _global effect stack_.
   *
   * The optional return value of the effect callback is stored as the next _cleanup callback_.
   */
  run(): void {
    this.callCleanup();
    this.#cleanupCallback = runWithinEffect(this, this.callback);
  }

  [$runAgain](): void {
    const curBatchId = getCurrentBatchId();
    if (curBatchId) {
      globalBatchQueue.emit(curBatchId, this.id);
    } else {
      this.run();
    }
  }

  whenSignalIsRead(signalId: symbol): void {
    if (!this.signals.has(signalId)) {
      this.signals.add(signalId);
      globalSignalQueue.on(signalId, $runAgain, this);
      globalDestroySignalQueue.once(signalId, $destroySignal, this);
    }
  }

  [$destroySignal](signalId: symbol): void {
    if (this.signals.has(signalId) && !this.destroyedSignals.has(signalId)) {
      // this.signals.delete(signalId);
      this.destroyedSignals.add(signalId);
      globalSignalQueue.off(signalId, this);
      // if (this.signals.size === 0) {
      const shouldDestroy = this.destroyedSignals.size === this.signals.size;
      // console.log('destroySignal', {
      //   shouldDestroy,
      //   signals: Array.from(this.signals),
      //   effectId: this.id,
      //   destroyedSignals: Array.from(this.destroyedSignals),
      // });
      if (shouldDestroy) {
        // no signals left, so nobody can trigger this effect anymore
        this.destroy();
      }
    }
  }

  private callCleanup(): void {
    if (this.#cleanupCallback != null) {
      this.#cleanupCallback();
      this.#cleanupCallback = undefined;
    }
  }

  destroy(): void {
    if (this.#destroyed) return;

    this.callCleanup();

    globalSignalQueue.off(this);
    globalEffectQueue.off(this);
    globalDestroySignalQueue.off(this);

    // TODO evaluate effect.unsubscribeChilds()
    // this.unsubscribeChilds();

    this.#destroyed = true;

    this.signals.clear();
    this.destroyedSignals.clear();
    this.childEffects.clear();

    --Effect.count;
  }
}
