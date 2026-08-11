import type {$signal} from './constants.js';
import type {Signal} from './Signal.js';
import {SignalGroup} from './SignalGroup.js';

export type VoidFunc = () => void;
export type EffectCallback = VoidFunc | (() => VoidFunc);
export type ValueChangedCallback<T> = (value: T) => VoidFunc | void;

/**
 * A type that is not a `Promise`/thenable. Used to narrow `batch()`'s
 * callback so an `async` function (or anything else returning a thenable)
 * is rejected by `tsc` before it ever runs — see `batch()`'s JSDoc for why
 * an async callback cannot work there at all.
 */
export type NonThenable<T> = T extends PromiseLike<unknown> ? never : T;

/**
 * Where an effect error with no caller left to throw at came from:
 * - `callback` — the promise returned by an `async` effect callback rejected
 * - `cleanup` — the promise returned by an `async` cleanup rejected, or a
 *   stale cleanup threw synchronously: one whose run was superseded, or
 *   whose effect was already destroyed by the time it ran
 *
 * A synchronous throw from a cleanup that is still part of a live `run()` or
 * `destroy()` normally keeps propagating to whoever triggered it instead of
 * being reported here — a stale cleanup has no such caller left, full stack
 * still present or not.
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
  /**
   * Which callback failed — `cleanup` also covers a stale synchronous throw
   * with no legitimate owner to catch it.
   */
  readonly phase: EffectErrorPhase;
}

export type EffectErrorCallback = (payload: EffectErrorPayload) => void;

export type CompareFunc<Type> = (a: Type, b: Type) => boolean;
export type BeforeReadFunc = () => void;

/**
 * The type parameter defaults to `unknown`: a bare `SignalLike` makes no claim
 * about its value type. Name the type you mean — `SignalLike<number>`.
 *
 * Where "some signal, any value type" is the actual meaning — a parameter
 * position, or a heterogeneous collection — `SignalLike<any>` is the right
 * spelling, for callers as much as for this library. `SignalLike<Type>` is
 * invariant in `Type` (`compare?: CompareFunc<Type>` is checked
 * contravariantly under `strictFunctionTypes`), so `SignalLike<unknown>`
 * there rejects every concrete `Signal<T>` handed to it.
 */
export interface SignalLike<Type = unknown> {
  [$signal]: ISignalImpl<Type>;
}

/** Same default as {@link SignalLike}: `unknown`, not `any`. */
export interface ISignalImpl<Type = unknown> extends SignalLike<Type> {
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

/**
 * The callable form of `signal.set`, as an overload pair.
 *
 * - `set(value, params?)` stores the value. The params are the published
 *   `SignalWriterParams<T>` unchanged — a variable, a wrapper's pass-through
 *   argument, anything.
 * - `set(factory, {lazy: true})` stores the factory and evaluates it on the
 *   next read.
 *
 * **The discrimination is on the value argument, not on the params.** A
 * factory is not a `T` (unless `T` is itself a function type), so it misses
 * the value overload; and it only reaches the factory overload with a
 * `lazy` that is statically `true`. That is what makes a bare `set(fn)` a
 * compile error instead of a silent store-the-function (TYPE-002), without
 * putting any condition on the params of the value branch — which is where
 * two earlier attempts broke every caller holding a `SignalWriterParams<T>`
 * variable.
 *
 * The value overload comes first on purpose. A signal whose `T` is itself a
 * function type keeps taking its functions as values, not as factories.
 *
 * Two consequences worth knowing:
 *
 * - `set(fn, params)` where `params` is typed `SignalWriterParams<T>` does
 *   **not** compile, because that type says `lazy?: boolean` and boolean is
 *   not a promise that it is `true`. Write the literal (`set(fn, {lazy:
 *   true})`), pin it (`{lazy: true} as const`), or annotate the variable
 *   `SignalWriterParams<T> & {lazy: true}`. Spreading (`{...params}`) does
 *   *not* help — the spread keeps `lazy?: boolean`.
 * - `set(fn, {lazy: false})` matches no overload and is reported as
 *   `TS2769: No overload matches this call` without naming `lazy`. Read it
 *   as "a factory needs `{lazy: true}`".
 */
export interface SignalWriter<T> {
  (value: T, params?: SignalWriterParams<T>): void;
  (value: () => T, params: SignalWriterParams<T> & {lazy: true}): void;
}

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

/**
 * The structural subset of the standard `AbortSignal` that `nextValue()`
 * and `asyncValues()` actually touch.
 *
 * Named as its own type rather than referencing the global `AbortSignal`:
 * that global lives in `lib.dom.d.ts` or in `@types/node`, and a consumer
 * compiling against plain `"lib": ["ES2023"]` has neither — the published
 * declarations would not resolve for them (BUILD-005). Every real
 * `AbortSignal`, DOM or Node, satisfies this shape.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
  readonly reason?: unknown;
  addEventListener(
    type: 'abort',
    listener: () => void,
    options?: {once?: boolean},
  ): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}
