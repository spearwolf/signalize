import {
  DestroyEffectCallback,
  EffectCallback,
  RunEffectCallback,
  VoidCallback,
} from './types';

import {UniqIdGen} from './UniqIdGen';
import {getCurrentBatch} from './batch';
import {$createEffect, $destroyEffect, $destroySignal} from './constants';
import {
  globalDestroySignalQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './global-queues';
import {getCurrentEffect, runWithinEffect} from './globalEffectStack';

export interface EffectParams {
  autorun?: boolean;
}

export class Effect {
  private static idGen = new UniqIdGen('ef');

  /** global effect counter */
  static count = 0;

  /** unique effect id */
  readonly id: symbol;

  /** the effect callback */
  readonly callback: EffectCallback;

  #nextCleanupCallback?: VoidCallback;

  readonly #signals: Set<symbol> = new Set();
  readonly #destroyedSignals: Set<symbol> = new Set();

  parentEffect?: Effect;

  private readonly childEffects: Effect[] = [];
  private curChildEffectSlot = 0;

  autorun = true;
  shouldRun = true;

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
  constructor(callback: EffectCallback, options?: EffectParams) {
    this.callback = callback;

    this.autorun = options?.autorun ?? true;

    this.id = Effect.idGen.make();

    /** a batch will call the effect by id to run the effect */
    globalEffectQueue.on(this.id, 'recall', this);

    ++Effect.count;
  }

  // TODO write tests for autorun: false
  static createEffect(
    ...args:
      | [callback: EffectCallback]
      | [callback: EffectCallback, options: EffectParams]
      | [options: EffectParams, callback: EffectCallback]
  ): [RunEffectCallback, DestroyEffectCallback] {
    const [callback, options] = (
      typeof args[0] === 'function' ? args : [args[1], args[0]]
    ) as [EffectCallback, EffectParams | undefined];

    let effect: Effect | undefined;

    const parentEffect = getCurrentEffect();
    if (parentEffect != null) {
      effect = parentEffect.getCurrentChildEffect();
      if (effect == null) {
        effect = new Effect(callback, options);
        parentEffect.attachChildEffect(effect);
        globalEffectQueue.emit($createEffect, effect);
      }
      parentEffect.curChildEffectSlot++;
    } else {
      effect = new Effect(callback, options);
      globalEffectQueue.emit($createEffect, effect);
    }

    if (effect.autorun) {
      effect.run();
    }

    return [effect.run.bind(effect), effect.destroy.bind(effect)];
  }

  private getCurrentChildEffect(): Effect | undefined {
    return this.childEffects[this.curChildEffectSlot];
  }

  private attachChildEffect(effect: Effect): void {
    this.childEffects.push(effect);
    this.parentEffect = this;
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
    if (this.#destroyed) return; // TODO write tests for this
    if (!this.autorun && !this.shouldRun) return;

    const curBatch = getCurrentBatch();
    if (curBatch) {
      curBatch.batch(this);
    } else {
      this.runCleanupCallback();
      this.curChildEffectSlot = 0;
      this.shouldRun = false;
      this.#nextCleanupCallback = runWithinEffect(this, this.callback);
    }
  }

  recall() {
    this.shouldRun = true;
    if (this.autorun) {
      this.run();
    }
  }

  whenSignalIsRead(signalId: symbol): void {
    if (!this.#signals.has(signalId)) {
      this.#signals.add(signalId);
      globalSignalQueue.on(signalId, 'recall', this);
      globalDestroySignalQueue.once(signalId, $destroySignal, this);
    }
  }

  [$destroySignal](signalId: symbol): void {
    if (!this.#destroyedSignals.has(signalId) && this.#signals.has(signalId)) {
      this.#destroyedSignals.add(signalId);
      globalSignalQueue.off(signalId, this);
      const shouldDestroy = this.#destroyedSignals.size === this.#signals.size;
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

    this.#signals.clear();
    this.#destroyedSignals.clear();

    this.childEffects.forEach((effect) => {
      effect.destroy();
    });
    this.childEffects.length = 0;

    this.parentEffect = undefined;

    --Effect.count;
  }
}
