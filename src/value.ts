import {findObjectSignalByName} from './object-signals.js';
import {isSignal, signalImpl} from './signal-core.js';
import type {SignalLike, SignalReader} from './types.js';

/**
 * Read a signal's value without creating a dependency (non-tracking read).
 *
 * This is **not** `beQuiet(() => sig.get())`. That one still goes through
 * the reader and fires `beforeRead`; this one reads `SignalImpl.value`
 * directly and skips the hook — the same read `sig.value` performs, with
 * the `[obj, key]` form on top. `beQuiet()` suppresses the *subscription*,
 * not the hook.
 *
 * Where the difference is observable: a `{lazy: true}` memo recomputes *in*
 * its `beforeRead`, so `value()` never triggers that recompute. It hands
 * back whatever the last read through the reader stored, or `undefined` if
 * there never was one. An eager memo is unaffected — its effect autoruns.
 *
 * @param source - A signal or [object, propertyName] tuple
 * @throws TypeError if source is neither a signal nor an [object, propertyName] tuple
 * @returns The current value of the signal
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
