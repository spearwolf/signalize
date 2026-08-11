// Leaf module — it may import `@spearwolf/eventize`, `./constants.js`,
// `./global-queues.js` and, type-only, `./types.js`. Nothing else, and
// `./effects.ts` least of all: `effects.ts` → `EffectImpl.ts` → `SignalGroup.ts`
// is a chain of value imports, and `SignalGroup.ts` reports through this
// module — a value import of `effects.ts` here would close that ring.
// `rollup.config.mjs:38` fails the bundle on CIRCULAR_DEPENDENCY, so the
// mistake is caught, but only at `pnpm bundle`, not at `tsc`.

import {emit, getSubscribedEventNames, on} from '@spearwolf/eventize';
import {$signalizeError} from './constants.js';
import {globalEffectQueue} from './global-queues.js';
import type {SignalizeErrorCallback, SignalizeErrorPayload} from './types.js';

/**
 * Subscribe to the diagnostics that have no caller to throw at.
 *
 * Some failures surface where nobody is left to catch them: inside a
 * `FinalizationRegistry` callback of `SignalGroup`, `link()` or
 * `SignalAutoMap`, where a throw becomes an `uncaughtException` and takes the
 * process down. Others are notices rather than failures — a deprecated call,
 * the 1000-links-on-one-source threshold. All of them used to go straight to
 * `console.warn`/`console.error`, where no application could route them
 * anywhere. They come through here instead.
 *
 * What a handler changes, exactly:
 *
 * 1. **No handler.** Every message goes to the console exactly as before —
 *    same text, same argument shape.
 * 2. **Handler registered.** The payload goes to the handler and the console
 *    stays quiet. Whoever installs this channel owns the message, **including
 *    the deprecation notices** — if they should stay visible, log them.
 * 3. **Handler throws synchronously.** Caught. Two lines follow: the
 *    handler's failure on `console.error`, then the original payload on the
 *    console method its own `level` names — so a notice ends up on
 *    `console.warn`, and mocking only `console.error` lets it slip through.
 *    Never a rethrow — the call sites are registry callbacks.
 * 4. **A throwing handler starves its siblings.** eventize ends the dispatch,
 *    so handlers with a lower priority never see the event. The payload still
 *    reaches the console afterwards, so nothing is lost. Keep handlers total,
 *    and give the one that must not be missed the highest priority.
 * 5. **An `async` handler that rejects.** Nothing awaits it, so a rejected
 *    promise coming out of it is an unhandled rejection — the very thing this
 *    channel exists to prevent:
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
 * This is the general channel, not a replacement for {@link onEffectError}.
 * An effect failure is offered to `onEffectError` first, with its structured
 * payload (`effect`, `effectId`, `phase`), and only reaches here when nobody
 * listens there — so a handler never sees the same failure twice. What
 * arrives here carries the effect id and the phase inside `message` as text,
 * not as fields; whoever needs them as fields takes `onEffectError`.
 *
 * Cost of the handler probe, measured on Node 25.9 over 1000 runs per call:
 * 0.17 µs with no live effects · 0.65 µs at 100 · 3.15 µs at 1000 · 34.9 µs at
 * 10 000. `getSubscribedEventNames()` builds one array entry per subscribed
 * event name, and every live effect subscribes to the queue under its own id —
 * the same quadratic behaviour `emitEffectError()` describes. It stays
 * uncached here on purpose: these call sites are registry callbacks and
 * one-shot notices, not error storms.
 *
 * @param callback - Receives one {@link SignalizeErrorPayload} per diagnostic
 * @param priority - Optional eventize priority; higher runs first
 * @returns Unsubscribe function
 */
export const onSignalizeError = (
  callback: SignalizeErrorCallback,
  priority?: number,
): (() => void) =>
  priority == null
    ? on(globalEffectQueue, $signalizeError, callback)
    : on(globalEffectQueue, $signalizeError, priority, callback);

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
  if (getSubscribedEventNames(globalEffectQueue).includes($signalizeError)) {
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
