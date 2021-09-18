import {UniqIdGen} from './UniqIdGen';
import {$signal} from './constants';
import {getCurrentEffect} from './globalEffectStack';
import globalSignals from './globalSignals';
import {Signal, SignalReader, SignalWriter} from './types';

const idGen = new UniqIdGen('si');

function readSignal(signalId: symbol) {
  getCurrentEffect()?.rerunOnSignal(signalId);
}

function writeSignal(signalId: symbol) {
  globalSignals.emit(signalId);
}

export function createSignal<Type = unknown>(
  initialValue: Type = undefined,
): [SignalReader<Type>, SignalWriter<Type>] {
  const signal: Signal<Type> = {id: idGen.make(), value: initialValue};

  const signalReader = () => {
    readSignal(signal.id);
    return signal.value;
  };

  Object.defineProperty(signalReader, $signal, {
    value: signal,
  });

  const signalWriter = (nextValue: Type) => {
    if (nextValue !== signal.value) {
      signal.value = nextValue;
      writeSignal(signal.id);
    }
  };

  return [signalReader as SignalReader<Type>, signalWriter];
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

export const isSignal = (signalReader: Function): boolean => {
  return $signal in signalReader;
};
