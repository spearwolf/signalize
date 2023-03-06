import {
  DestroyEffectCallback,
  EffectCallback,
  RunEffectCallback,
  VoidCallback,
} from './types';

import {UniqIdGen} from './UniqIdGen';
import {getCurrentBatchId} from './batch';
import {$createEffect, $destroyEffect, $destroySignal} from './constants';
import {
  globalBatchQueue,
  globalDestroySignalQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './global-queues';
import {getCurrentEffect, runWithinEffect} from './globalEffectStack';

export class Effect {
  static idGen = new UniqIdGen('ef');

  /** global effect counter */
  static count = 0;

  /** unique effect id */
  readonly id: symbol;

  readonly signals: Set<symbol> = new Set();
  readonly destroyedSignals: Set<symbol> = new Set();

  readonly callback: EffectCallback;
  #nextCleanupCallback?: VoidCallback;

  readonly childEffects: Set<Effect> = new Set();

  #destroyed = false;

  /**
   * An effect subscribes to the _global effects queue_ by its `id`.
   * When triggered by its `id`, the _effect callback_ is executed.
   *
   * While the _effect callback_ is being executed, the effect instance is pushed onto the _global effect stack_.
   * If a _signal_ is read during the execution of the _effect callback_
   * it recognises the effect and executes the `effect.onReadSignal()` method.
   *
   * The effect then knows which signals are calling it and subscribes to those signal ids in the _global signals queue_.
   *
   * Please do not call this constructor directly, use `createEffect()` instead.
   */
  constructor(callback: EffectCallback) {
    this.callback = callback;

    this.id = Effect.idGen.make();

    globalEffectQueue.on(this.id, 'run', this);

    ++Effect.count;
  }

  static createEffect(
    callback: EffectCallback,
  ): [RunEffectCallback, DestroyEffectCallback] {
    const effect = new Effect(callback);

    getCurrentEffect()?.attachChildEffect(effect);

    globalEffectQueue.emit($createEffect, effect);

    effect.run();

    return [
      () => effect.run(),
      () => {
        effect.destroy();
      },
    ];
  }

  // TODO rethink child effects
  attachChildEffect(effect: Effect): void {
    this.childEffects.add(effect);
  }

  /**
   * Run the _effect callback_.
   *
   * Before the _effect callback_ is executed, the _cleanup callback_ (if any) is executed.
   *
   * While the _effect callback_ is being executed, the effect instance is placed on top of the _global effect stack_.
   *
   * The optional return value of the _effect callback_ is stored as the next _cleanup callback_.
   */
  run(): void {
    const curBatchId = getCurrentBatchId();
    if (curBatchId) {
      globalBatchQueue.emit(curBatchId, this.id);
    } else {
      this.runCleanupCallback();
      this.#nextCleanupCallback = runWithinEffect(this, this.callback);
    }
  }

  whenSignalIsRead(signalId: symbol): void {
    if (!this.signals.has(signalId)) {
      this.signals.add(signalId);
      globalSignalQueue.on(signalId, 'run', this);
      globalDestroySignalQueue.once(signalId, $destroySignal, this);
    }
  }

  [$destroySignal](signalId: symbol): void {
    if (!this.destroyedSignals.has(signalId) && this.signals.has(signalId)) {
      this.destroyedSignals.add(signalId);
      globalSignalQueue.off(signalId, this);
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

  private runCleanupCallback(): void {
    if (this.#nextCleanupCallback != null) {
      this.#nextCleanupCallback();
      this.#nextCleanupCallback = undefined;
    }
  }

  destroy(): void {
    if (this.#destroyed) return;

    globalEffectQueue.emit($destroyEffect, this);

    this.runCleanupCallback();

    globalSignalQueue.off(this);
    globalEffectQueue.off(this);
    globalDestroySignalQueue.off(this);

    this.#destroyed = true;

    this.signals.clear();
    this.destroyedSignals.clear();
    this.childEffects.clear();

    --Effect.count;
  }
}
