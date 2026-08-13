// Leaf module — it may import `@spearwolf/eventize`, `./constants.js`,
// `./global-queues.js`, `./instances.js` and, type-only, `./types.js`. The
// last line of this file registers the copy this module belongs to, and
// `instances.ts` is a leaf below it that never imports back. Nothing else, and
// `./effects.ts` least of all: `effects.ts` → `EffectImpl.ts` → `SignalGroup.ts`
// is a chain of value imports, and `SignalGroup.ts` reports through this
// module — a value import of `effects.ts` here would close that ring.
// `rollup.config.mjs`'s CIRCULAR_DEPENDENCY branch fails the bundle, so the
// mistake is caught, but only at `pnpm bundle`, not at `tsc`.

import {emit, on} from '@spearwolf/eventize';
import {$signalizeError} from './constants.js';
import {globalEffectQueue} from './global-queues.js';
import {registerSignalizeInstance} from './instances.js';
import type {SignalizeErrorCallback, SignalizeErrorPayload} from './types.js';

// Module-local counter, the same shape as `effect-error-handlers.ts` — no
// module of its own because this file is already a leaf and nothing else
// would ever import it. Kept honest by the same `released` guard: eventize's
// unsubscribe is idempotent, so a second call must not decrement twice.
//
// Same known boundary as `effect-error-handlers.ts`, not fixed here either:
// `SignalizeErrorCallback` is a function type, but eventize also accepts an
// *object* listener and calls `obj[$signalizeError](...)` on it — reachable
// only past `tsc`, e.g. `onSignalizeError(someEffectImplInstance as any)`.
// If that object is later an `EffectImpl` that gets destroyed,
// `EffectImpl#destroy()`'s `off(globalEffectQueue, this)` removes the
// `$signalizeError` subscription by listener identity too, without going
// through the unsubscribe this module wrapped — the counter does not learn
// of it. See `effect-error-handlers.ts` for the full mechanism and the
// measured effect (counter positive, queue empty, a report reaches nobody).
//
// Whether anyone listens is read from this counter, not probed on the
// queue: `getSubscribedEventNames()` builds an array with one entry per
// subscribed event name and scans it linearly, which is quadratic in the
// number of live effects because each subscribes under its own id.
//
// The counter can only be wrong on the safe side: an undercount just falls
// through to the console a call early — an overcount would run `emit()`
// against zero listeners and swallow the diagnostic.
let signalizeErrorHandlerCount = 0;

const trackSignalizeErrorHandler = (unsubscribe: () => void): (() => void) => {
  signalizeErrorHandlerCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    signalizeErrorHandlerCount--;
    unsubscribe();
  };
};

/**
 * Subscribe to the diagnostics that have no caller to throw at.
 *
 * Some failures surface where nobody is left to catch them — inside a
 * `FinalizationRegistry` callback of `SignalGroup`, `link()` or
 * `SignalAutoMap`, a throw becomes an `uncaughtException` and ends the
 * process.
 *
 * As long as no handler is registered, every message goes to the console
 * exactly as before — same text, same argument shape. Once a handler is
 * registered, the payload goes to it instead and the console stays quiet;
 * whoever installs this channel owns the message, **including the
 * deprecation notices** — if they should stay visible, log them.
 *
 * A handler that throws synchronously is caught. Two lines follow: the
 * handler's failure on `console.error`, then the original payload on the
 * console method its own `level` names — so a notice ends up on
 * `console.warn`, and mocking only `console.error` lets it slip through.
 *
 * **The handler must be synchronous or catch its own errors.** Nothing
 * awaits it, so a rejected promise coming out of it is an unhandled
 * rejection again — the very thing this channel exists to prevent.
 * Reporting to a remote service is the obvious use case and the obvious
 * trap:
 *
 * ```js
 * onSignalizeError(async ({error}) => {        // ✗ a failing send() crashes
 *   await send(error);                         //   the process
 * });
 *
 * const unsubscribe = onSignalizeError(({error, source, message}) => {
 *   void send(error, {source, message}).catch(ignore);              // ✓
 * });
 * ```
 *
 * A handler that throws synchronously also aborts the dispatch: handlers
 * registered with a lower priority never see the event. Keep handlers
 * total, and give the one that must not be missed the highest priority.
 *
 * This is the general channel, not a replacement for {@link onEffectError}.
 * An effect failure is offered to `onEffectError` first, with its
 * structured payload (`effect`, `effectId`, `phase`), and only reaches
 * here when nobody listens there — so a handler never sees the same
 * failure twice.
 *
 * `docs/api.md`, "Effects" → "onSignalizeError(cb, priority?): () => void"
 *
 * @param callback - Receives one {@link SignalizeErrorPayload} per diagnostic
 * @param priority - Optional eventize priority; higher runs first
 * @returns Unsubscribe function
 */
export const onSignalizeError = (
  callback: SignalizeErrorCallback,
  priority?: number,
): (() => void) =>
  trackSignalizeErrorHandler(
    priority == null
      ? on(globalEffectQueue, $signalizeError, callback)
      : on(globalEffectQueue, $signalizeError, priority, callback),
  );

const logToConsole = ({level, message, error}: SignalizeErrorPayload): void => {
  const write = level === 'warn' ? console.warn : console.error;
  if (error === undefined) write(message);
  else write(message, error);
};

/**
 * Report a diagnostic that has no caller to throw at.
 *
 * Never throws: a handler that fails is reported and the original payload
 * still reaches the console, because most call sites run inside a
 * `FinalizationRegistry` callback where a throw ends the process.
 *
 * @internal
 */
export const reportSignalizeError = (payload: SignalizeErrorPayload): void => {
  if (signalizeErrorHandlerCount > 0) {
    try {
      emit(globalEffectQueue, $signalizeError, payload);
      return;
    } catch (handlerError) {
      console.error(
        `[signalize] an onSignalizeError handler threw while reporting a ${payload.source} diagnostic:`,
        handlerError,
      );
    }
  }
  logToConsole(payload);
};

// This module and no other: it sits in the graph of both entry points
// (`./decorators` → `create-signal.ts` → here), it is a leaf, and
// `reportSignalizeError` is exactly the function the record has to carry.
registerSignalizeInstance(import.meta.url, reportSignalizeError);
