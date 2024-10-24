import {SignalGroup} from './SignalGroup.js';
import type {EffectCallback, SignalLike, VoidFunc} from './types.js';

import {emit, eventize, off, on, once} from '@spearwolf/eventize';
import {Effect} from './Effect.js';
import {UniqIdGen} from './UniqIdGen.js';
import {getCurrentBatch} from './batch.js';
import {$createEffect, $destroyEffect, $destroySignal} from './constants.js';
import {signalImpl} from './createSignal.js';
import {
  globalDestroySignalQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './global-queues.js';
import {getCurrentEffect, runWithinEffect} from './globalEffectStack.js';

export type EffectDeps = (SignalLike<any> | string | symbol)[];

export interface EffectOptions {
  autorun?: boolean;
  dependencies?: EffectDeps;
  attach?: object | SignalGroup;
}

const isThenable = (value: unknown): value is Promise<unknown> =>
  value != null && typeof (value as Promise<unknown>).then === 'function';

export class EffectImpl {
  private static idGen = new UniqIdGen('ef');

  static Destroy = 'destroy';

  /** global effect counter */
  static count = 0;

  /** unique effect id */
  readonly id: symbol;

  /** the effect callback */
  readonly callback: EffectCallback;

  #nextCleanupCallback?: VoidFunc;

  readonly #signals: Set<symbol> = new Set();
  readonly #destroyedSignals: Set<symbol> = new Set();

  parentEffect?: EffectImpl;

  private readonly childEffects: EffectImpl[] = [];
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
   * it recognizes the effect and executes the `effect.onReadSignal()` method.
   *
   * The effect then knows which signals are calling it and subscribes to those signal ids in the _global signals queue_.
   *
   * Please do not call this constructor directly, use `createEffect()` instead.
   */
  constructor(callback: EffectCallback, options?: EffectOptions) {
    eventize(this);

    this.callback = callback;

    let group: SignalGroup | undefined;

    if (options?.attach != null) {
      group = SignalGroup.findOrCreate(options.attach);
      group.attachEffect(this);
    }

    this.autorun = options?.autorun ?? true;

    this.#dependencies = options?.dependencies
      ? options.dependencies.map((dep) => {
          switch (typeof dep) {
            case 'string':
            case 'symbol':
              return group.signal(dep);
            default:
              return dep;
          }
        })
      : undefined;

    // a batch will call the effect by id to run the effect
    this.id = EffectImpl.idGen.make();

    on(globalEffectQueue, this.id, 'recall', this);

    ++EffectImpl.count;
  }

  private hasStaticDeps() {
    return this.#dependencies != null && this.#dependencies.length > 0;
  }

  private saveSignalsFromDeps() {
    for (const sig of this.#dependencies!) {
      this.whenSignalIsRead(signalImpl(sig).id);
    }
  }

  static createEffect(
    callback: EffectCallback,
    optsOrDeps?: EffectOptions | EffectDeps,
    opts?: EffectOptions,
  ): Effect {
    const dependencies = Array.isArray(optsOrDeps) ? optsOrDeps : undefined;

    const options: EffectOptions | undefined = dependencies
      ? (opts ?? {dependencies})
      : (optsOrDeps as EffectOptions | undefined);

    if (options && dependencies) {
      options.dependencies = dependencies;
    }

    let effect: EffectImpl | undefined;

    const parentEffect = getCurrentEffect();
    if (parentEffect != null) {
      effect = parentEffect.getCurrentChildEffect();
      if (effect == null) {
        effect = new EffectImpl(callback, options);
        parentEffect.attachChildEffect(effect);
        emit(globalEffectQueue, $createEffect, effect);
      }
      parentEffect.curChildEffectSlot++;
    } else {
      effect = new EffectImpl(callback, options);
      emit(globalEffectQueue, $createEffect, effect);
    }

    if (effect.hasStaticDeps()) {
      effect.saveSignalsFromDeps();
    } else if (effect.autorun) {
      effect.run();
    }

    return new Effect(effect);
  }

  private getCurrentChildEffect(): EffectImpl | undefined {
    return this.childEffects[this.curChildEffectSlot];
  }

  private attachChildEffect(effect: EffectImpl): void {
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
  run = (): void => {
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
        this.#nextCleanupCallback = this.callback() as VoidFunc;
      } else {
        this.#nextCleanupCallback = runWithinEffect(this, this.callback);
      }
    }
  };

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
      on(globalSignalQueue, signalId, 'recall', this);
      once(globalDestroySignalQueue, signalId, $destroySignal, this);
    }
  }

  [$destroySignal](signalId: symbol): void {
    if (!this.#destroyedSignals.has(signalId) && this.#signals.has(signalId)) {
      this.#destroyedSignals.add(signalId);
      off(globalSignalQueue, signalId, this);
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

  destroy = (): void => {
    if (this.#destroyed) return;

    emit(this, EffectImpl.Destroy, this);
    off(this);

    emit(globalEffectQueue, $destroyEffect, this);

    this.runCleanupCallback();

    off(globalSignalQueue, this);
    off(globalEffectQueue, this);
    off(globalDestroySignalQueue, this);

    this.#destroyed = true;

    this.#signals.clear();
    this.#destroyedSignals.clear();

    this.childEffects.forEach((effect) => {
      effect.destroy();
    });
    this.childEffects.length = 0;

    --EffectImpl.count;
  };
}
