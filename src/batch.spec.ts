import {getSubscriptionCount} from '@spearwolf/eventize';
import {batch, getCurrentBatch} from './batch.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {globalEffectCalledQueue, globalEffectQueue} from './global-queues.js';
import {destroySignal} from './signal-core.js';

describe('batch', () => {
  it('delay the effect callback execution until the batch callback finished', () => {
    const {get: a, set: setA} = createSignal(123);
    const {get: b, set: setB} = createSignal('abc');

    const valA = vi.fn();
    const valB = vi.fn();

    let effectCallCount0 = 0;
    let effectCallCount1 = 0;

    createEffect(() => {
      ++effectCallCount0;
      valA(a());
      valB(b());
    });

    createEffect(() => {
      ++effectCallCount1;
      valB(b());
    });

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
  });

  it('nested effects work as expected', () => {
    const {get: a, set: setA} = createSignal(123);
    const {get: b, set: setB} = createSignal('abc');
    const {get: c, set: setC} = createSignal(23);

    const valA = vi.fn();
    const valB = vi.fn();
    const valC = vi.fn();

    let effectCallCount = 0;

    createEffect(() => {
      ++effectCallCount;
      valA(a());
      valB(b());
      valC(c());
    });

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

    batch(() => {
      setA(1);
      setA(2);
    });

    expect(seen).toEqual([0, 2]);

    eff.destroy();
    destroySignal(a);
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

    // sanity: the effect added exactly one subscription on globalEffectQueue
    expect(getSubscriptionCount(globalEffectQueue) - baselineEffect).toBe(1);
    expect(getSubscriptionCount(globalEffectCalledQueue) - baselineCalled).toBe(
      0,
    );

    expect(() => {
      batch(() => {
        setA(1);
      });
    }).toThrow('effect boom');

    // After the throw, the two temporary listeners registered by Batch.run()
    // must have been removed; only the effect's own subscription remains.
    expect(getSubscriptionCount(globalEffectQueue) - baselineEffect).toBe(1);
    expect(getSubscriptionCount(globalEffectCalledQueue) - baselineCalled).toBe(
      0,
    );

    eff.destroy();
    destroySignal(a);

    expect(getSubscriptionCount(globalEffectQueue) - baselineEffect).toBe(0);
    expect(getSubscriptionCount(globalEffectCalledQueue) - baselineCalled).toBe(
      0,
    );
  });

  describe('rejects thenable-returning callbacks (ASYNC-003)', () => {
    it('throws when the callback is an async function, instead of silently unbatching writes after the first await', async () => {
      const {get: a, set: setA} = createSignal(0);
      const seen: number[] = [];
      const eff = createEffect(() => {
        seen.push(a());
      });

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

      eff.destroy();
      destroySignal(a);
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

      expect(() => {
        batch(() => {
          setA(1);
          return 42;
        });
      }).not.toThrow();

      expect(seen).toEqual([0, 1]);

      eff.destroy();
      destroySignal(a);
    });
  });
});
