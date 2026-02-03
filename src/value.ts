import {signalImpl, isSignal} from './createSignal.js';
import {findObjectSignalByName} from './object-signals.js';
import type {SignalLike, SignalReader} from './types.js';

/**
 * Read a signal's value without creating a dependency (non-tracking read).
 * Unlike signal.get(), this does not subscribe the current effect to the signal.
 * Equivalent to wrapping the read in beQuiet(), but more convenient.
 *
 * @param source - A signal or [object, propertyName] tuple
 * @returns The current value of the signal
 */
function value<Type>(source: SignalLike<Type> | SignalReader<Type>): Type;

function value<O extends object, K extends keyof O>(source: [O, K]): O[K];

function value(source: any) {
  return isSignal(source)
    ? (signalImpl(source)?.value as any)
    : (signalImpl(findObjectSignalByName(...(source as [any, any])))
        ?.value as any);
}

export {value};
