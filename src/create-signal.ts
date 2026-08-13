import {$signal} from './constants.js';
import {warnDeprecatedOnce} from './deprecation-warnings.js';
import {requireCreateEffect} from './effect-hook.js';
import {Signal} from './Signal.js';
import {SignalGroup} from './SignalGroup.js';
import {
  incSignalsCount,
  isSignal,
  readSignal,
  signalImpl,
  writeSignal,
} from './signal-core.js';
import {reportSignalizeError} from './signalize-error.js';
import type {
  BeforeReadFunc,
  CompareFunc,
  ISignalImpl,
  SignalLike,
  SignalParams,
  SignalReader,
  SignalWriter,
  SignalWriterParams,
  ValueChangedCallback,
} from './types.js';
import {UniqIdGen} from './UniqIdGen.js';

const idCreator = new UniqIdGen('si');

// The three `SignalParams` keys the passthrough drops on the floor. `attach`
// is missing on purpose: it is applied behind the branch and works on both
// paths. The list is written out instead of derived from `Object.keys(params)`,
// and that is load bearing — `decorators.ts` hands its own options object
// straight to `createSignal()`, and the `name`/`readAsValue` in there are the
// decorator's own business, not dropped signal options. A derived list would
// report them and be wrong on the one call site this library makes itself.
//
// Kept honest by the trip wire below: a `SignalParams` key that is neither
// `attach` nor on this list fails `tsc` at `_checkPassthroughListCoversSignalParams`,
// not silently on the passthrough. Type-only — `declare const` erases on
// emit, so it costs nothing at runtime and nothing in the `.d.ts` (measured
// against `lib/create-signal.js` and `lib/create-signal.d.ts`, both after
// `pnpm compile`), and it needs no `export` to be checked: `tsc` evaluates a
// generic the moment it is referenced, whether or not the declaration using
// it is itself read afterwards.
const PASSTHROUGH_IGNORED_OPTIONS = ['lazy', 'compare', 'beforeRead'] as const;

type _AssertTrue<T extends true> = T;
type _PassthroughListCoversSignalParams =
  Exclude<
    keyof SignalParams<unknown>,
    (typeof PASSTHROUGH_IGNORED_OPTIONS)[number] | 'attach'
  > extends never
    ? true
    : [
        'PASSTHROUGH_IGNORED_OPTIONS is missing a SignalParams key — add it there if it is dropped on the passthrough, or to the Exclude<…> above if it is not (like attach)',
      ];
declare const _checkPassthroughListCoversSignalParams: _AssertTrue<_PassthroughListCoversSignalParams>;

// One instance instead of a fresh arrow built on every `writer()`
// call. `CompareFunc<any>` assigns to `CompareFunc<Type>` (measured clean
// under `tsc --noEmit`), so no cast is needed. Not a `sideEffects: false`
// exception — a plain allocation with no observable effect, tree-shakeable
// like anything else, and `create-signal.ts` is already loaded by any bundle
// that creates a signal.
const DEFAULT_EQUALS: CompareFunc<any> = (a, b) => a === b;

// Module-private, so no `.d.ts` carries it and a deprecation tag here would
// reach no editor. The consumer-visible declaration of this same deprecation
// is the callback overload of `SignalReader` in `types.ts`, which does carry
// the tag.
function warnSignalReaderCallbackDeprecated(): void {
  warnDeprecatedOnce(
    'signalReader(callback)',
    '[signalize] signalReader(callback) is deprecated and will be removed in a future release. Use Signal.onChange(callback) instead — it returns an unsubscribe function for proper cleanup.',
  );
}

const createSignalReader = <Type>(
  signal: ISignalImpl<Type>,
): SignalReader<Type> => {
  const signalReader = (callback?: ValueChangedCallback<Type>) => {
    if (!signal.destroyed) {
      signal.beforeRead?.();
    }
    if (callback) {
      warnSignalReaderCallbackDeprecated();
      requireCreateEffect()(() => {
        if (!signal.destroyed) {
          readSignal(signal.id);
        }
        return callback(signal.value);
      }, [signalReader as SignalReader<Type>]);
    } else if (!signal.destroyed) {
      readSignal(signal.id);
    }
    return signal.value;
  };

  Object.defineProperty(signalReader, $signal, {
    value: signal,
  });

  return signalReader as SignalReader<Type>;
};

class SignalImpl<Type> implements ISignalImpl<Type> {
  id: symbol;

  lazy: boolean;

  get [$signal](): ISignalImpl<Type> {
    return this;
  }

  compare?: CompareFunc<Type>;
  beforeRead?: BeforeReadFunc;

  muted = false;
  destroyed = false;

  #value: Type | undefined = undefined;

  get value(): Type | undefined {
    if (this.lazy) {
      this.#value = this.valueFn();
      this.valueFn = undefined;
      this.lazy = false;
    }
    return this.#value;
  }

  set value(value: Type | undefined) {
    this.#value = value;
  }

  valueFn: () => Type | undefined;

  reader: SignalReader<Type>;

  writer: SignalWriter<Type> = (
    nextValue: Type | (() => Type),
    params?: SignalWriterParams<Type>,
  ) => {
    const lazy = params?.lazy ?? false;

    const compare = params?.compare ?? this.compare;
    const equals: CompareFunc<Type> = compare ?? DEFAULT_EQUALS;

    if (
      lazy !== this.lazy ||
      (lazy && nextValue !== this.valueFn) ||
      (!lazy && !equals(nextValue as Type, this.#value))
    ) {
      if (lazy) {
        this.#value = undefined;
        this.valueFn = nextValue as () => Type;
        this.lazy = true;
      } else {
        this.#value = nextValue as Type;
        this.valueFn = undefined;
        this.lazy = false;
      }
      if (!this.muted && !this.destroyed) {
        writeSignal(this.id, this.#value);
        return;
      }
    }

    const touch = params?.touch ?? false;

    if (touch && !this.muted && !this.destroyed) {
      writeSignal(this.id, this.#value, {touch: true});
    }
  };

  readonly object: Signal<Type>;

  constructor(lazy: boolean, initialValue?: Type | (() => Type) | undefined) {
    this.id = idCreator.make();

    incSignalsCount(this);

    this.lazy = lazy;

    if (this.lazy) {
      this.value = undefined;
      this.valueFn = initialValue as () => Type;
    } else {
      this.value = initialValue as Type;
      this.valueFn = undefined;
    }

    this.reader = createSignalReader(this);

    this.object = new Signal(this);
  }
}

/**
 * Create a new reactive signal from a factory, evaluated on the first read.
 *
 * `{lazy: true}` is required here, not optional, and it has to be statically
 * `true` — that is the whole mechanism. A bare `createSignal<T>(fn)` has no
 * overload to land on and is rejected instead of silently storing the
 * function as the value.
 *
 * Which spellings of `lazy` count as statically `true`: `docs/api.md`,
 * "Signals" → "createSignal<T>(initial?, params?)".
 *
 * @param initialValue - Factory evaluated on the first read
 * @param params - Configuration, with a statically `true` `lazy`
 */
// Declared first so a factory call wins the inference: `createSignal(() => 42,
// {lazy: true})` is a `Signal<number>`, not a `Signal<() => number>`. The test
// `takes a factory only where {lazy: true} says so` runs the call but checks
// at runtime only — it would not go red on a swap.
export function createSignal<Type = unknown>(
  initialValue: () => Type,
  params: SignalParams<Type> & {lazy: true},
): Signal<Type>;
/**
 * Create a new reactive signal with no initial value.
 *
 * The signal holds `undefined` until the first write, and the type says so:
 * `createSignal<number>()` is a `Signal<number | undefined>`, so
 * `const n: number = sig.value` is a compile error rather than a runtime
 * `undefined` wearing a `number` label. Under `strictNullChecks: false` the
 * union collapses back to `Type`.
 *
 * Why those two conditions sit on this overload too: `docs/api.md`,
 * "Signals" → "createSignal<T>(initial?, params?)".
 *
 * @param initialValue - Nothing, or an explicit `undefined`
 * @param params - Optional configuration (compare, beforeRead, attach), with
 *   no statically `true` `lazy` and no key beyond `SignalParams<Type>`
 */
// `initialValue?: undefined` rather than a missing parameter, so
// `createSignal<T>(undefined, {attach: this})` stays a real call; `5` is not
// `undefined`, so this takes nothing from the value overload. Only observable
// under `strictNullChecks: true` — the witness is in `smoke/`, not in `src/`.
export function createSignal<
  Type = unknown,
  P extends SignalParams<Type> = SignalParams<Type>,
>(
  initialValue?: undefined,
  params?: P &
    (P['lazy'] extends true ? never : unknown) &
    (string extends keyof P
      ? unknown
      : number extends keyof P
        ? unknown
        : symbol extends keyof P
          ? unknown
          : Record<Exclude<keyof P, keyof SignalParams<Type>>, never>),
): Signal<Type | undefined>;
/**
 * Create a new reactive signal with an initial value.
 *
 * If passed an existing signal, that signal is returned and no new one is
 * created — which is also why nothing in `params` configures it. `attach` is
 * the single exception, because it is applied behind the branch and belongs
 * to both paths; everything else is dropped, and every such call reports what
 * it was given through `onSignalizeError()` with `source: 'ignored-option'`.
 *
 * A function reaching this overload is stored **as the value**, which is only
 * possible when `Type` is itself a function type — named
 * (`createSignal<() => number>(fn)`) or inferred from the argument
 * (`createSignal(fn)` is a `Signal<() => R>`).
 *
 * The shapes of `params` that fail, and their repairs: `docs/api.md`,
 * "Signals" → "Signal<T> instance".
 *
 * @param initialValue - Initial value, or an existing signal to pass through
 *   (every option but `attach` is then dropped and reported)
 * @param params - Optional configuration (compare, beforeRead, attach), with
 *   no statically `true` `lazy` and no key beyond `SignalParams<Type>`
 */
export function createSignal<
  Type = unknown,
  P extends SignalParams<Type> = SignalParams<Type>,
>(
  initialValue?: Type | SignalLike<Type>,
  params?: P &
    (P['lazy'] extends true ? never : unknown) &
    (string extends keyof P
      ? unknown
      : number extends keyof P
        ? unknown
        : symbol extends keyof P
          ? unknown
          : Record<Exclude<keyof P, keyof SignalParams<Type>>, never>),
): Signal<Type>;
export function createSignal<Type = unknown>(
  initialValue: Type | SignalLike<Type> | (() => Type) = undefined,
  params?: SignalParams<Type>,
): Signal<Type> {
  let signal!: ISignalImpl<Type>;

  if (isSignal(initialValue)) {
    // NOTE createSignal(otherSignal) returns otherSignal and does NOT create a new signal
    signal = signalImpl(initialValue as SignalLike<Type>);

    // The signal that comes back is the one that went in, so nothing
    // in `params` has anything to configure — `attach` below is the exception
    // and applies to both branches. Reported on every such call, not once per
    // process: this marks a misspelled call, not a lifecycle event, and the
    // module-level flag the deprecation notice above uses would also outlive
    // the test that installed it.
    const ignoredOptions = PASSTHROUGH_IGNORED_OPTIONS.filter(
      (key) => params?.[key] != null,
    );
    if (ignoredOptions.length > 0) {
      reportSignalizeError({
        level: 'warn',
        source: 'ignored-option',
        message: `[signalize] createSignal(existingSignal, {${ignoredOptions.join(', ')}}) is a passthrough: it returns the signal that was passed in, so nothing in those braces is applied. Only {attach} works on this path. Configure the signal where it is created, or drop the options.`,
      });
    }
  } else {
    // === Create a new signal ===
    const lazy = params?.lazy ?? false;
    signal = new SignalImpl(lazy, initialValue) as ISignalImpl<Type>;
    signal.beforeRead = params?.beforeRead;
    signal.compare = params?.compare;
  }

  if (params?.attach != null) {
    SignalGroup.findOrCreate(params.attach).attachSignal(signal);
  }

  return signal.object;
}
