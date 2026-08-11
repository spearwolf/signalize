import {$signal} from './constants.js';
import {createEffect} from './effects.js';
import {Signal} from './Signal.js';
import {SignalGroup} from './SignalGroup.js';
import {
  incSignalsCount,
  isSignal,
  readSignal,
  signalImpl,
  writeSignal,
} from './signal-core.js';
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

let signalReaderCallbackDeprecationWarned = false;

function warnSignalReaderCallbackDeprecated(): void {
  if (signalReaderCallbackDeprecationWarned) return;
  signalReaderCallbackDeprecationWarned = true;
  console.warn(
    'signalReader(callback) is deprecated and will be removed in a future release. Use Signal.onChange(callback) instead — it returns an unsubscribe function for proper cleanup.',
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
      createEffect(() => {
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
    const equals: CompareFunc<Type> =
      compare ?? ((a: Type, b: Type) => a === b);

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
 * function as the value (TYPE-002).
 *
 * This overload is declared **first** so a factory call wins the inference:
 * `createSignal(() => 42, {lazy: true})` is a `Signal<number>`, not a
 * `Signal<() => number>`.
 *
 * A params *variable* typed `SignalParams<T>` does not fit — that type says
 * `lazy?: boolean`, which is not a promise that it is `true`. Write the
 * literal, pin it (`{lazy: true} as const`), or annotate the variable
 * `SignalParams<T> & {lazy: true}`. Spreading (`{...params}`) does *not*
 * help: the spread keeps `lazy?: boolean`.
 *
 * @param initialValue - Factory evaluated on the first read
 * @param params - Configuration, with a statically `true` `lazy`
 * @returns A Signal object with get/set methods
 */
export function createSignal<Type = unknown>(
  initialValue: () => Type,
  params: SignalParams<Type> & {lazy: true},
): Signal<Type>;
/**
 * Create a new reactive signal with an optional initial value.
 *
 * If passed an existing signal, returns that signal without creating a new one.
 *
 * The params carry no condition: `SignalParams<Type>` unchanged, so a
 * variable, a wrapper's pass-through argument or an inline literal all fit.
 *
 * A function reaching this overload is stored **as the value** — which is
 * only possible when `Type` is itself a function type, either because it was
 * named (`createSignal<() => number>(fn)`) or because it was inferred from
 * the argument (`createSignal(fn)` is a `Signal<() => R>`).
 *
 * @param initialValue - Initial value, or an existing signal to pass through
 * @param params - Optional configuration (compare, beforeRead, attach)
 * @returns A Signal object with get/set methods
 */
export function createSignal<Type = unknown>(
  initialValue?: Type | SignalLike<Type>,
  params?: SignalParams<Type>,
): Signal<Type>;
export function createSignal<Type = unknown>(
  initialValue: Type | SignalLike<Type> | (() => Type) = undefined,
  params?: SignalParams<Type>,
): Signal<Type> {
  let signal!: ISignalImpl<Type>;

  if (isSignal(initialValue)) {
    // NOTE createSignal(otherSignal) returns otherSignal and does NOT create a new signal
    signal = signalImpl(initialValue as SignalLike<Type>);
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
