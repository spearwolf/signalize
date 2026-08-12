import {
  getSubscribedEventNames,
  getSubscriptionCount,
} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {$effect, $effectError} from './constants.js';
import {createSignal} from './createSignal.js';
import {
  getEffectErrorHandlerCount,
  hasEffectErrorHandler,
} from './effect-error-handlers.js';
import {createEffect, onEffectError} from './effects.js';
import {globalEffectQueue} from './global-queues.js';
import {SignalGroup} from './SignalGroup.js';
import {destroySignal} from './signal-core.js';
import {onSignalizeError} from './signalize-error.js';
import type {EffectErrorPayload, SignalizeErrorPayload} from './types.js';

/** Let pending microtasks *and* the unhandled-rejection check run. */
const flush = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

/**
 * Whether `hasEffectErrorHandler()` agrees with the ground truth eventize
 * itself reports — Z7, checked after every scenario below.
 */
const assertHandlerCountMatchesQueue = () => {
  const subscribed =
    getSubscribedEventNames(globalEffectQueue).includes($effectError);
  expect(getEffectErrorHandlerCount() > 0).toBe(subscribed);
  expect(hasEffectErrorHandler()).toBe(subscribed);
};

// Two ways a subscription can appear or disappear on `globalEffectQueue`
// without going through `trackEffectErrorHandler()` are deliberately not
// their own test case here:
//
// - A `*` catch-all listener (`batch.ts` registers one) already made
//   today's probe lie before this package: `getSubscribedEventNames()`
//   would report `['*']`, and `.includes($effectError)` reads `false`
//   regardless of a real `$effectError` subscriber. The counter behaves
//   the same way it always did on that path — no behaviour change to
//   pin.
// - A direct `off(globalEffectQueue, callback)` — bypassing the
//   unsubscribe `onEffectError()` hands back — is the one path that could
//   *overcount* the handler, and it is not reachable through the public,
//   type-checked API: `onEffectError()` never gives a caller the raw
//   `callback` back to pass to a raw `off()` call. It stays unreached by a
//   normal caller, but not unreachable in general — see the "Known
//   boundary" paragraph on `trackEffectErrorHandler()` in
//   `effect-error-handlers.ts` for the one way an overcount does happen
//   (an `EffectImpl` registered as a raw object listener, then destroyed).
//   Z7 below is the standing guard for both: if either path ever drifts
//   the counter against the queue, it fails here.

describe('effect-error-handlers', () => {
  let unhandled: unknown[];
  let onUnhandledRejection: (reason: unknown) => void;

  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
    unhandled = [];
    onUnhandledRejection = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandledRejection);
    vi.restoreAllMocks();
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  it('Z1 — a registered handler gets the structured payload, and only it', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const subsBefore = getSubscriptionCount(globalEffectQueue);
    const signalizeErrorSeen: SignalizeErrorPayload[] = [];
    const unsubSignalize = onSignalizeError((p) => signalizeErrorSeen.push(p));
    const reported: EffectErrorPayload[] = [];
    const unsubscribe = onEffectError((payload) => reported.push(payload));

    const {get: a} = createSignal(0);
    const boom = new Error('Z1 boom');
    const effect = createEffect(async () => {
      a();
      throw boom;
    });

    try {
      await flush();

      expect(reported).toHaveLength(1);
      expect(reported[0].error).toBe(boom);
      expect(reported[0].effect).toBe(effect[$effect]);
      expect(reported[0].effectId).toBe(effect[$effect].id);
      expect(reported[0].phase).toBe('callback');
      expect(signalizeErrorSeen).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
      assertHandlerCountMatchesQueue();
    } finally {
      effect.destroy();
      destroySignal(a);
      unsubscribe();
      unsubSignalize();
    }

    expect(getSubscriptionCount(globalEffectQueue)).toBe(subsBefore);
    assertHandlerCountMatchesQueue();
  });

  it('Z2 — no handler falls back to onSignalizeError, then console.error', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const subsBefore = getSubscriptionCount(globalEffectQueue);
    const {get: a} = createSignal(0);
    const boom = new Error('Z2 boom, no fallback handler either');
    const effect = createEffect(async () => {
      a();
      throw boom;
    });

    try {
      await flush();
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0].at(-1)).toBe(boom);
      expect(unhandled).toEqual([]);
      assertHandlerCountMatchesQueue();
    } finally {
      effect.destroy();
      destroySignal(a);
    }

    // With an onSignalizeError handler registered, the fallback channel
    // picks the failure up before it reaches the console.
    const signalizeErrorSeen: SignalizeErrorPayload[] = [];
    const unsubSignalize = onSignalizeError((p) => signalizeErrorSeen.push(p));

    const {get: b} = createSignal(0);
    const boom2 = new Error('Z2 boom, fallback handler present');
    const effect2 = createEffect(async () => {
      b();
      throw boom2;
    });

    try {
      await flush();
      expect(signalizeErrorSeen).toHaveLength(1);
      expect(signalizeErrorSeen[0].source).toBe('effect');
      expect(consoleError).toHaveBeenCalledTimes(1); // unchanged from above
      assertHandlerCountMatchesQueue();
    } finally {
      effect2.destroy();
      destroySignal(b);
      unsubSignalize();
    }

    expect(getSubscriptionCount(globalEffectQueue)).toBe(subsBefore);
    assertHandlerCountMatchesQueue();
  });

  it('Z3 — handler registered then unsubscribed falls back like no handler at all', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const subsBefore = getSubscriptionCount(globalEffectQueue);
    const unsubscribe = onEffectError(() => {});
    unsubscribe();
    assertHandlerCountMatchesQueue();
    expect(getEffectErrorHandlerCount()).toBe(0);

    const {get: a} = createSignal(0);
    const boom = new Error('Z3 boom');
    const effect = createEffect(async () => {
      a();
      throw boom;
    });

    try {
      await flush();
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0].at(-1)).toBe(boom);
    } finally {
      effect.destroy();
      destroySignal(a);
    }

    expect(getSubscriptionCount(globalEffectQueue)).toBe(subsBefore);
    assertHandlerCountMatchesQueue();
  });

  it('Z4 — the drift witness: a triple unsubscribe must not silence a still-registered sibling', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const subsBefore = getSubscriptionCount(globalEffectQueue);
    const stayingReports: EffectErrorPayload[] = [];
    const unsubStaying = onEffectError((p) => stayingReports.push(p));
    const unsubGoing = onEffectError(() => {});

    // eventize's own unsubscribe is idempotent — a naive counter without a
    // `released` guard would decrement three times for one subscription and
    // land at -1 relative to the truth, making `hasEffectErrorHandler()`
    // read `false` while `unsubStaying` is still registered.
    unsubGoing();
    unsubGoing();
    unsubGoing();

    expect(getEffectErrorHandlerCount()).toBe(1);
    assertHandlerCountMatchesQueue();

    const {get: a} = createSignal(0);
    const boom = new Error('Z4 boom');
    const effect = createEffect(async () => {
      a();
      throw boom;
    });

    try {
      await flush();
      expect(stayingReports).toHaveLength(1);
      expect(stayingReports[0].error).toBe(boom);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      effect.destroy();
      destroySignal(a);
      unsubStaying();
    }

    expect(getSubscriptionCount(globalEffectQueue)).toBe(subsBefore);
    assertHandlerCountMatchesQueue();
  });

  it('Z5 — the same callback registered twice needs two unsubscribes to go quiet', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const subsBefore = getSubscriptionCount(globalEffectQueue);
    const reported: EffectErrorPayload[] = [];
    const callback = (p: EffectErrorPayload) => reported.push(p);
    const unsubFirst = onEffectError(callback);
    const unsubSecond = onEffectError(callback);

    // eventize does not deduplicate identical callbacks — two subscriptions.
    expect(
      getSubscriptionCount(globalEffectQueue) - subsBefore,
    ).toBeGreaterThanOrEqual(2);
    expect(getEffectErrorHandlerCount()).toBe(2);

    const {get: a, set: setA} = createSignal(0);
    const effect = createEffect(async () => {
      a();
      throw new Error('Z5 boom 1');
    });

    try {
      await flush();
      expect(reported).toHaveLength(2); // one delivery per subscription
      reported.length = 0;

      unsubFirst();
      expect(getEffectErrorHandlerCount()).toBe(1);
      assertHandlerCountMatchesQueue();

      setA(1);
      await flush();
      expect(reported).toHaveLength(1);
      expect(consoleError).not.toHaveBeenCalled();
      reported.length = 0;

      unsubSecond();
      expect(getEffectErrorHandlerCount()).toBe(0);
      assertHandlerCountMatchesQueue();

      setA(2);
      await flush();
      expect(reported).toEqual([]);
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      effect.destroy();
      destroySignal(a);
    }

    expect(getSubscriptionCount(globalEffectQueue)).toBe(subsBefore);
    assertHandlerCountMatchesQueue();
  });

  it('Z6 — a handler that unsubscribes itself mid-delivery still sees the current one', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const subsBefore = getSubscriptionCount(globalEffectQueue);
    const order: string[] = [];
    let unsubSelf: () => void;
    unsubSelf = onEffectError(() => {
      order.push('self');
      unsubSelf();
      unsubSelf(); // a second call from inside its own handler stays harmless
    });
    const unsubOther = onEffectError(() => {
      order.push('other');
    });

    const {get: a} = createSignal(0);
    const boom = new Error('Z6 boom');
    const effect = createEffect(async () => {
      a();
      throw boom;
    });

    try {
      await flush();
      expect(order).toEqual(['self', 'other']);
      expect(getEffectErrorHandlerCount()).toBe(1);
      assertHandlerCountMatchesQueue();
    } finally {
      effect.destroy();
      destroySignal(a);
    }

    order.length = 0;
    const {get: b} = createSignal(0);
    const effect2 = createEffect(async () => {
      b();
      throw new Error('Z6 boom, second run');
    });
    try {
      await flush();
      expect(order).toEqual(['other']);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      effect2.destroy();
      destroySignal(b);
      unsubOther();
    }

    expect(getSubscriptionCount(globalEffectQueue)).toBe(subsBefore);
    assertHandlerCountMatchesQueue();
  });

  it('Z8 — a handler survives a full effect lifecycle and keeps receiving reports', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const subsBefore = getSubscriptionCount(globalEffectQueue);
    const reported: EffectErrorPayload[] = [];
    const unsubscribe = onEffectError((p) => reported.push(p));

    const host = {};
    const group = SignalGroup.findOrCreate(host);
    const {get: a, set: setA} = createSignal(0, {attach: group});
    const {get: b} = createSignal(0);

    const attached = createEffect(
      async () => {
        a();
        throw new Error('Z8 boom, attached');
      },
      {attach: group},
    );
    const detached = createEffect(async () => {
      b();
      throw new Error('Z8 boom, detached');
    });

    try {
      await flush();
      expect(reported).toHaveLength(2);
      reported.length = 0;

      setA(1);
      await flush();
      expect(reported.length).toBeGreaterThan(0);
      reported.length = 0;

      // Four teardown steps, checked after each one instead of once at the
      // end: `group.clear()` already destroys `attached` (and signal `a`,
      // attached to the group) on its own, so the three calls after it are
      // each a no-op on an already-torn-down target — `SignalGroup.delete()`
      // on a group already cleared, `attached.destroy()` on an effect
      // already destroyed. Checking after every step, not just the last,
      // is what would have caught the handler count drifting on the
      // `group.clear()` path specifically, which this test did not exercise
      // before.
      group.clear();
      assertHandlerCountMatchesQueue();
      expect(getEffectErrorHandlerCount()).toBe(1);

      SignalGroup.delete(host);
      assertHandlerCountMatchesQueue();
      expect(getEffectErrorHandlerCount()).toBe(1);

      attached.destroy();
      assertHandlerCountMatchesQueue();
      expect(getEffectErrorHandlerCount()).toBe(1);

      detached.destroy();
      assertHandlerCountMatchesQueue();
      expect(getEffectErrorHandlerCount()).toBe(1);
    } finally {
      destroySignal(a);
      destroySignal(b);
    }

    const {get: c} = createSignal(0);
    const effect = createEffect(async () => {
      c();
      throw new Error('Z8 boom, after teardown');
    });
    try {
      await flush();
      expect(reported).toHaveLength(1);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      effect.destroy();
      destroySignal(c);
      unsubscribe();
    }

    expect(getSubscriptionCount(globalEffectQueue)).toBe(subsBefore);
    assertHandlerCountMatchesQueue();
  });

  it('Z9 — the priority form counts up and its unsubscribe counts down', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const subsBefore = getSubscriptionCount(globalEffectQueue);
    const before = getEffectErrorHandlerCount();
    const order: string[] = [];
    const unsubLow = onEffectError(() => order.push('low'), -10);
    const unsubHigh = onEffectError(() => order.push('high'), 10);

    expect(getEffectErrorHandlerCount()).toBe(before + 2);
    assertHandlerCountMatchesQueue();

    const {get: a} = createSignal(0);
    const boom = new Error('Z9 boom');
    const effect = createEffect(async () => {
      a();
      throw boom;
    });

    try {
      await flush();
      expect(order).toEqual(['high', 'low']);
    } finally {
      effect.destroy();
      destroySignal(a);
    }

    unsubHigh();
    expect(getEffectErrorHandlerCount()).toBe(before + 1);
    unsubLow();
    expect(getEffectErrorHandlerCount()).toBe(before);
    assertHandlerCountMatchesQueue();

    expect(consoleError).not.toHaveBeenCalled();
    expect(getSubscriptionCount(globalEffectQueue)).toBe(subsBefore);
  });
});
