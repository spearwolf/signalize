import type {$signal} from './constants.js';
import type {Signal} from './Signal.js';
import type {SignalGroup} from './SignalGroup.js';

export type VoidFunc = () => void;
export type EffectCallback = VoidFunc | (() => VoidFunc);
export type ValueChangedCallback<T> = (value: T) => VoidFunc | void;

/**
 * A type that is not a `Promise`/thenable. Narrows the callbacks of `batch()`,
 * `beQuiet()` and `hibernate()`, so an `async` function — or anything else
 * returning a thenable — is rejected by `tsc` before it ever runs. All three
 * also check for a duck-typed thenable at runtime and throw `TypeError`, which
 * is what catches an untyped caller.
 */
export type NonThenable<T> = T extends PromiseLike<unknown> ? never : T;

/**
 * Which half of an effect run produced an error with no caller left to throw
 * at.
 *
 * Which failures land there at all: `docs/api.md`, "Effects" →
 * "onEffectError(cb, priority?)".
 */
export type EffectErrorPhase = 'callback' | 'cleanup';

/**
 * What an error handler may rely on about the effect that failed.
 *
 * The value passed is the real effect instance — the same object
 * `onCreateEffect()` hands out — typed down to the two members a failure
 * handler has any business touching.
 *
 * How it relates to the `Effect` from `createEffect()`: `docs/api.md`,
 * "Effects" → "onEffectError(cb, priority?)".
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
  /** Which callback failed. */
  readonly phase: EffectErrorPhase;
}

export type EffectErrorCallback = (payload: EffectErrorPayload) => void;

/**
 * The single argument a {@link SignalizeErrorCallback} receives — one
 * diagnostic that had no caller to throw at.
 */
export interface SignalizeErrorPayload {
  /**
   * Which console method the message would have gone to without a handler:
   * `error` for a failure, `warn` for a notice.
   */
  readonly level: 'error' | 'warn';
  /**
   * Where the diagnostic came from. New members may appear in a minor
   * release: a `switch` over this needs a `default`.
   *
   * What raises each of them: `docs/api.md`, "Effects" →
   * "onSignalizeError(cb, priority?)".
   */
  readonly source:
    | 'effect'
    | 'group-finalizer'
    | 'link-finalizer'
    | 'automap-finalizer'
    | 'link-count'
    | 'deprecation'
    | 'multiple-instances'
    | 'ignored-option';
  /** Exactly the text the console would have shown. Always present. */
  readonly message: string;
  /**
   * The failure, whatever was thrown. Absent for a notice (`level: 'warn'`) —
   * test for `undefined` rather than assuming an object.
   */
  readonly error?: unknown;
}

export type SignalizeErrorCallback = (payload: SignalizeErrorPayload) => void;

export type CompareFunc<Type> = (a: Type, b: Type) => boolean;
export type BeforeReadFunc = () => void;

/**
 * The type parameter defaults to `unknown`: a bare `SignalLike` makes no claim
 * about its value type. Name the type you mean — `SignalLike<number>`.
 *
 * The brand is internal and stays that way: `$signal` is exported from no
 * entry point, so this interface is inspectable from the outside but not
 * implementable. Only `createSignal()` produces one; `isSignal(v)` is the way
 * to recognise one.
 *
 * Why a parameter position wants `SignalLike<any>`: `docs/api.md`, "Types".
 */
export interface SignalLike<Type = unknown> {
  [$signal]: ISignalImpl<Type>;
}

/**
 * What a link lets a consumer see of the signal it reads from.
 *
 * The value passed is the real signal implementation — the same object the
 * library works with — typed down to the four read-only members an observer
 * has any business touching. Whoever needs to write holds the `Signal` the
 * link was made from.
 */
// Keep every member read-only and function-free: `Type` appears in `value` and
// nowhere else, a covariant position only, which is what makes
// `SignalLink<Type>` covariant — and the machinery (`valueFn`, `reader`,
// `writer`, `object`) stays out, or a one-way read becomes a second way to
// drive the source. Cover in `types.public-surface.spec.ts` is uneven: adding
// `writer` reddens both `keeps the implementation layer out of the entry point
// and off the link` and `makes a bare SignalLike / SignalLink / ValueCallback
// annotation say what it carries`, `compare` only the second, `beforeRead`
// neither — it rests on this rule alone.
export interface LinkSource<Type = unknown> {
  /** Unique signal id — the key both global queues route on. */
  readonly id: symbol;
  /**
   * The source's current value, untracked: the stored property, read
   * without running the source's `beforeRead` hook.
   *
   * When that differs from a read through the source: `docs/api.md`,
   * "Links" → "SignalLink<T> instance".
   */
  readonly value: Type | undefined;
  /** Whether the source is muted — see `muteSignal()`. */
  readonly muted: boolean;
  /** Whether the source has been destroyed. */
  readonly destroyed: boolean;
}

/**
 * Same default as {@link SignalLike}: `unknown`, not `any`.
 *
 * Implementation layer: exported inside the module graph, from no entry
 * point — pinned by `keeps the implementation layer out of the entry point
 * and off the link` in `types.public-surface.spec.ts`. The public view of a
 * signal behind a link is {@link LinkSource}.
 */
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

/**
 * The callable form of `signal.get`, as an overload pair.
 *
 * The deprecated callback signature comes first, and that order is load
 * bearing: a generic inference over an overloaded function type picks the
 * *last* signature, so with the plain read last, `vi.fn(reader)` and every
 * higher-order wrapper keep inferring a zero-argument call. Witnessed by
 * `infers the zero-argument read from a SignalReader` in
 * `types.public-surface.spec.ts`, which turns a swap into a compile error.
 */
export interface SignalReader<T> extends SignalLike<T> {
  /**
   * @deprecated Passing a callback creates an internal effect but returns
   *   no handle, so the only way to clean it up is to destroy the signal
   *   itself. Use {@link Signal.onChange} instead, which returns an
   *   unsubscribe function. The callback form will be removed in a future
   *   release.
   */
  (callback: ValueChangedCallback<T>): T;
  /** Read the signal value, registering a dependency in a running effect. */
  (): T;
}

/**
 * The callable form of `signal.set`, as an overload pair.
 *
 * - `set(value, params?)` stores the value. Its params are the published
 *   `SignalWriterParams<T>` and nothing wider: a statically `true` `lazy`
 *   is refused, and so is a key the type does not declare.
 * - `set(factory, {lazy: true})` stores the factory and evaluates it on the
 *   next read.
 *
 * The discrimination is on the value argument, not on the params — which is
 * what makes a bare `set(fn)` a compile error instead of a silent
 * store-the-function. `TS2769` on either branch names no option: read it as
 * "a factory needs `{lazy: true}`", or as "a value is not stored lazily, a
 * factory is".
 *
 * The shapes of `params` that fail, and their repairs: `docs/api.md`,
 * "Signals" → "Signal<T> instance".
 */
// The value overload comes first: a signal whose `T` is itself a function
// type must keep taking its functions as values, not as factories. Nothing
// re-checks that order. The two params clauses below are load-bearing too,
// and those are witnessed — `keeps a stray key out of the value branch` and
// `lets a params object with an index signature through` in
// `types.public-surface.spec.ts`.
export interface SignalWriter<T> {
  <P extends SignalWriterParams<T>>(
    value: T,
    params?: P &
      (P['lazy'] extends true ? never : unknown) &
      (string extends keyof P
        ? unknown
        : number extends keyof P
          ? unknown
          : symbol extends keyof P
            ? unknown
            : Record<Exclude<keyof P, keyof SignalWriterParams<T>>, never>),
  ): void;
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
 * The structural subset of the standard `AbortSignal` that `nextValue()` and
 * `asyncValues()` actually touch. Every real `AbortSignal`, DOM or Node,
 * satisfies this shape.
 */
// Not the global `AbortSignal` — see architecture.md, "The shipped
// declarations resolve under `"lib": ["ES2023"]` alone".
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
