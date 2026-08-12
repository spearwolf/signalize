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

// MEM-006: the counter's second half. `destroySignal()` is the only place
// that decrements, and a signal that is merely dropped never gets there —
// measured: 2000 signals collected (0 of 2000 WeakRefs survive a gc()) while
// the counter stayed at 2000, for the life of the process. `getLinksCount()`
// has had this correction since MEM-001; the signal counter is advertised for
// exactly the same job and was the one place that quietly misled, in the
// opposite direction.
//
// The held value is `undefined`, and that is the whole design: this callback
// needs nothing but the module-level counter it closes over. A held value
// that reaches the SignalImpl would keep it alive, and a SignalImpl holds its
// value — in the decorator pattern that value *is* the host object. Measured
// against the group rework of MEM-003: with `{sig: signal}` as the held
// value, 1000 of 1000 hosts survive and the registry never fires; with
// `undefined`, 0 of 1000.
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
 * Get the current count of live signals — created, not destroyed, and still
 * reachable. Useful for debugging and testing to detect signal leaks.
 *
 * A signal that is explicitly destroyed leaves the count immediately. A
 * signal that is merely dropped leaves it once the garbage collector gets to
 * it (MEM-006), which is a moment nobody can name or force: the counter is
 * eventually consistent, never observably so. Treat a difference as a leak
 * only after explicit teardown.
 *
 * The other direction matters just as much for tests: `0` does not mean
 * "everything was cleaned up", it means "nothing is reachable any more" —
 * dropping the last reference to a signal gets the count there without a
 * single `destroySignal()` ever running.
 *
 * @returns The number of live signals
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
 * A throwing effect cleanup no longer ends the delivery: it is collected until
 * every subscriber of that signal has run, so a link, a group or an auto map
 * registered behind that effect still learns that the signal is gone. A single
 * failure is then re-raised unchanged, several as an `AggregateError` in
 * delivery order.
 *
 * Only effects are isolated, the same exception a write makes: everything else
 * on this queue is library code without a `catch` of its own, and its throw
 * does end the delivery — the failures collected before it are re-raised with
 * it. The frame is per signal, not per call: with several arguments, a failing
 * delivery still leaves the signals behind it untouched.
 *
 * @param signalLikes - Signals to destroy
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
        // That opening does not become conditional. PERF-008 proposed
        // exactly this — tie it to a per-signal-id subscriber count — and
        // was measured and closed on 2026-08-11 without a code change:
        // removing the frame *entirely* buys 2.1 % on a write with no
        // consumers, which is the ceiling, while the counter the finding
        // recommends costs 17.2 %. This comment is the only record of that
        // in the published package — the working is in the repo's
        // `remediation-plan.md`, which is not shipped — so anyone who has
        // the idea again finds the answer where they look for it.
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
 * Reads and writes keep working: `set()` still stores the new value (and
 * `set(fn, {lazy: true})` still installs the factory), only the notification
 * is suppressed — as is `touch()`. Unmuting does not replay a write that
 * happened while muted; since the value is already stored, re-setting it
 * compares equal and stays silent. Use `touch()` after `unmuteSignal()` to
 * push the current value.
 *
 * @param signalLike - The signal to mute
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
 * @param signalLike - The signal to unmute
 */
export const unmuteSignal = <Type = unknown>(
  signalLike: SignalLike<Type>,
): void => {
  const signal = signalImpl(signalLike);
  if (signal != null) {
    signal.muted = false;
  }
};
