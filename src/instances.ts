// Leaf module — it may import `./constants.js` and, **type-only**,
// `./types.js`. Nothing else, and `./signalize-error.js` least of all: that
// module is the single caller of `registerSignalizeInstance()`, so an import
// back would close the ring `signalize-error.ts` → `instances.ts` →
// `signalize-error.ts`. The reporter arrives as an argument instead.

import {$signalizeInstances} from './constants.js';
import type {SignalizeErrorPayload} from './types.js';

/**
 * One loaded copy of the library, as the other copies see it.
 *
 * @internal
 */
export interface SignalizeInstanceRecord {
  /** Where this copy was loaded from — `import.meta.url` of its reporter. */
  readonly url: string;
  /** The copy's own `reportSignalizeError`. */
  readonly report: (payload: SignalizeErrorPayload) => void;
}

/**
 * Announce this copy of the library in the process-wide register and report
 * if it is not the only one.
 *
 * Two copies in one process share no signals, effects, groups or links: the
 * module-level queues, the effect stack and the link map exist once per copy.
 * Because the `Symbol.for` keys carry no major version, the mismatch is
 * silent in the worst possible way — `isSignal()` says `true` across the
 * boundary, an effect from the other copy never runs again, and
 * `destroySignal()` across it drives the caller's signal count to `-1`.
 *
 * The register is an array under `Symbol.for('@spearwolf/signalize/instances')`
 * on `globalThis` — the only place a second copy can look, since it sees
 * neither the module state nor the module identity of the first one. A
 * length above one is the whole detection.
 *
 * The reaction is a message, never a throw: an application with a duplicated
 * dependency has been running like this all along, and taking its startup
 * away is an escalation nobody asked for. The message goes out through the
 * **oldest** copy's reporter — whoever installed `onSignalizeError()` did so
 * on the copy they loaded first, and that is the only queue a handler can
 * already be sitting on when the second copy loads.
 *
 * Never throws, and the outer `try` is the reason. This runs during module
 * evaluation, so anything that escapes it fails the `import` of the whole
 * library — the worst outcome this module could produce. Three states reach
 * it, all measured: the key holds something that is not an array (a squatter,
 * or a future version's format), the array is frozen, or `globalThis` itself
 * is (SES `lockdown()`). The register is a container this copy does not own,
 * so it is treated like the foreign records inside it.
 *
 * A failed attempt is **silent** and returns `0`. Nothing downstream depends
 * on the register — the library works exactly as it would without it, and the
 * only cost is a warning that will not appear. A message would have nowhere
 * to go but `console.error`, since no handler can exist this early (see
 * below), so it would be an unsuppressable error line in precisely the
 * hardened realm that caused it, about a diagnostic nobody can act on. The
 * failure mode is a missing warning, never a false alarm, and never a
 * broken import.
 *
 * The price of that silence, written down so nobody later mistakes it for a
 * bug: in two of those three states the counterpart is, by construction,
 * **another copy of this library**. A future version that changes the shape
 * of the register switches the sentinel off in both copies without a trace —
 * exactly where it would be needed. Whoever changes the format owes the old
 * one a fallback.
 *
 * **When a handler can see this at all:** with two static imports both copies
 * register during module evaluation, before a single line of application code
 * runs — the message then goes to `console.error`, always. Only a second copy
 * pulled in later, via `await import()`, can meet a handler that is already
 * subscribed.
 *
 * @param url - `import.meta.url` of the calling copy
 * @param report - the calling copy's own reporter, used as the fallback
 * @returns how many copies are registered, this one included, or `0` if the
 *   register could not be touched
 *
 * @internal
 */
export const registerSignalizeInstance = (
  url: string,
  report: (payload: SignalizeErrorPayload) => void,
): number => {
  try {
    const instances = ((globalThis as Record<symbol, unknown>)[
      $signalizeInstances
    ] ??= []) as SignalizeInstanceRecord[];

    instances.push({url, report});

    if (instances.length > 1) {
      const payload: SignalizeErrorPayload = {
        level: 'error',
        source: 'multiple-instances',
        message: `[signalize] ${instances.length} copies of @spearwolf/signalize are loaded in this process; they share no signals, effects, groups or links. Loaded from: ${instances
          .map(({url: it}) => it)
          .join(', ')}`,
      };
      // The foreign record may come from another version: its `report` can be
      // missing or throw. Then this copy reports through its own channel.
      try {
        instances[0].report(payload);
      } catch {
        report(payload);
      }
    }

    return instances.length;
  } catch {
    // A register this copy cannot write to. Staying quiet is the whole point:
    // see the note above — the import must survive, and the console is the
    // only place a message could land.
    return 0;
  }
};
