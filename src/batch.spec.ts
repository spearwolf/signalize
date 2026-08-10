import {getSubscriptionCount} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {batch, getCurrentBatch} from './batch.js';
import {createMemo} from './createMemo.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {globalEffectCalledQueue, globalEffectQueue} from './global-queues.js';
import {destroySignal} from './signal-core.js';

describe('batch', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  it('delay the effect callback execution until the batch callback finished', () => {
    const {get: a, set: setA} = createSignal(123);
    const {get: b, set: setB} = createSignal('abc');

    const valA = vi.fn();
    const valB = vi.fn();

    let effectCallCount0 = 0;
    let effectCallCount1 = 0;

    const effect0 = createEffect(() => {
      ++effectCallCount0;
      valA(a());
      valB(b());
    });

    const effect1 = createEffect(() => {
      ++effectCallCount1;
      valB(b());
    });

    try {
      expect(effectCallCount0).toBe(1);
      expect(effectCallCount1).toBe(1);
      expect(valA).toHaveBeenCalledWith(123);
      expect(valB).toHaveBeenCalledWith('abc');

      effectCallCount0 = 0;
      effectCallCount1 = 0;
      let batchCallCount = 0;

      batch(() => {
        ++batchCallCount;
        setA(456);
        expect(a()).toBe(456);
        setB('def');
      });

      expect(batchCallCount).toBe(1);
      expect(effectCallCount0).toBe(1);
      expect(effectCallCount1).toBe(1);
      expect(valA).toHaveBeenCalledWith(456);
      expect(valB).toHaveBeenCalledWith('def');

      setB('plah!');

      expect(batchCallCount).toBe(1);
      expect(effectCallCount0).toBe(2);
      expect(effectCallCount1).toBe(2);
      expect(valA).toHaveBeenCalledWith(456);
      expect(valB).toHaveBeenCalledWith('plah!');
    } finally {
      effect0.destroy();
      effect1.destroy();
      destroySignal(a, b);
    }
  });

  it('nested effects work as expected', () => {
    const {get: a, set: setA} = createSignal(123);
    const {get: b, set: setB} = createSignal('abc');
    const {get: c, set: setC} = createSignal(23);

    const valA = vi.fn();
    const valB = vi.fn();
    const valC = vi.fn();

    let effectCallCount = 0;

    const effect = createEffect(() => {
      ++effectCallCount;
      valA(a());
      valB(b());
      valC(c());
    });

    try {
      expect(effectCallCount).toBe(1);
      expect(valA).toHaveBeenCalledWith(123);
      expect(valB).toHaveBeenCalledWith('abc');
      expect(valC).toHaveBeenCalledWith(23);

      effectCallCount = 0;
      let batchCallCount0 = 0;
      let batchCallCount1 = 0;

      batch(() => {
        ++batchCallCount0;

        setA(456);
        expect(a()).toBe(456);
        expect(valA).toHaveBeenCalledWith(123);

        batch(() => {
          ++batchCallCount1;

          setB('aaa');
          expect(b()).toBe('aaa');
          expect(valB).toHaveBeenCalledWith('abc');

          setC(42);
          expect(c()).toBe(42);
          expect(valC).toHaveBeenCalledWith(23);
        });

        setB('def');
        expect(b()).toBe('def');
        expect(valB).toHaveBeenCalledWith('abc');
      });

      expect(batchCallCount0).toBe(1);
      expect(batchCallCount1).toBe(1);
      expect(effectCallCount).toBe(1);
      expect(valA).toHaveBeenCalledWith(456);
      expect(valB).toHaveBeenCalledWith('def');
      expect(valC).toHaveBeenCalledWith(42);

      effectCallCount = 0;

      setB('end');

      expect(effectCallCount).toBe(1);
      expect(valB).toHaveBeenCalledWith('end');
    } finally {
      effect.destroy();
      destroySignal(a, b, c);
    }
  });

  it('resets Batch.current when the callback throws (reentrancy)', () => {
    expect(getCurrentBatch()).toBeUndefined();

    expect(() => {
      batch(() => {
        throw new Error('boom in batch callback');
      });
    }).toThrow('boom in batch callback');

    expect(getCurrentBatch()).toBeUndefined();

    // a subsequent batch must work normally again
    const {get: a, set: setA} = createSignal(0);
    const seen: number[] = [];
    const eff = createEffect(() => {
      seen.push(a());
    });

    try {
      batch(() => {
        setA(1);
        setA(2);
      });

      expect(seen).toEqual([0, 2]);
    } finally {
      eff.destroy();
      destroySignal(a);
    }
  });

  it('resets Batch.current after a throw in a nested batch callback', () => {
    expect(getCurrentBatch()).toBeUndefined();

    expect(() => {
      batch(() => {
        batch(() => {
          throw new Error('boom from nested');
        });
      });
    }).toThrow('boom from nested');

    expect(getCurrentBatch()).toBeUndefined();
  });

  it('Batch.run() releases its temporary listeners even when an effect throws', () => {
    const baselineEffect = getSubscriptionCount(globalEffectQueue);
    const baselineCalled = getSubscriptionCount(globalEffectCalledQueue);

    const {get: a, set: setA} = createSignal(0);
    const eff = createEffect(() => {
      const v = a();
      if (v > 0) {
        throw new Error('effect boom');
      }
    });

    try {
      // sanity: the effect added exactly one subscription on globalEffectQueue
      expect(getSubscriptionCount(globalEffectQueue) - baselineEffect).toBe(1);
      expect(
        getSubscriptionCount(globalEffectCalledQueue) - baselineCalled,
      ).toBe(0);

      expect(() => {
        batch(() => {
          setA(1);
        });
      }).toThrow('effect boom');

      // After the throw, the two temporary listeners registered by Batch.run()
      // must have been removed; only the effect's own subscription remains.
      expect(getSubscriptionCount(globalEffectQueue) - baselineEffect).toBe(1);
      expect(
        getSubscriptionCount(globalEffectCalledQueue) - baselineCalled,
      ).toBe(0);

      // The teardown is what the last two assertions read, so it stays here;
      // the `finally` repeats it as an idempotent belt.
      eff.destroy();
      destroySignal(a);

      expect(getSubscriptionCount(globalEffectQueue) - baselineEffect).toBe(0);
      expect(
        getSubscriptionCount(globalEffectCalledQueue) - baselineCalled,
      ).toBe(0);
    } finally {
      eff.destroy();
      destroySignal(a);
    }
  });

  describe('rejects thenable-returning callbacks (ASYNC-003)', () => {
    it('throws when the callback is an async function, instead of silently unbatching writes after the first await', async () => {
      const {get: a, set: setA} = createSignal(0);
      const seen: number[] = [];
      const eff = createEffect(() => {
        seen.push(a());
      });

      try {
        expect(getCurrentBatch()).toBeUndefined();

        let caught: unknown;
        try {
          // @ts-expect-error — async callback is rejected at the type level too (ASYNC-003); calling it anyway to exercise the runtime guard
          batch(async () => {
            setA(1);
            await Promise.resolve();
            setA(2);
          });
        } catch (err) {
          caught = err;
        }

        expect(caught).toBeInstanceOf(TypeError);
        expect((caught as TypeError).message).toContain('[signalize] batch:');

        // the batch context must be fully closed again, not left dangling
        expect(getCurrentBatch()).toBeUndefined();

        // the write that happened synchronously before the first `await` was
        // still inside the batch and gets flushed once the batch closes
        expect(seen).toEqual([0, 1]);

        // let the still-running async callback finish so it doesn't leak into
        // the next test; its post-await write now runs unbatched, which is
        // fine since batch() already told the caller not to do this
        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        eff.destroy();
        destroySignal(a);
      }
    });

    it('throws for a synchronous callback that happens to return a thenable-shaped object', () => {
      expect(getCurrentBatch()).toBeUndefined();

      let caught: unknown;
      try {
        // this is not a type error: `{then: () => {}}` doesn't structurally match
        // `PromiseLike<unknown>` (wrong `then` signature), so only the runtime
        // duck-type check below catches it — that's the point of this test.
        // biome-ignore lint/suspicious/noThenProperty: intentionally building a non-promise thenable to prove the runtime duck-type check catches it too
        batch(() => ({then: () => {}}));
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(TypeError);
      expect((caught as TypeError).message).toContain('[signalize] batch:');
      expect(getCurrentBatch()).toBeUndefined();
    });

    it('a synchronous callback returning an arbitrary non-thenable value still works', () => {
      const {get: a, set: setA} = createSignal(0);
      const seen: number[] = [];
      const eff = createEffect(() => {
        seen.push(a());
      });

      try {
        expect(() => {
          batch(() => {
            setA(1);
            return 42;
          });
        }).not.toThrow();

        expect(seen).toEqual([0, 1]);
      } finally {
        eff.destroy();
        destroySignal(a);
      }
    });
  });

  describe('effect priority inside a batch (TEST-002)', () => {
    it('a higher-priority effect is spliced in front of one already queued', () => {
      const low = createSignal(0);
      const high = createSignal(0);

      const callQueue: string[] = [];

      const lowEffect = createEffect(
        () => {
          low.get();
          callQueue.push('low');
        },
        {priority: 0},
      );

      const highEffect = createEffect(
        () => {
          high.get();
          callQueue.push('high');
        },
        {priority: 1000},
      );

      try {
        expect(callQueue).toEqual(['low', 'high']);
        callQueue.length = 0;

        batch(() => {
          low.set(1); // queued first at priority 0
          high.set(1); // priority 1000 → must be spliced in front of that bucket
        });

        expect(callQueue).toEqual(['high', 'low']);
      } finally {
        lowEffect.destroy();
        highEffect.destroy();
        destroySignal(low, high);
      }
    });

    it('a memo queued after a plain effect still recomputes first', () => {
      const source = createSignal(1);
      const other = createSignal('a');

      const callQueue: string[] = [];

      const memo = createMemo(() => {
        callQueue.push('memo');
        return source.get() * 10;
      });

      const eff = createEffect(() => {
        other.get();
        callQueue.push('effect');
      });

      try {
        expect(callQueue).toEqual(['memo', 'effect']);
        expect(memo()).toBe(10);
        callQueue.length = 0;

        batch(() => {
          other.set('b'); // the plain effect goes into the queue first
          source.set(2); // the memo has to jump the queue
        });

        expect(callQueue).toEqual(['memo', 'effect']);
        expect(memo()).toBe(20);
      } finally {
        eff.destroy();
        destroySignal(source, other, memo);
      }
    });

    it('Batch.run() ignores queue events that are not a RECALL', () => {
      const a = createSignal(0);
      const inner = createSignal('x');
      const seen: string[] = [];

      const outer = createEffect(() => {
        const v = a.get();
        // born during the flush: createEffect() emits $createEffect on
        // globalEffectQueue, and the wildcard listener Batch.run() installs
        // sees it with actionType === undefined
        createEffect(() => {
          seen.push(`${v}:${inner.get()}`);
        });
      });

      try {
        expect(seen).toEqual(['0:x']);

        batch(() => {
          a.set(1);
        });

        expect(seen).toEqual(['0:x', '1:x']);
      } finally {
        outer.destroy();
        destroySignal(a, inner);
      }
    });
  });

  describe('the callback error survives a failing flush (BUG-012)', () => {
    it('reports both the callback error and the effect error, as an AggregateError', () => {
      const {get: a, set: setA} = createSignal(0);
      const boom = createEffect(() => {
        if (a() > 0) {
          throw new Error('effect boom');
        }
      });

      try {
        const callbackError = new Error('callback boom');
        let caught: unknown;

        try {
          batch(() => {
            setA(1); // queues `boom` for the flush in the `finally`
            throw callbackError;
          });
        } catch (err) {
          caught = err;
        }

        // The flush runs in `batch()`'s `finally`; its error used to replace
        // the callback's without a trace — no `cause`, no `errors`.
        expect(caught).toBeInstanceOf(AggregateError);

        const errors = (caught as AggregateError).errors;
        expect(errors).toHaveLength(2);
        expect(errors[0], 'the callback error comes first').toBe(callbackError);
        expect((errors[1] as Error).message).toBe('effect boom');

        expect(getCurrentBatch()).toBeUndefined();
      } finally {
        boom.destroy();
        destroySignal(a);
      }
    });

    it('does not let a failing effect swallow the thenable TypeError', () => {
      const {get: a, set: setA} = createSignal(0);
      const boom = createEffect(() => {
        if (a() > 0) {
          throw new Error('effect boom');
        }
      });

      try {
        let caught: unknown;

        try {
          batch(() => {
            setA(1);
            // biome-ignore lint/suspicious/noThenProperty: intentionally building a non-promise thenable, as in the ASYNC-003 block above
            return {then: () => {}};
          });
        } catch (err) {
          caught = err;
        }

        // The guard is documented as a hard error at the call site. A failing
        // effect in the same batch used to make it disappear entirely.
        expect(caught).toBeInstanceOf(AggregateError);

        const errors = (caught as AggregateError).errors;
        expect(errors).toHaveLength(2);
        expect(errors[0]).toBeInstanceOf(TypeError);
        expect((errors[0] as TypeError).message).toContain(
          '[signalize] batch:',
        );
        expect((errors[1] as Error).message).toBe('effect boom');
      } finally {
        boom.destroy();
        destroySignal(a);
      }
    });

    it('rethrows a lone callback error unchanged, without wrapping it', () => {
      const callbackError = new Error('callback boom');
      let caught: unknown;

      try {
        batch(() => {
          throw callbackError;
        });
      } catch (err) {
        caught = err;
      }

      expect(caught, 'the single error keeps its identity').toBe(callbackError);
      expect(getCurrentBatch()).toBeUndefined();
    });

    it('rethrows a lone flush error unchanged, without wrapping it', () => {
      const {get: a, set: setA} = createSignal(0);
      const boom = createEffect(() => {
        if (a() > 0) {
          throw new Error('effect boom');
        }
      });

      try {
        let caught: unknown;

        try {
          batch(() => {
            setA(1);
          });
        } catch (err) {
          caught = err;
        }

        expect(caught).toBeInstanceOf(Error);
        expect(caught).not.toBeInstanceOf(AggregateError);
        expect((caught as Error).message).toBe('effect boom');
      } finally {
        boom.destroy();
        destroySignal(a);
      }
    });

    it('a nested batch hands its callback error to the outer batch unchanged', () => {
      const callbackError = new Error('boom from nested');
      let caught: unknown;

      try {
        batch(() => {
          batch(() => {
            throw callbackError;
          });
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBe(callbackError);
      expect(getCurrentBatch()).toBeUndefined();
    });
  });
});
