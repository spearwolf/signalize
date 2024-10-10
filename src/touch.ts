import {signalImpl, isSignal, writeSignal} from './createSignal.js';
import {findObjectSignalByName} from './object-signals.js';
import type {SignalLike} from './types.js';

function touch<Type>(source: SignalLike<Type>): void;

function touch<O extends object, K extends keyof O>(source: [O, K]): void;

function touch(source: any) {
  const signal = signalImpl(
    isSignal(source)
      ? source
      : findObjectSignalByName(...(source as [any, any])),
  );
  if (signal != null && !signal.muted && !signal.destroyed) {
    writeSignal(signal.id, signal.value, {touch: true});
  }
}

export {touch};
