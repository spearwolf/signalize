import type {
  BeforeReadFunc,
  CompareFunc,
  Signal,
  SignalCallback,
  SignalLike,
  SignalParams,
  SignalReader,
  SignalValueParams,
  SignalWriter,
  SignalWriterParams,
} from './types.js';

import {emit} from '@spearwolf/eventize';
import {SignalObject} from './SignalObject.js';
import {UniqIdGen} from './UniqIdGen.js';
import {isQuiet} from './bequiet.js';
import {$signal} from './constants.js';
import {createEffect} from './effects-api.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import {getCurrentEffect} from './globalEffectStack.js';
import {Group} from './Group.js';

const idCreator = new UniqIdGen('si');

function readSignal(signalId: symbol) {
  if (!isQuiet()) {
    getCurrentEffect()?.whenSignalIsRead(signalId);
  }
}

export function writeSignal(
  signalId: symbol,
  value: unknown,
  params?: SignalValueParams,
) {
  emit(globalSignalQueue, signalId, value, params);
}

export const isSignal = (signalLike: any): signalLike is SignalLike<unknown> =>
  signalLike != null && signalLike[$signal] != null;

const createSignalReader = <Type>(signal: Signal<Type>): SignalReader<Type> => {
  const signalReader = (callback?: SignalCallback<Type>) => {
    if (callback) {
      createEffect(() => {
        if (!signal.destroyed) {
          readSignal(signal.id);
        }
        return callback(signal.value);
      }, [signalReader as SignalReader<Type>]);
    } else if (!signal.destroyed) {
      signal.beforeReadFn?.();
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

  get [$signal](): Signal<Type> {
    return this;
  }

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
        // TODO beQuiet ?
        writeSignal(this.id, this.#value);
        return;
      }
    }

    const touch = params?.touch ?? false;

    if (touch) {
      writeSignal(this.id, this.#value, {touch: true});
    }
  };

  readonly object: SignalObject<Type>;

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

    this.object = new SignalObject(this);
  }
}

export const getSignalInstance = <Type = unknown>(
  sig: SignalLike<Type>,
): Signal<Type> => sig?.[$signal];

export function createSignal<Type = unknown>(
  initialValue: Type | SignalLike<Type> | (() => Type) = undefined,
  params?: SignalParams<Type>,
): SignalObject<Type> {
  let signal!: Signal<Type>;

  if (isSignal(initialValue)) {
    // NOTE createSignal(otherSignal) returns otherSignal and does NOT create a new signal
    signal = getSignalInstance(initialValue as SignalLike<Type>);
  } else {
    // === Create a new signal ===
    const lazy = params?.lazy ?? false;
    signal = new SignalImpl(lazy, initialValue) as Signal<Type>;
    signal.beforeReadFn = params?.beforeReadFn;
    signal.compareFn = params?.compareFn;
  }

  if (params?.group) {
    Group.get(params.group).addSignal(signal);
  }

  return signal.object;
}

export const destroySignal = (...signalLikes: SignalLike<any>[]): void => {
  for (const sigLike of signalLikes) {
    const signal = getSignalInstance(sigLike);
    if (signal != null && !signal.destroyed) {
      signal.destroyed = true;
      signal.beforeReadFn = undefined;
      --SignalImpl.instanceCount;
      emit(globalDestroySignalQueue, signal.id, signal.id);
    }
  }
};

// TODO rethink mute() and unmute() signatures -> how to toggle ?

export const muteSignal = <Type = unknown>(
  signalLike: SignalLike<Type>,
): void => {
  const signal = getSignalInstance(signalLike);
  if (signal != null) {
    signal.muted = true;
  }
};

export const unmuteSignal = <Type = unknown>(
  signalLike: SignalLike<Type>,
): void => {
  const signal = getSignalInstance(signalLike);
  if (signal != null) {
    signal.muted = false;
  }
};

export const getSignalsCount = () => SignalImpl.instanceCount;
