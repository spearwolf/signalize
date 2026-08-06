import type {$signal} from './constants.js';
import type {Signal} from './Signal.js';
import {SignalGroup} from './SignalGroup.js';

export type VoidFunc = () => void;
export type EffectCallback = VoidFunc | (() => VoidFunc);
export type ValueChangedCallback<T> = (value: T) => VoidFunc | void;

/**
 * Where an asynchronously reported effect error came from:
 * - `callback` — the promise returned by the effect callback rejected
 * - `cleanup` — the promise returned by a cleanup callback rejected
 *
 * Synchronous throws are *not* reported here: they propagate to whoever
 * triggered the run.
 */
export type EffectErrorPhase = 'callback' | 'cleanup';

/**
 * What an error handler may rely on about the effect that failed.
 *
 * The value passed is the real effect instance — the same object
 * `onCreateEffect()` hands out — but it is typed down to the two members a
 * failure handler has any business touching. The implementation class stays
 * unexported on purpose: it is internal machinery under active change, and
 * publishing it as a type would freeze `run`, `shouldRun`, `callback`, the
 * static counters and the eventize surface into the public contract.
 */
export interface FailingEffect {
  /** Unique effect id. */
  readonly id: symbol;
  /** Tear the effect down — e.g. when it keeps failing. */
  destroy(): void;
}

/** The single argument an {@link EffectErrorCallback} receives. */
export interface EffectErrorPayload {
  /** The rejection reason — whatever the promise rejected with. */
  readonly error: unknown;
  /** The effect that failed. */
  readonly effect: FailingEffect;
  /** Unique id of that effect, handy for log lines. */
  readonly effectId: symbol;
  /** Which of the two async callbacks rejected. */
  readonly phase: EffectErrorPhase;
}

export type EffectErrorCallback = (payload: EffectErrorPayload) => void;

export type CompareFunc<Type> = (a: Type, b: Type) => boolean;
export type BeforeReadFunc = () => void;

export interface SignalLike<Type = any> {
  [$signal]: ISignalImpl<Type>;
}

export interface ISignalImpl<Type = any> extends SignalLike<Type> {
  id: symbol;
  value: Type | undefined;
  valueFn: () => Type | undefined;
  lazy: boolean;
  compare?: CompareFunc<Type>;
  beforeRead?: BeforeReadFunc;
  muted: boolean;
  destroyed: boolean;
  reader: SignalReader<Type>;
  writer: SignalWriter<Type>;
  object: Signal<Type>;
}

export interface SignalReader<T> extends SignalLike<T> {
  /**
   * Read the signal value.
   *
   * @param callback - **Deprecated.** Passing a callback creates an internal
   *   effect but returns no handle, so the only way to clean it up is to
   *   destroy the signal itself. Use {@link Signal.onChange} instead, which
   *   returns an unsubscribe function. The callback form will be removed in
   *   a future release.
   */
  (callback?: ValueChangedCallback<T>): T;
}

export type SignalWriter<T> = (
  value: T | (() => T),
  params?: SignalWriterParams<T>,
) => void;

export interface SignalParams<T> {
  lazy?: boolean;
  compare?: CompareFunc<T>;
  beforeRead?: BeforeReadFunc;
  attach?: object | SignalGroup;
}

export interface SignalValueParams {
  touch?: boolean;
}

export interface SignalWriterParams<T>
  extends SignalParams<T>,
    SignalValueParams {}
