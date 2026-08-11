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
import type {SignalReader} from './types.js';

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

  it('an effect that ran inside an outer flush, after a nested batch closed, is not run a second time by that flush (PERF-003)', () => {
    const a = createSignal(0);
    const b = createSignal(0);
    const c = createSignal(0);

    const runs: string[] = [];

    // Runs first in the flush, and does two things while the outer flush
    // is still open: it opens a nested batch that has something to flush,
    // and then writes unbatched — `Batch.current` is undefined during a
    // flush, so `observer` runs right there.
    const driver = createEffect(
      () => {
        a.get();
        runs.push('driver');
        batch(() => {
          c.set(c.value + 1);
        });
        b.set(b.value + 100);
      },
      {priority: 10},
    );

    const observer = createEffect(
      () => {
        b.get();
        runs.push('observer');
      },
      {priority: 0},
    );

    // Load-bearing, not scenery: it is what gives the nested batch something
    // to flush. Without it that batch finds an empty queue, returns early
    // (PERF-002) and never touches the depth counter — and this test would
    // pass even with a flag in place of the counter.
    const inner = createEffect(() => {
      c.get();
      runs.push('inner');
    });

    try {
      runs.length = 0;

      batch(() => {
        a.set(1);
        b.set(2);
      });

      expect(
        runs.filter((r) => r === 'observer').length,
        'the outer flush must still know that observer already ran',
      ).toBe(1);
    } finally {
      driver.destroy();
      observer.destroy();
      inner.destroy();
      destroySignal(a);
      destroySignal(b);
      destroySignal(c);
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

  describe('a memo read inside a batch is current (ASYNC-003, audit 2026-08-08)', () => {
    it('a memo whose dependency was written in the same batch reads the new value', () => {
      const dep = createSignal(10);
      const memo = createMemo(() => dep.get() * 2);

      try {
        expect(memo()).toBe(20);

        let insideTheBatch: unknown;
        batch(() => {
          dep.set(20);
          insideTheBatch = memo();
        });

        expect(
          insideTheBatch,
          'the read used to return the pre-write value and heal afterwards',
        ).toBe(40);
        expect(memo()).toBe(40);
      } finally {
        destroySignal(dep, memo);
      }
    });

    it('a memo created inside a batch reads its value instead of undefined', () => {
      const dep = createSignal(10);
      let memo!: SignalReader<number>;
      let insideTheBatch: unknown = 'never read';

      try {
        batch(() => {
          memo = createMemo(() => dep.get() * 2);
          insideTheBatch = memo();
        });

        expect(
          insideTheBatch,
          'a memo created in a batch has no previous value to fall back to',
        ).toBe(20);
      } finally {
        destroySignal(dep, memo);
      }
    });

    it('a lazy memo read inside a batch catches up instead of staying stale', () => {
      const dep = createSignal(10);
      const memo = createMemo(() => dep.get() * 2, {lazy: true});
      const downstream: number[] = [];
      const eff = createEffect(() => {
        downstream.push(dep.get());
      });

      try {
        expect(memo()).toBe(20); // prime: the first read is what runs it

        let insideTheBatch: unknown;
        batch(() => {
          dep.set(20);
          insideTheBatch = memo();
        });

        // `[RECALL]` only marks a lazy memo dirty, so the run the batch used
        // to queue for it was a no-op even at the flush: the value stayed
        // stale until something read it outside any batch.
        expect(insideTheBatch, 'lazy, dirty, and read inside the batch').toBe(
          40,
        );
        expect(downstream, 'the plain effect is still deferred').toEqual([
          10, 20,
        ]);
      } finally {
        eff.destroy();
        destroySignal(dep, memo);
      }
    });

    it('the read replaces the recompute the flush would have done, it does not add one', () => {
      const dep = createSignal(1);
      const computes: number[] = [];
      const memo = createMemo(() => {
        computes.push(dep.get());
        return dep.get() * 2;
      });

      try {
        computes.length = 0;

        batch(() => {
          dep.set(2);
          memo();
          memo();
        });

        // One recompute for the batch, exactly as before the fix — the read
        // pulls the queued run forward and takes it out of the queue, instead
        // of running the callback a second time when the batch closes.
        expect(computes, 'one write, one recompute').toEqual([2]);
        expect(memo()).toBe(4);
      } finally {
        destroySignal(dep, memo);
      }
    });

    it('does not reach a memo that is stale only through another memo', () => {
      const dep = createSignal(1);
      const inner = createMemo(() => dep.get() * 10);
      const outer = createMemo(() => inner() + 1);

      try {
        expect(outer()).toBe(11);

        let insideTheBatch: unknown;
        batch(() => {
          dep.set(2);
          insideTheBatch = outer();
        });

        // The boundary of ASYNC-003, pinned on purpose. `outer` does not read
        // `dep`, so nothing marked it dirty — the parked run belongs to
        // `inner`, and `#run()` returns at `!shouldRun` two lines before the
        // batch gate. A memo cannot ask its dependencies whether they are
        // about to change: propagation here is push-only, and the push is
        // exactly what the batch is holding back.
        //
        // Pulling upstream instead would not even work. `#signals` holds the
        // reads of the *last* run, not every read the callback could make, so
        // for `() => flag.get() ? a() : b()` a pre-emptive pull would recompute
        // the branch last taken — and miss the other one, which is precisely
        // the branch that matters when `flag` flips inside this batch. Too
        // eager and incomplete at once. The real answer is "maybe dirty"
        // propagation, which is a different library, not a fix.
        expect(
          insideTheBatch,
          'transitively stale: still the value from before the batch',
        ).toBe(11);
        expect(
          outer(),
          'an eager upstream pushes at the flush, and it catches up there',
        ).toBe(21);
      } finally {
        destroySignal(dep, inner, outer);
      }
    });

    it('behind a lazy upstream it does not even catch up at the flush', () => {
      const dep = createSignal(1);
      const inner = createMemo(() => dep.get() * 10, {lazy: true});
      const outer = createMemo(() => inner() + 1);

      try {
        expect(outer()).toBe(11);

        let insideTheBatch: unknown;
        batch(() => {
          dep.set(2);
          insideTheBatch = outer();
        });

        // The other half of the boundary, and this half is not the batch's
        // doing: a lazy memo never pushes. `[RECALL]` only marks it dirty, so
        // `inner` produces no write for `outer` to hear — inside the batch or
        // after it. `outer` stays on 11 until something reads `inner`.
        expect(insideTheBatch, 'stale inside the batch').toBe(11);
        expect(outer(), 'and still stale after the flush').toBe(11);
        expect(outer(), 'a second read changes nothing either').toBe(11);

        expect(inner(), 'reading the lazy one is what runs it').toBe(20);
        expect(outer(), 'and only then does the downstream memo follow').toBe(
          21,
        );
      } finally {
        destroySignal(dep, inner, outer);
      }
    });

    it('reading the upstream memo first, in the same batch, makes the downstream one fresh', () => {
      const eagerDep = createSignal(1);
      const eagerInner = createMemo(() => eagerDep.get() * 10);
      const eagerOuter = createMemo(() => eagerInner() + 1);

      const lazyDep = createSignal(1);
      const lazyInner = createMemo(() => lazyDep.get() * 10, {lazy: true});
      const lazyOuter = createMemo(() => lazyInner() + 1);

      try {
        expect(eagerOuter()).toBe(11);
        expect(lazyOuter()).toBe(11);

        // The way out of both boundaries above, and the only one there is:
        // read the upstream memo first. Its own read pulls its recompute
        // forward, that recompute writes into the open batch, and the write
        // marks the downstream memo dirty — so the read below no longer
        // returns early at `!shouldRun`. One extra call, in the right order.
        let eagerInside: unknown;
        let lazyInside: unknown;
        batch(() => {
          eagerDep.set(2);
          lazyDep.set(2);
          eagerInner();
          lazyInner();
          eagerInside = eagerOuter();
          lazyInside = lazyOuter();
        });

        expect(eagerInside, 'fresh, with an eager upstream').toBe(21);
        expect(
          lazyInside,
          'and fresh with a lazy one, which nothing else would have woken',
        ).toBe(21);
      } finally {
        destroySignal(eagerDep, eagerInner, eagerOuter);
        destroySignal(lazyDep, lazyInner, lazyOuter);
      }
    });

    it('a memo reading a batched signal and another memo recomputes twice, at the read and at the flush', () => {
      const dep = createSignal(1);
      const computes: number[] = [];
      const inner = createMemo(() => dep.get() * 10);
      const outer = createMemo(() => {
        computes.push(dep.get());
        return dep.get() + inner();
      });

      try {
        computes.length = 0;

        batch(() => {
          dep.set(2);
          outer();
        });

        // Two, and this is the price of pulling a chain forward. `inner`'s
        // recompute writes its memo signal into the open batch, and that
        // write marks `outer` dirty again — a moment after `outer` read the
        // very value it produced. `unbatch()` cannot help: it took the first
        // entry out before the run, and the second one is a genuine "a
        // dependency was written" as far as the effect can tell. Before
        // ASYNC-003 the whole cascade ran inside the flush and came to one
        // recompute; an unbatched write plus read has always cost two.
        //
        // It takes *both* reads to get here: `outer` reads `dep`, which is
        // what marks it dirty and gets it pulled forward at all, and it reads
        // `inner`, which is what re-queues it. Drop the `dep.get()` and the
        // test above applies instead — never pulled, one recompute. The two
        // boundaries are complementary; no memo suffers both.
        expect(computes, 'one write, one read, two recomputes').toEqual([2, 2]);
        expect(outer()).toBe(22);
      } finally {
        destroySignal(dep, inner, outer);
      }
    });

    it('the memo write it triggers stays inside the batch', () => {
      const dep = createSignal(1);
      const memo = createMemo(() => dep.get() * 2);
      const seen: number[] = [];
      const downstream = createEffect(() => {
        seen.push(memo());
      });

      try {
        expect(seen).toEqual([2]);
        seen.length = 0;

        let seenInsideTheBatch: number[] = [];
        batch(() => {
          dep.set(2);
          memo(); // recomputes here, and writes the memo signal here
          seenInsideTheBatch = [...seen];
        });

        expect(
          seenInsideTheBatch,
          'the recompute must not notify past the open batch',
        ).toEqual([]);
        expect(seen, 'one deduplicated run, after the callback').toEqual([4]);
      } finally {
        downstream.destroy();
        destroySignal(dep, memo);
      }
    });
  });
});
