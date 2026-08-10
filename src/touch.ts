import {findObjectSignalByName} from './object-signals.js';
import {isSignal, signalImpl, writeSignal} from './signal-core.js';
import type {SignalLike} from './types.js';

/**
 * Force a signal to notify its dependents even if its value hasn't changed.
 * Useful for triggering effects when the signal's internal state may have
 * mutated without a new value assignment.
 *
 * @param source - A signal or [object, propertyName] tuple
 * @throws TypeError if source is neither a signal nor an [object, propertyName] tuple
 */
function touch<Type>(source: SignalLike<Type>): void;

function touch<O extends object, K extends keyof O>(source: [O, K]): void;

function touch(source: any) {
  // CONS-007: the same answer `link()` gives. Without this the non-tuple
  // case ran straight into the spread below and the caller got
  // `Spread syntax requires ...iterable[Symbol.iterator] to be a function`,
  // which names neither this function nor its argument. The shape is
  // checked, not the lookup result: `touch([obj, 'unknown'])` stays the
  // documented no-op.
  if (!isSignal(source) && !Array.isArray(source)) {
    throw new TypeError(
      '[signalize] touch: source must be a signal or an [object, propertyName] tuple',
    );
  }
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
