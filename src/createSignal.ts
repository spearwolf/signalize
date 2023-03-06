import {
  Signal,
  SignalCallback,
  SignalParameters,
  SignalReader,
  SignalWriter,
} from './types';

import {$signal} from './constants';
import {createEffect} from './createEffect';
import {getCurrentEffect} from './globalEffectStack';
import {globalDestroySignalQueue, globalSignalQueue} from './globalQueues';
import {UniqIdGen} from './UniqIdGen';

const idCreator = new UniqIdGen('si');

function readSignal(signalId: symbol) {
  getCurrentEffect()?.whenSignalIsRead(signalId);
}

function writeSignal(signalId: symbol) {
  globalSignalQueue.emit(signalId);
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
  id: symbol;
  lazy: boolean;

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
    params?: SignalParameters,
  ) => {
    const lazy = params?.lazy ?? false;
    if (
      lazy !== this.lazy ||
      (lazy && nextValue !== this.valueFn) ||
      (!lazy && nextValue !== this.#value)
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
        writeSignal(this.id);
      }
    }
  };

  constructor(lazy: boolean, initialValue?: Type | (() => Type) | undefined) {
    this.id = idCreator.make();

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

// TODO add optional compare function to createSignal() ?
export function createSignal<Type = unknown>(
  initialValue: Type | SignalReader<Type> | (() => Type) = undefined,
  params?: SignalParameters,
): [SignalReader<Type>, SignalWriter<Type>] {
  let signal!: Signal<Type>;

  if (isSignal(initialValue)) {
    // reuse signal
    signal = (initialValue as SignalReader<Type>)[$signal];
    // or
  } else {
    // create new signal
    const lazy = params?.lazy ?? false;
    signal = new SignalImpl(lazy, initialValue) as Signal<Type>;
  }

  return [signal.reader, signal.writer];
}

export const getSignal = <Type = unknown>(
  signalReader: SignalReader<Type>,
): Signal<Type> => signalReader?.[$signal];

export const destroySignal = <Type = unknown>(
  signalReader: SignalReader<Type>,
): void => {
  const signal = getSignal(signalReader);
  if (signal != null && !signal.destroyed) {
    signal.destroyed = true;
    globalDestroySignalQueue.emit(signal.id, signal.id);
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
    writeSignal(signal.id);
  }
};

// TODO getSignalsCount() => {active, muted}
