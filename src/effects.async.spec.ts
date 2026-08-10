import {getSubscriptionCount} from '@spearwolf/eventize';
import {assertEffectsCount} from './__testing__/assert-helpers.js';
import {$effect} from './constants.js';
import {createSignal} from './createSignal.js';
import {createEffect, onEffectError} from './effects.js';
import {globalEffectQueue} from './global-queues.js';
import {destroySignal} from './signal-core.js';
import type {EffectErrorPayload} from './types.js';

/** Let pending microtasks *and* the unhandled-rejection check run. */
const flush = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

describe('async effect callbacks', () => {
  let unhandled: unknown[];
  let onUnhandledRejection: (reason: unknown) => void;

  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    unhandled = [];
    onUnhandledRejection = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);
  });

  afterEach(() => {
    process.off('unhandledRejection', onUnhandledRejection);
    // Before the count assertion: a failing assertion must not leave
    // console.error mocked for the rest of the file.
    vi.restoreAllMocks();
    assertEffectsCount(0, 'afterEach');
  });

  describe('error channel', () => {
    it('a rejecting async callback does not become an unhandled rejection', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const {get: a, set: setA} = createSignal(0);

      const effect = createEffect(async () => {
        a();
        throw new Error('boom');
      });

      try {
        setA(1);

        await flush();

        expect(unhandled).toEqual([]);
      } finally {
        effect.destroy();
        destroySignal(a);
      }

      await flush();

      expect(unhandled).toEqual([]);
    });

    it('without a handler the error is logged with the effect id', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const {get: a} = createSignal(0);
      const boom = new Error('boom');

      const effect = createEffect(async () => {
        a();
        throw boom;
      });

      try {
        await flush();

        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError.mock.calls[0].at(-1)).toBe(boom);
        expect(String(consoleError.mock.calls[0][0])).toContain(
          effect[$effect].id.toString(),
        );
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('routes the rejection to an onEffectError handler', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const subscriptionsBefore = getSubscriptionCount(globalEffectQueue);

      const reported: EffectErrorPayload[] = [];
      const unsubscribe = onEffectError((payload) => {
        reported.push(payload);
      });

      const {get: a} = createSignal(0);
      const boom = new Error('boom');

      const effect = createEffect(async () => {
        a();
        throw boom;
      });

      try {
        await flush();

        expect(reported).toHaveLength(1);
        expect(reported[0].error).toBe(boom);
        expect(reported[0].phase).toBe('callback');
        expect(reported[0].effect).toBe(effect[$effect]);
        expect(reported[0].effectId).toBe(effect[$effect].id);

        expect(consoleError).not.toHaveBeenCalled();
        expect(unhandled).toEqual([]);
      } finally {
        effect.destroy();
        destroySignal(a);
        unsubscribe();
      }

      expect(getSubscriptionCount(globalEffectQueue)).toBe(subscriptionsBefore);
    });

    it('falls back to console.error again after the last handler is gone', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // The whole fallback rests on the handler probe going back to "none"
      // once the last subscription is dropped. If it did not, the error
      // would be emitted into the void — swallowed silently, which the
      // implementation calls worse than the crash it replaced.
      const unsubscribe = onEffectError(() => {});
      unsubscribe();

      const {get: a} = createSignal(0);
      const boom = new Error('boom');

      const effect = createEffect(async () => {
        a();
        throw boom;
      });

      try {
        await flush();

        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError.mock.calls[0].at(-1)).toBe(boom);
        expect(unhandled).toEqual([]);
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('reports a rejecting async cleanup callback', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const reported: EffectErrorPayload[] = [];
      const unsubscribe = onEffectError((payload) => {
        reported.push(payload);
      });

      const {get: a} = createSignal(0);
      const boom = new Error('cleanup boom');

      const effect = createEffect(() => {
        a();
        return async () => {
          throw boom;
        };
      });

      try {
        effect.destroy();

        await flush();

        expect(reported).toHaveLength(1);
        expect(reported[0].error).toBe(boom);
        expect(reported[0].phase).toBe('cleanup');
        expect(unhandled).toEqual([]);
      } finally {
        effect.destroy();
        destroySignal(a);
        unsubscribe();
      }
    });

    it('a throwing handler falls back to console.error instead of exploding', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const handlerError = new Error('handler boom');
      const unsubscribe = onEffectError(() => {
        throw handlerError;
      });

      const {get: a} = createSignal(0);
      const boom = new Error('boom');

      const effect = createEffect(async () => {
        a();
        throw boom;
      });

      try {
        await flush();

        // both the handler failure and the original error stay visible
        expect(consoleError).toHaveBeenCalledTimes(2);
        expect(consoleError.mock.calls[0].at(-1)).toBe(handlerError);
        expect(consoleError.mock.calls[1].at(-1)).toBe(boom);
        expect(unhandled).toEqual([]);
      } finally {
        effect.destroy();
        destroySignal(a);
        unsubscribe();
      }
    });

    it('accepts a priority — higher runs first', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const order: string[] = [];
      const unsubLow = onEffectError(() => order.push('low'));
      const unsubHigh = onEffectError(() => order.push('high'), 10);

      const {get: a} = createSignal(0);

      const effect = createEffect(async () => {
        a();
        throw new Error('boom');
      });

      try {
        await flush();

        expect(order).toEqual(['high', 'low']);
        expect(unhandled).toEqual([]);
      } finally {
        effect.destroy();
        destroySignal(a);
        unsubLow();
        unsubHigh();
      }
    });
  });

  describe('cleanup generations', () => {
    it('runs the cleanup of a run that was superseded before it settled (MEM-004)', async () => {
      const log: string[] = [];
      const {get: a, set: setA} = createSignal(0);

      const effect = createEffect(async () => {
        const value = a();
        log.push(`run:${value}`);
        return () => {
          log.push(`cleanup:${value}`);
        };
      });

      try {
        setA(1);
        setA(2);

        await flush();

        // Die Cleanups der überholten Runs laufen, sobald ihr Promise
        // settelt — die Ressource dieses Runs gibt sonst niemand mehr frei.
        expect(log).toEqual([
          'run:0',
          'run:1',
          'run:2',
          'cleanup:0',
          'cleanup:1',
        ]);

        effect.destroy();

        // Der Cleanup des jüngsten Runs läuft weiterhin erst beim destroy().
        expect(log).toEqual([
          'run:0',
          'run:1',
          'run:2',
          'cleanup:0',
          'cleanup:1',
          'cleanup:2',
        ]);
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('runs the cleanup of a settled run before the next run', async () => {
      const log: string[] = [];
      const {get: a, set: setA} = createSignal(0);

      const effect = createEffect(async () => {
        const value = a();
        log.push(`run:${value}`);
        return () => {
          log.push(`cleanup:${value}`);
        };
      });

      try {
        await flush();
        expect(log).toEqual(['run:0']);

        setA(1);
        expect(log).toEqual(['run:0', 'cleanup:0', 'run:1']);

        await flush();
        effect.destroy();

        expect(log).toEqual(['run:0', 'cleanup:0', 'run:1', 'cleanup:1']);
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('keeps the cleanup of the outer run when a cleanup re-enters the effect', async () => {
      const log: string[] = [];
      const {get: a, set: setA} = createSignal(0);

      let runSeq = 0;

      const effect = createEffect(async () => {
        const seq = ++runSeq;
        const value = a();
        log.push(`run:${seq}:${value}`);
        return () => {
          log.push(`cleanup:${seq}`);
          // Writing a own dependency from the cleanup re-enters run(): the
          // inner run completes first, the outer callback is invoked last.
          if (seq === 1) setA(99);
        };
      });

      try {
        await flush();

        setA(1);

        // cleanup:1 re-entered the effect, so run 2 (inner) finished before
        // run 3 (outer) was even called.
        expect(log).toEqual(['run:1:0', 'cleanup:1', 'run:2:99', 'run:3:99']);

        await flush();

        // Der innere Run 2 wurde vom äußeren Run 3 überholt: sein Cleanup
        // läuft jetzt beim Settle, statt verworfen zu werden.
        expect(log).toEqual([
          'run:1:0',
          'cleanup:1',
          'run:2:99',
          'run:3:99',
          'cleanup:2',
        ]);

        effect.destroy();

        // The generation must follow the order in which the callbacks *ran*,
        // not the order in which the runs were entered. Otherwise the outer
        // run — whose promise is the newer one — would have its cleanup
        // stored first and the inner run's stale cleanup would be the one
        // left standing at `destroy()`.
        expect(log.at(-1)).toBe('cleanup:3');
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('a cleanup that settles after the run it was superseded by does not take the slot (TEST-023)', async () => {
      // The sibling above pins the *sequence*, this one the *numbering*. Move
      // the `++this.#generation` from just before the callback to the top of
      // `run()` and the sibling stays green: with both promises settling in
      // the order their runs were entered, the slot ends up holding the same
      // cleanup either way. It only comes apart when the inner run settles
      // *after* the outer one — then the bump at the top hands both runs the
      // same number, the older cleanup passes the identity check and
      // displaces the newer one out of the slot.
      const log: string[] = [];
      const {get: a, set: setA} = createSignal(0);

      let runSeq = 0;
      let releaseInner!: () => void;
      const innerSettles = new Promise<void>((resolve) => {
        releaseInner = resolve;
      });

      const effect = createEffect(async () => {
        const seq = ++runSeq;
        a();
        log.push(`run:${seq}`);
        // Run 2 is the nested one, entered from the cleanup of run 1. Held
        // back until run 3 — the outer run — has already stored its cleanup.
        if (seq === 2) await innerSettles;
        return () => {
          log.push(`cleanup:${seq}`);
          if (seq === 1) setA(99);
        };
      });

      try {
        await flush();

        setA(1);

        expect(log, 'the cleanup of run 1 re-entered the effect').toEqual([
          'run:1',
          'cleanup:1',
          'run:2',
          'run:3',
        ]);

        await flush();

        expect(log, 'only the outer run has settled so far').toEqual([
          'run:1',
          'cleanup:1',
          'run:2',
          'run:3',
        ]);

        releaseInner();
        await flush();

        // The inner run is the older one: its cleanup is stale on arrival and
        // runs on the spot instead of pushing the current one out of the slot.
        expect(
          log.at(-1),
          'the late cleanup of the inner run ran orphaned',
        ).toBe('cleanup:2');

        effect.destroy();

        expect(log, 'the slot held the cleanup of the outer run').toEqual([
          'run:1',
          'cleanup:1',
          'run:2',
          'run:3',
          'cleanup:2',
          'cleanup:3',
        ]);
      } finally {
        // Before the teardown: a failed assertion above must not leave the
        // effect callback of run 2 awaiting a promise nobody resolves.
        releaseInner();
        effect.destroy();
        destroySignal(a);
      }
    });

    it('runs a cleanup that settles after the effect was destroyed (MEM-004)', async () => {
      const log: string[] = [];
      const {get: a} = createSignal(0);

      const effect = createEffect(async () => {
        const value = a();
        log.push(`run:${value}`);
        return () => {
          log.push(`cleanup:${value}`);
        };
      });

      try {
        effect.destroy();

        await flush();

        expect(log).toEqual(['run:0', 'cleanup:0']);
        expect(unhandled).toEqual([]);
      } finally {
        effect.destroy();
        destroySignal(a);
      }
    });

    it('reports a throwing stale cleanup through onEffectError (MEM-004)', async () => {
      const errors: EffectErrorPayload[] = [];
      const unsubscribe = onEffectError((payload) => {
        errors.push(payload);
      });

      const {get: a, set: setA} = createSignal(0);

      const effect = createEffect(async () => {
        const value = a();
        return () => {
          if (value === 0) throw new Error(`boom:${value}`);
        };
      });

      try {
        setA(1);

        await flush();

        expect(errors).toHaveLength(1);
        expect(errors[0].phase).toBe('cleanup');
        expect((errors[0].error as Error).message).toBe('boom:0');
        expect(unhandled).toEqual([]);
      } finally {
        unsubscribe();
        effect.destroy();
        destroySignal(a);
      }
    });
  });
});
