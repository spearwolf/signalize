import {getSignalInstance, isSignal, writeSignal} from './createSignal';
import {queryObjectSignal} from './object-signals-and-effects';
import {SignalReader} from './types';

function touch<Type>(source: SignalReader<Type>): void;

function touch<O extends object, K extends keyof O>(source: [O, K]): void;

function touch(source: any) {
  const signal = getSignalInstance(
    isSignal(source) ? source : queryObjectSignal(...(source as [any, any])),
  );
  if (signal != null && !signal.muted && !signal.destroyed) {
    writeSignal(signal.id, signal.value, {touch: true});
  }
}

export {touch};
