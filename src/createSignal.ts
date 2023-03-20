import {
  BeforeReadFunc,
  CompareFunc,
  Signal,
  SignalCallback,
  SignalParams,
  SignalReader,
  SignalValueParams,
  SignalWriter,
  SignalWriterParams,
} from './types';

import {UniqIdGen} from './UniqIdGen';
import {$signal} from './constants';
import {createEffect} from './effects-api';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues';
import {getCurrentEffect} from './globalEffectStack';

const idCreator = new UniqIdGen('si');

function readSignal(signalId: symbol) {
  getCurrentEffect()?.whenSignalIsRead(signalId);
}

function writeSignal(
  signalId: symbol,
  value: unknown,
  params?: SignalValueParams,
) {
  globalSignalQueue.emit(signalId, value, params);
}

export const isSignal = (signalReader: any): boolean => {
  return typeof signalReader === 'function' && $signal in signalReader;
};

const createSignalReader = <Type>(signal: Signal<Type>): SignalReader<Type> => {
  const signalReader = (callback?: SignalCallback<Type>) => {
    if (callback) {
      createEffect(() => {
        if (!signal.destroyed) {
          readSignal(signal.id);
        }
        return callback(signal.value);
      });
    } else if (!signal.destroyed) {
      signal.beforeReadFn?.(signal.id);
      readSignal(signal.id);
    }
    return signal.value;
  };

  Object.defineProperty(signalReader, $signal, {
    value: signal,
  });

  return signalReader as SignalReader<Type>;
};

class SignalImpl<Type> implements Signal<Type> {
  static instanceCount = 0;

  id: symbol;

  lazy: boolean;

  compareFn?: CompareFunc<Type>;
  beforeReadFn?: BeforeReadFunc;

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

    const compareFn = params?.compareFn ?? this.compareFn;
    const equals: CompareFunc<Type> =
      compareFn ?? ((a: Type, b: Type) => a === b);

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

    if (touch) {
      writeSignal(this.id, this.#value, {touch: true});
    }
  };

  constructor(lazy: boolean, initialValue?: Type | (() => Type) | undefined) {
    this.id = idCreator.make();

    ++SignalImpl.instanceCount;

    this.lazy = lazy;

    if (this.lazy) {
      this.value = undefined;
      this.valueFn = initialValue as () => Type;
    } else {
      this.value = initialValue as Type;
      this.valueFn = undefined;
    }

    this.reader = createSignalReader(this);
  }
}

export const getSignal = <Type = unknown>(
  signalReader: SignalReader<Type>,
): Signal<Type> => signalReader?.[$signal];

export function createSignal<Type = unknown>(
  initialValue: Type | SignalReader<Type> | (() => Type) = undefined,
  params?: SignalParams<Type>,
): [SignalReader<Type>, SignalWriter<Type>] {
  let signal!: Signal<Type>;

  if (isSignal(initialValue)) {
    // NOTE createSignal(otherSignal) returns otherSignal and does NOT create a new signal
    signal = getSignal(initialValue as SignalReader<Type>);
  } else {
    // === Create a new signal ===
    const lazy = params?.lazy ?? false;
    signal = new SignalImpl(lazy, initialValue) as Signal<Type>;
    signal.beforeReadFn = params?.beforeReadFn;
    signal.compareFn = params?.compareFn;
  }

  return [signal.reader, signal.writer];
}

export const destroySignal = (...signalReaders: SignalReader<any>[]): void => {
  for (const signalReader of signalReaders) {
    const signal = getSignal(signalReader);
    if (signal != null && !signal.destroyed) {
      signal.destroyed = true;
      signal.beforeReadFn = undefined;
      --SignalImpl.instanceCount;
      globalDestroySignalQueue.emit(signal.id, signal.id);
    }
  }
};

export const muteSignal = <Type = unknown>(
  signalReader: SignalReader<Type>,
): void => {
  const signal = getSignal(signalReader);
  if (signal != null) {
    signal.muted = true;
  }
};

export const unmuteSignal = <Type = unknown>(
  signalReader: SignalReader<Type>,
): void => {
  const signal = getSignal(signalReader);
  if (signal != null) {
    signal.muted = false;
  }
};

export const value = <Type = unknown>(
  signalReader: SignalReader<Type>,
): Type | undefined => getSignal(signalReader)?.value;

export const touch = <Type = unknown>(
  signalReader: SignalReader<Type>,
): void => {
  const signal = getSignal(signalReader);
  if (signal != null && !signal.muted && !signal.destroyed) {
    writeSignal(signal.id, signal.value, {touch: true});
  }
};

export const getSignalsCount = () => SignalImpl.instanceCount;
