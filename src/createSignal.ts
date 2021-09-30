import {UniqIdGen} from './UniqIdGen';
import {$signal} from './constants';
import {createEffect} from './createEffect';
import {getCurrentEffect} from './globalEffectStack';
import globalSignals from './globalSignals';
import {Signal, SignalCallback, SignalReader, SignalWriter} from './types';

const idGen = new UniqIdGen('si');

function readSignal(signalId: symbol) {
  getCurrentEffect()?.rerunOnSignal(signalId);
}

function writeSignal(signalId: symbol) {
  globalSignals.emit(signalId);
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isSignal = (signalReader: any): boolean => {
  return typeof signalReader === 'function' && $signal in signalReader;
};

export function createSignal<Type = unknown>(
  initialValue: Type | SignalReader<Type> = undefined,
): [SignalReader<Type>, SignalWriter<Type>] {
  let signal!: Signal<Type>;

  if (isSignal(initialValue)) {
    signal = (initialValue as SignalReader<Type>)[$signal];
  } else {
    signal = {
      id: idGen.make(),
      value: initialValue as Type,
      reader: undefined,
      writer: (nextValue: Type) => {
        if (nextValue !== signal.value) {
          signal.value = nextValue;
          writeSignal(signal.id);
        }
      },
    };

    const signalReader = (callback?: SignalCallback<Type>) => {
      if (callback) {
        createEffect(() => {
          readSignal(signal.id);
          return callback(signal.value);
        });
      } else {
        readSignal(signal.id);
      }
      return signal.value;
    };

    Object.defineProperty(signalReader, $signal, {
      value: signal,
    });

    signal.reader = signalReader as SignalReader<Type>;
  }

  return [signal.reader, signal.writer];
}

export const value = <Type = unknown>(
  signalReader: SignalReader<Type>,
): Type | undefined => signalReader[$signal]?.value;

export const touch = <Type = unknown>(
  signalReader: SignalReader<Type>,
): void => {
  const signalId = signalReader[$signal]?.id;
  if (signalId) {
    writeSignal(signalId);
  }
};
