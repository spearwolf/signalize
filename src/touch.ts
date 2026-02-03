import {signalImpl, isSignal, writeSignal} from './createSignal.js';
import {findObjectSignalByName} from './object-signals.js';
import type {SignalLike} from './types.js';

/**
 * Force a signal to notify its dependents even if its value hasn't changed.
 * Useful for triggering effects when the signal's internal state may have
 * mutated without a new value assignment.
 *
 * @param source - A signal or [object, propertyName] tuple
 */
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
