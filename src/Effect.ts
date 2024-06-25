import type {
  DestroyEffectCallback,
  EffectCallback,
  RunEffectCallback,
  SignalLike,
  VoidCallback,
} from './types.js';

import {UniqIdGen} from './UniqIdGen.js';
import {getCurrentBatch} from './batch.js';
import {$createEffect, $destroyEffect, $destroySignal} from './constants.js';
import {getSignalInstance} from './createSignal.js';
import {
  globalDestroySignalQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './global-queues.js';
import {getCurrentEffect, runWithinEffect} from './globalEffectStack.js';

export type EffectDeps = SignalLike<any>[];

export interface EffectParams {
  autorun?: boolean;
  dependencies?: EffectDeps;
}

const isThenable = (value: unknown): value is Promise<unknown> =>
  value != null && typeof (value as Promise<unknown>).then === 'function';

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

  #dependencies?: SignalLike<unknown>[];

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
    this.#dependencies = options?.dependencies;

    // a batch will call the effect by id to run the effect
    this.id = Effect.idGen.make();
    globalEffectQueue.on(this.id, 'recall', this);

    ++Effect.count;
  }

  private hasStaticDeps() {
    return this.#dependencies != null && this.#dependencies.length > 0;
  }

  private saveSignalsFromDeps() {
    for (const sig of this.#dependencies!) {
      this.whenSignalIsRead(getSignalInstance(sig).id);
    }
  }

  static createEffect(
    callback: EffectCallback,
    optsOrDeps?: EffectParams | EffectDeps,
    opts?: EffectParams,
  ): [RunEffectCallback, DestroyEffectCallback] {
    const dependencies = Array.isArray(optsOrDeps) ? optsOrDeps : undefined;

    const options: EffectParams | undefined = dependencies
      ? opts ?? {dependencies}
      : (optsOrDeps as EffectParams | undefined);

    if (options && dependencies) {
      options.dependencies = dependencies;
    }

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

    if (effect.hasStaticDeps()) {
      effect.saveSignalsFromDeps();
    } else if (effect.autorun) {
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
    if (this.#destroyed) return;
    if (!this.shouldRun) return;

    const curBatch = getCurrentBatch();
    if (curBatch) {
      curBatch.batch(this.id);
    } else {
      this.runCleanupCallback();
      this.curChildEffectSlot = 0;
      this.shouldRun = false;

      if (this.hasStaticDeps()) {
        this.#nextCleanupCallback = this.callback() as VoidCallback;
      } else {
        this.#nextCleanupCallback = runWithinEffect(this, this.callback);
      }
    }
  }

  /**
   * Eventually run the _effect callback_
   *
   * If the _autorun_ flag is activated, then the effect is executed immediately in any case.
   * Otherwise the effect is only executed if it is necessary.
   *
   * The necessity is given if
   * - the effect has been initialized but has not yet run
   * - a signal used in the effect has changed
   */
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
      const cleanupCallback = this.#nextCleanupCallback;
      this.#nextCleanupCallback = undefined;
      if (isThenable(cleanupCallback)) {
        Promise.resolve(cleanupCallback).then((cleanup) => {
          if (typeof cleanup === 'function') {
            cleanup();
          }
        });
      } else {
        cleanupCallback();
      }
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

    --Effect.count;
  }
}
