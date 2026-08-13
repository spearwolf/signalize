import {findObjectSignalByName} from './object-signals.js';
import {isSignal, signalImpl} from './signal-core.js';
import type {SignalLike, SignalReader} from './types.js';

/**
 * Read a signal's value without creating a dependency (non-tracking read).
 *
 * Not `beQuiet(() => sig.get())` — that goes through the reader and fires
 * `beforeRead`; this reads the stored value directly and skips it, same as
 * `sig.value`, with the `[obj, key]` form on top. `docs/api.md`, "Signals" →
 * "Top-level helpers".
 *
 * @param source - A signal or [object, propertyName] tuple
 * @throws TypeError if source is neither a signal nor an [object, propertyName] tuple
 */
function value<Type>(source: SignalLike<Type> | SignalReader<Type>): Type;

function value<O extends object, K extends keyof O>(source: [O, K]): O[K];

function value(source: any) {
  // See `touch()` — same guard, same reason. The shape is checked,
  // not the lookup result: `value([obj, 'unknown'])` stays `undefined`.
  if (!isSignal(source) && !Array.isArray(source)) {
    throw new TypeError(
      '[signalize] value: source must be a signal or an [object, propertyName] tuple',
    );
  }
  return isSignal(source)
    ? (signalImpl(source)?.value as any)
    : (signalImpl(findObjectSignalByName(...(source as [any, any])))
        ?.value as any);
}

export {value};
