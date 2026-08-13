import {emit} from '@spearwolf/eventize';
import {isQuiet} from './be-quiet.js';
import {
  beginIsolatedDelivery,
  collectDeliveryError,
  endIsolatedDelivery,
} from './collect-errors.js';
import {$signal} from './constants.js';
import {getCurrentEffect} from './global-effect-stack.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import type {ISignalImpl, SignalLike, SignalValueParams} from './types.js';

// The keep of the signal graph: everything in here may be called from any
// other module, but it calls nothing above itself. That is what keeps the
// import graph acyclic.

let g_signalsCount = 0;

// The counter's second half. `destroySignal()` is the only place that
// decrements, and a signal that is merely dropped never gets there — without
// this the count stays at its high-water mark for the life of the process.
// `getLinksCount()` carries the same correction.
//
// The held value is `undefined`, and that is the whole design: this callback
// needs nothing but the module-level counter it closes over. A held value
// that reaches the SignalImpl would keep it alive, and a SignalImpl holds its
// value — in the decorator pattern that value *is* the host object, so the
// registry would never fire.
const signalFinalizer = new FinalizationRegistry<undefined>(() => {
  --g_signalsCount;
});

/**
 * Register a newly created signal with the global instance counter, and with
 * the finalizer that corrects it if the signal is dropped instead of
 * destroyed.
 * @internal
 */
export const incSignalsCount = (signal: ISignalImpl<any>): void => {
  ++g_signalsCount;
  // The unregister token is the signal itself: tokens are held weakly, so
  // this adds no reachability. `destroySignal()` uses it to take the
  // registration back out.
  signalFinalizer.register(signal, undefined, signal);
};

/**
 * The count of live signals — created, not destroyed, still reachable.
 *
 * `0` means "nothing is reachable any more", not "everything was cleaned
 * up". `docs/api.md`, "Signals" → "Top-level helpers"; the self-correcting
 * detail: `docs/architecture.md` → "Resource counters are eventually
 * consistent, never observably so".
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
 * A destroyed signal stops triggering effects, but stays usable as a plain
 * value container — `set()` stores, reads return — with no way to revive it.
 * `docs/api.md`, "Signals" → "Signal<T> instance", "The same holds for
 * `destroySignal()`…".
 *
 * @throws A single failing effect cleanup unchanged, several as an
 *   `AggregateError`; a throw from anything else on the queue ends the
 *   delivery instead, with what was already collected re-raised with it.
 */
export const destroySignal = (...signalLikes: SignalLike<any>[]): void => {
  for (const sigLike of signalLikes) {
    const signal = signalImpl(sigLike);
    if (signal != null && !signal.destroyed) {
      signal.destroyed = true;
      signal.beforeRead = undefined;
      // Take the registration back out before decrementing: a signal that is
      // explicitly destroyed and *then* collected must not be counted down
      // twice. Deliberately not the `if (gLinksCount > 0)` belt-and-braces
      // that `link.ts` carries next to its own `unregister()` — that would
      // be a branch no test can drive in both directions. The token is
      // sufficient: it is checked synchronously, it removes the cell even if
      // the target has already been collected, and nobody can call this
      // function on a signal that no longer exists.
      signalFinalizer.unregister(signal);
      --g_signalsCount;

      const outerErrors = beginIsolatedDelivery();
      try {
        emit(globalDestroySignalQueue, signal.id, signal.id);
      } catch (err) {
        // Same asymmetry as in `writeSignal()`: an effect parks its own
        // failure in the frame and the delivery goes on. Everything else
        // on this queue — a `SignalLink`, a `SignalGroup`, a
        // `SignalAutoMap`, a memo — is library code without a `catch` of
        // its own, so its throw *does* end the delivery. It must at least
        // not swallow what the effects before it already handed in.
        //
        // The return value is dropped on purpose, and only for as long as
        // the frame above is opened unconditionally: it is then always
        // `true`. The moment that opening becomes conditional, this line
        // turns into a silent swallow and needs the `if (!…) throw err;`
        // the listener in `EffectImpl` carries. Until then that guard
        // belongs in neither `destroySignal()` nor `writeSignal()`: its
        // `throw` branch is unreachable, so it would be dead code.
        //
        // That opening does not become conditional, and the obvious
        // candidate does not pay: gating it on a per-signal-id subscriber
        // count costs 17.2 % on a write, while removing the frame entirely
        // — the ceiling of what any such gate could buy — is 2.1 %.
        collectDeliveryError(err);
      } finally {
        endIsolatedDelivery(
          outerErrors,
          'notifying the subscribers of a destroyed signal',
        );
      }
    }
  }
};

/**
 * Mute a signal so that value changes do not trigger dependent effects.
 *
 * Reads and writes keep working, `touch()` included — only the notification
 * is suppressed. Use `touch()` after {@link unmuteSignal} to push the
 * current value; unmuting alone does not replay it. `docs/recipes.md` →
 * "Writes that don't notify".
 */
export const muteSignal = <Type = unknown>(
  signalLike: SignalLike<Type>,
): void => {
  const signal = signalImpl(signalLike);
  if (signal != null) {
    signal.muted = true;
  }
};

/**
 * Unmute a previously muted signal, restoring normal effect triggering.
 */
export const unmuteSignal = <Type = unknown>(
  signalLike: SignalLike<Type>,
): void => {
  const signal = signalImpl(signalLike);
  if (signal != null) {
    signal.muted = false;
  }
};
