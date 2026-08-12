import {getSubscribedEventNames} from '@spearwolf/eventize';
import {$effectError} from './constants.js';
import {createSignal} from './createSignal.js';
import {
  getEffectErrorHandlerCount,
  hasEffectErrorHandler,
} from './effect-error-handlers.js';
import {createEffect, onEffectError} from './effects.js';
import {globalEffectQueue} from './global-queues.js';
import {SignalGroup} from './SignalGroup.js';

// `globalThis.gc` is only available when Node is launched with --expose-gc
// (the `gc` project in vitest.config.ts, which `pnpm test` also runs, and
// `pnpm test:gc` for the whole suite). Skipping the suite when the flag is
// gone would hide a lost `execArgv` behind a green reporter, so this file
// refuses to load instead (BUILD-016).
const gc = (globalThis as {gc?: () => void}).gc;

if (typeof gc !== 'function') {
  throw new Error(
    'globalThis.gc is missing: this suite must run under --expose-gc. Check `execArgv` in the `gc` project of vitest.config.ts, or run `pnpm test:gc`.',
  );
}

const forceGc = async () => {
  for (let i = 0; i < 3; i += 1) {
    gc();
    await new Promise((resolve) => setImmediate(resolve));
  }
};

/** Let pending microtasks *and* the unhandled-rejection check run. */
const flush = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

/**
 * Whether `hasEffectErrorHandler()` agrees with the ground truth eventize
 * itself reports. Same probe as `effect-error-handlers.spec.ts`'s Z7,
 * duplicated because this file runs in the isolated `gc` project and does
 * not share module state with the `unit` one.
 */
const assertHandlerCountMatchesQueue = () => {
  const subscribed =
    getSubscribedEventNames(globalEffectQueue).includes($effectError);
  expect(getEffectErrorHandlerCount() > 0).toBe(subscribed);
  expect(hasEffectErrorHandler()).toBe(subscribed);
};

describe('effect-error-handlers GC behavior (requires --expose-gc)', () => {
  it('the module-local handler counter survives 600 groups torn down through the FinalizationRegistry (N13)', async () => {
    // The path the reviewer of package 8 drove by hand: an `EffectImpl`
    // destroyed via `SignalGroup.clear()` from the FinalizationRegistry
    // callback, not via an explicit `effect.destroy()` call. Async, not
    // sync, on purpose — a synchronous throw out of the first run goes
    // straight to `createEffect()`'s own caller, and never reaches
    // `onEffectError()` at all (see its JSDoc). Only the async path — no
    // caller left to throw at once the microtask settles — routes here.
    const unhandled: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);

    let reportedCount = 0;
    const unsubscribe = onEffectError(() => {
      reportedCount += 1;
    });

    try {
      const GROUP_COUNT = 600;

      (() => {
        for (let i = 0; i < GROUP_COUNT; i += 1) {
          const host = {};
          const group = SignalGroup.findOrCreate(host);
          const {get: a} = createSignal(0, {attach: group});
          createEffect(
            async () => {
              a();
              throw new Error(`gc witness boom ${i}`);
            },
            {attach: group},
          );
        }
      })();

      // Let every async callback's first run reject and reach
      // `onEffectError()` before anything is collected — the settled
      // promise is what stops pinning the effect, not the group teardown.
      await flush();

      await forceGc();

      assertHandlerCountMatchesQueue();
      expect(getEffectErrorHandlerCount()).toBe(1);
      expect(reportedCount).toBe(GROUP_COUNT);
      expect(unhandled).toEqual([]);
    } finally {
      unsubscribe();
      process.off('unhandledRejection', onUnhandledRejection);
    }

    assertHandlerCountMatchesQueue();
    expect(getEffectErrorHandlerCount()).toBe(0);
  });
});
