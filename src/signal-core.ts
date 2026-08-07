import {emit} from '@spearwolf/eventize';
import {isQuiet} from './bequiet.js';
import {
  beginIsolatedDelivery,
  collectDeliveryError,
  endIsolatedDelivery,
} from './collect-errors.js';
import {$signal} from './constants.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import {getCurrentEffect} from './globalEffectStack.js';
import type {ISignalImpl, SignalLike, SignalValueParams} from './types.js';

// The keep of the signal graph: everything in here may be called from any
// other module, but it calls nothing above itself. That is what keeps the
// import graph acyclic.

let g_signalsCount = 0;

/**
 * Register a newly created signal with the global instance counter.
 * @internal
 */
export const incSignalsCount = (): void => {
  ++g_signalsCount;
};

/**
 * Get the current count of active (non-destroyed) signals.
 * Useful for debugging and testing to detect signal leaks.
 * @returns The number of active signals
 */
export const getSignalsCount = (): number => g_signalsCount;

/**
 * Record a read of the given signal within the currently running effect.
 * @internal
 */
export function readSignal(signalId: symbol): void {
  if (!isQuiet()) {
    getCurrentEffect()?.whenSignalIsRead(signalId);
  }
}

/**
 * Announce a new signal value to the global signal queue.
 *
 * Every subscriber is served before this function returns or throws. Errors
 * thrown by effect callbacks are collected until the delivery is complete
 * instead of ending it, so a failing effect never costs its lower-priority
 * siblings their notification. A single failure is then re-raised unchanged,
 * several as an `AggregateError` in delivery order.
 * @internal
 */
export function writeSignal(
  signalId: symbol,
  value: unknown,
  params?: SignalValueParams,
) {
  if (!isQuiet()) {
    const outerErrors = beginIsolatedDelivery();
    try {
      emit(globalSignalQueue, signalId, value, params);
    } catch (err) {
      // Not everything on this queue is an effect: a link callback
      // (`SignalLink`, one `on(globalSignalQueue, source.id, …)` per link)
      // is application code that is *not* isolated, and its throw does end
      // the delivery. What must not happen is that it also swallows the
      // failures the effects before it already handed in — so it joins
      // them, in the order everything ran.
      collectDeliveryError(err);
    } finally {
      endIsolatedDelivery(
        outerErrors,
        'notifying the effects of a signal write',
      );
    }
  }
}

/**
 * Check if a value is a signal (Signal, SignalReader, or SignalWriter).
 * @param signalLike - The value to check
 * @returns True if the value is a signal-like object
 */
export const isSignal = (signalLike: any): signalLike is SignalLike<unknown> =>
  signalLike != null && signalLike[$signal] != null;

/**
 * Unwrap the internal signal implementation from any signal-like value.
 * @internal
 */
export const signalImpl = <Type = unknown>(
  sig: SignalLike<Type>,
): ISignalImpl<Type> => sig?.[$signal];

/**
 * Destroy one or more signals, cleaning up all subscriptions and resources.
 *
 * Destroyed signals no longer trigger effects when read or written — but they
 * remain usable as plain value containers: `set()` stores the new value and
 * reads return it. There is no way to revive them.
 *
 * @param signalLikes - Signals to destroy
 */
export const destroySignal = (...signalLikes: SignalLike[]): void => {
  for (const sigLike of signalLikes) {
    const signal = signalImpl(sigLike);
    if (signal != null && !signal.destroyed) {
      signal.destroyed = true;
      signal.beforeRead = undefined;
      --g_signalsCount;
      emit(globalDestroySignalQueue, signal.id, signal.id);
    }
  }
};

/**
 * Mute a signal so that value changes do not trigger dependent effects.
 *
 * Reads and writes keep working: `set()` still stores the new value (and
 * `set(fn, {lazy: true})` still installs the factory), only the notification
 * is suppressed — as is `touch()`. Unmuting does not replay a write that
 * happened while muted; since the value is already stored, re-setting it
 * compares equal and stays silent. Use `touch()` after `unmuteSignal()` to
 * push the current value.
 *
 * @param signalLike - The signal to mute
 */
export const muteSignal = <Type = any>(signalLike: SignalLike<Type>): void => {
  const signal = signalImpl(signalLike);
  if (signal != null) {
    signal.muted = true;
  }
};

/**
 * Unmute a previously muted signal, restoring normal effect triggering.
 * @param signalLike - The signal to unmute
 */
export const unmuteSignal = <Type = any>(
  signalLike: SignalLike<Type>,
): void => {
  const signal = signalImpl(signalLike);
  if (signal != null) {
    signal.muted = false;
  }
};
