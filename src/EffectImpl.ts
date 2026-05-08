import {
  type EventizedObject,
  emit,
  eventize,
  off,
  on,
  once,
} from '@spearwolf/eventize';
import {getCurrentBatch} from './batch.js';
import {
  $createEffect,
  $destroyEffect,
  $destroySignal,
  DESTROY,
  RECALL,
} from './constants.js';
import {signalImpl} from './createSignal.js';
import {Effect} from './Effect.js';
import {
  globalDestroySignalQueue,
  globalEffectCalledQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './global-queues.js';
import {getCurrentEffect, runWithinEffect} from './globalEffectStack.js';
import {SignalGroup} from './SignalGroup.js';
import type {EffectCallback, SignalLike, VoidFunc} from './types.js';
import {UniqIdGen} from './UniqIdGen.js';

export type EffectDeps = (SignalLike<any> | string | symbol)[];

export interface EffectOptions {
  autorun?: boolean;
  dependencies?: EffectDeps;
  attach?: object | SignalGroup;
  priority?: number;
}

const isThenable = (value: unknown): value is Promise<unknown> =>
  value != null && typeof (value as Promise<unknown>).then === 'function';

// Eventize injects EventizedObject members at runtime via eventize(this) in
// the constructor — declaration merging tells TS the brand is present.
export interface EffectImpl extends EventizedObject {}

export class EffectImpl {
  private static idGen = new UniqIdGen('ef');

  /** global effect counter */
  static count = 0;

  /**
   * Maximum allowed re-entrant depth of `EffectImpl.run()`.
   *
   * Effects that synchronously write to a signal they depend on re-enter
   * `run()` recursively. Without a guard, a runaway loop would terminate
   * with a native `RangeError` (stack overflow) at an arbitrary depth.
   *
   * When the counter exceeds this limit, `run()` throws a descriptive
   * `Error` instead, naming the effect id and the limit. The default of
   * 256 is well above realistic legitimate fixpoint iterations and well
   * below the JS stack limit on common engines.
   *
   * Tune via `EffectImpl.maxDepth = N` if you intentionally need deeper
   * recursion — but prefer breaking the cycle.
   */
  static maxDepth = 256;

  /** unique effect id */
  readonly id: symbol;

  /** the effect callback */
  readonly callback: EffectCallback;

  #nextCleanupCallback?: VoidFunc;

  readonly #signals: Set<symbol> = new Set();

  #lostSignals: Set<symbol> = new Set();
  readonly #signalSubscriptions: Map<symbol, Array<() => void>> = new Map();

  readonly #destroyedSignals: Set<symbol> = new Set();

  private readonly childEffects: EffectImpl[] = [];
  private curChildEffectSlot = 0;

  autorun = true;
  shouldRun = true;

  readonly priority: number;

  #dependencies?: SignalLike<unknown>[];

  #destroyed = false;

  #runDepth = 0;

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

    this.priority = options?.priority ?? 0;

    on(globalEffectQueue, this.id, RECALL, this);

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
      curBatch.batch(this.id, this.priority);
      return;
    }

    if (this.#runDepth >= EffectImpl.maxDepth) {
      throw new Error(
        `[signalize] Effect ${this.id.toString()} exceeded maxDepth=${EffectImpl.maxDepth}: ` +
          'an effect callback recursively re-triggered itself (likely by writing a signal it depends on). ' +
          'Break the cycle, or raise EffectImpl.maxDepth if the recursion is intentional.',
      );
    }

    this.#runDepth++;
    try {
      this.runCleanupCallback();
      this.destroyChildEffects();

      this.curChildEffectSlot = 0;
      this.shouldRun = false;

      emit(globalEffectCalledQueue, this.id, this.id);

      if (this.hasStaticDeps()) {
        this.#nextCleanupCallback = this.callback() as VoidFunc;
      } else {
        this.#lostSignals.clear();
        for (const id of this.#signals) {
          this.#lostSignals.add(id);
        }
        this.#nextCleanupCallback = runWithinEffect(this, this.callback);
        this.cleanupLostSignals();
        this.#destroyedSignals.clear();
      }
    } finally {
      this.#runDepth--;
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
  [RECALL]() {
    this.shouldRun = true;
    if (this.autorun) {
      this.run();
    }
  }

  whenSignalIsRead(signalId: symbol): void {
    this.#lostSignals.delete(signalId);

    if (!this.#signals.has(signalId)) {
      this.#signals.add(signalId);

      this.#signalSubscriptions.set(signalId, [
        on(globalSignalQueue, signalId, this.priority, RECALL, this),
        once(globalDestroySignalQueue, signalId, $destroySignal, this),
      ]);
    }
  }

  [$destroySignal](signalId: symbol): void {
    if (!this.#destroyedSignals.has(signalId) && this.#signals.has(signalId)) {
      this.#destroyedSignals.add(signalId);

      this.unsubscribeSignal(signalId);

      if (this.#destroyedSignals.size === this.#signals.size) {
        // no signals left, so nobody can trigger this effect anymore
        this.destroy();
      }
    }
  }

  private cleanupLostSignals(): void {
    for (const signalId of this.#lostSignals) {
      this.unsubscribeSignal(signalId);
      this.#signals.delete(signalId);
    }
  }

  private destroyChildEffects(): void {
    for (const effect of this.childEffects) {
      effect.destroy();
    }
    this.childEffects.length = 0;
  }

  private unsubscribeSignal(signalId: symbol): void {
    if (this.#signalSubscriptions.has(signalId)) {
      this.#signalSubscriptions.get(signalId).forEach((unsubscribe) => {
        unsubscribe();
      });
      this.#signalSubscriptions.delete(signalId);
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

    emit(this, DESTROY, this);
    off(this);

    emit(globalEffectQueue, $destroyEffect, this);

    this.runCleanupCallback();
    this.destroyChildEffects();

    off(globalSignalQueue, this);
    off(globalEffectQueue, this);
    off(globalDestroySignalQueue, this);

    this.#destroyed = true;

    this.#signals.clear();
    this.#lostSignals.clear();
    this.#signalSubscriptions.clear();
    this.#destroyedSignals.clear();

    --EffectImpl.count;
  };
}
