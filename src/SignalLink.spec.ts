import {getEventListeners} from 'node:events';
import {
  getRetainedCount,
  getRetainedEventNames,
  getSubscriptionCount,
  on,
  once,
} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './assert-helpers.js';
import {DESTROY, VALUE} from './constants.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {createEffect, createSignal, destroySignal, link} from './index.js';
import {type SignalLink, SignalLinkToCallback} from './SignalLink.js';
import type {SignalLike} from './types.js';

describe('SignalLink', () => {
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

  describe('MEM-004: destroy() releases the globalDestroySignalQueue subscriptions', () => {
    it('signal-to-signal link: subscribes twice (source + target), releases both on destroy()', () => {
      const baseline = getSubscriptionCount(globalDestroySignalQueue);

      const sigA = createSignal(1);
      const sigB = createSignal(-1);

      const con = link(sigA, sigB);

      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline + 2);

      con.destroy();

      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline);

      destroySignal(sigA, sigB);
    });

    it('signal-to-callback link: subscribes once, releases it on destroy()', () => {
      const baseline = getSubscriptionCount(globalDestroySignalQueue);

      const sigA = createSignal(1);
      const con = link(sigA, () => {});

      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline + 1);

      con.destroy();

      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline);

      destroySignal(sigA);
    });

    it('destroying the source signal (not the link directly) also releases the target-side subscription', () => {
      const baseline = getSubscriptionCount(globalDestroySignalQueue);

      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const con = link(sigA, sigB);

      // Destroys sigA first, which drives con.destroy() through the
      // source-side once() on globalDestroySignalQueue. If the
      // target-side once() (SignalLinkToSignal's own subscription on
      // sigB.id) isn't also released here, it dangles until sigB itself
      // is destroyed.
      destroySignal(sigA);

      expect(con.isDestroyed).toBe(true);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline);

      destroySignal(sigB);
    });

    it('destroying the target signal first also releases the source-side subscription', () => {
      const baseline = getSubscriptionCount(globalDestroySignalQueue);

      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const con = link(sigA, sigB);

      destroySignal(sigB);

      expect(con.isDestroyed).toBe(true);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(baseline);

      destroySignal(sigA);
    });
  });

  describe('ASYNC-004: nextValue() rejects with an Error and is abortable', () => {
    it('rejects with an Error (not undefined) when the link is destroyed while nextValue() is pending', {
      timeout: 500,
    }, async () => {
      const sigA = createSignal(1);
      const sigB = createSignal(-1);
      const con = link(sigA, sigB);

      const pending = con.nextValue().catch((e) => e);
      con.destroy();

      const err = await pending;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/destroyed/i);

      destroySignal(sigA, sigB);
    });

    it('nextValue({signal}) rejects immediately when the signal is already aborted', {
      timeout: 500,
    }, async () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});
      const controller = new AbortController();
      controller.abort();

      await expect(con.nextValue({signal: controller.signal})).rejects.toBe(
        controller.signal.reason,
      );

      con.destroy();
      destroySignal(sigA);
    });

    it('nextValue({signal}) rejects once the signal aborts while pending, and removes its abort listener afterwards (no leak)', {
      timeout: 500,
    }, async () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});
      const controller = new AbortController();

      const pending = con.nextValue({signal: controller.signal});

      expect(getEventListeners(controller.signal, 'abort').length).toBe(1);

      controller.abort();

      await expect(pending).rejects.toBe(controller.signal.reason);
      expect(getEventListeners(controller.signal, 'abort').length).toBe(0);

      con.destroy();
      destroySignal(sigA);
    });

    it('the abort listener is removed again when nextValue({signal}) settles normally, not via abort', {
      timeout: 500,
    }, async () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});
      const controller = new AbortController();

      const pending = con.nextValue({signal: controller.signal});
      expect(getEventListeners(controller.signal, 'abort').length).toBe(1);

      sigA.set(2);

      await expect(pending).resolves.toBe(2);
      expect(getEventListeners(controller.signal, 'abort').length).toBe(0);

      con.destroy();
      destroySignal(sigA);
    });

    it('nextValue() on an already-destroyed link rejects immediately instead of hanging forever', {
      timeout: 500,
    }, async () => {
      // Distinct from "destroyed while pending": here the link is already
      // destroyed *before* nextValue() is even called. off(this) already
      // ran during destroy(), so DESTROY is never emitted again — without
      // an explicit guard, the Promise built from once(this, VALUE, ...)
      // and once(this, DESTROY, ...) would simply never settle, and both
      // subscriptions would sit on the dead link for as long as the
      // Promise itself is referenced.
      const sigA = createSignal(1);
      const con = link(sigA, () => {});
      con.destroy();

      await expect(con.nextValue()).rejects.toThrow(
        'SignalLink destroyed before the next value arrived',
      );

      destroySignal(sigA);
    });

    it('nextValue({signal}) on an already-destroyed link also rejects immediately and leaves no abort listener behind', {
      timeout: 500,
    }, async () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});
      con.destroy();

      const controller = new AbortController();
      await expect(con.nextValue({signal: controller.signal})).rejects.toThrow(
        'SignalLink destroyed before the next value arrived',
      );
      expect(getEventListeners(controller.signal, 'abort').length).toBe(0);

      destroySignal(sigA);
    });
  });

  describe('K1: nextValue({signal}) survives a synchronous retained-VALUE replay', () => {
    // eventize replays a retained event synchronously, inside the once()
    // call itself, before that call returns (see the using-eventize skill /
    // docs/retain.md). asyncValues() retains VALUE (ASYNC-005), so once one
    // is running, every nextValue({signal}) call that follows resolves via
    // that synchronous replay instead of a later, genuinely async emit.
    // Subscribing VALUE before DESTROY/abort used to mean the replay fired
    // before those two were registered, so `unsubscribe()` (called from
    // inside the replay) found nothing to release — every such call leaked
    // its DESTROY listener and, worse, its abort listener on the *caller's*
    // AbortSignal.

    it('a single nextValue({signal}) resolving via a synchronous retained replay leaves no abort listener behind', {
      timeout: 500,
    }, async () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});

      // Get VALUE into the retained state, the way asyncValues() does.
      const iter = con.asyncValues();
      const p0 = iter.next();
      sigA.set(2);
      await expect(p0).resolves.toEqual({value: 2, done: false});

      // From here on VALUE is retained with 2 — this call resolves via the
      // synchronous replay inside once(this, VALUE, ...).
      const controller = new AbortController();
      const result = await con.nextValue({signal: controller.signal});
      expect(result).toBe(2);
      expect(getEventListeners(controller.signal, 'abort').length).toBe(0);

      await iter.return(undefined as any);
      con.destroy();
      destroySignal(sigA);
    });

    it('repeated nextValue({signal}) calls while VALUE stays retained do not accumulate abort listeners', {
      timeout: 500,
    }, async () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});

      const iter = con.asyncValues();
      const p0 = iter.next();
      sigA.set(2);
      await p0; // VALUE is now retained with 2

      for (let i = 0; i < 5; i++) {
        const controller = new AbortController();
        const result = await con.nextValue({signal: controller.signal});
        expect(result).toBe(2);
        expect(getEventListeners(controller.signal, 'abort').length).toBe(0);
      }

      await iter.return(undefined as any);
      con.destroy();
      destroySignal(sigA);
    });

    it('a shared AbortSignal across an asyncValues(stop, {signal}) loop does not accumulate abort listeners once VALUE is retained', {
      timeout: 1000,
    }, async () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});
      const controller = new AbortController();

      const iter = con.asyncValues(undefined, {signal: controller.signal});

      // First read: nothing retained yet (this generator's own retain(this,
      // VALUE) call, at the top of asyncValues(), only starts capturing
      // *future* emits), so it needs a live emit to resolve.
      const p0 = iter.next();
      sigA.set(2);
      await expect(p0).resolves.toEqual({value: 2, done: false});
      expect(getEventListeners(controller.signal, 'abort').length).toBe(0);

      // From here on VALUE is retained. Every further read on this same
      // shared AbortSignal resolves via the synchronous retained replay —
      // K1's exact trigger — and each one must still leave the signal
      // listener-free once it settles, not just the first.
      for (let i = 0; i < 3; i++) {
        const {done} = await iter.next();
        expect(done).toBe(false);
        expect(getEventListeners(controller.signal, 'abort').length).toBe(0);
      }

      await iter.return(undefined as any);
      con.destroy();
      destroySignal(sigA);
    });
  });

  describe('ASYNC-004 / W2: asyncValues({signal}) abort handling', () => {
    it('asyncValues({signal}) throws the abort reason instead of ending quietly when the signal is already aborted', {
      timeout: 500,
    }, async () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});
      const controller = new AbortController();
      controller.abort();

      const iter = con.asyncValues(undefined, {signal: controller.signal});

      await expect(iter.next()).rejects.toBe(controller.signal.reason);

      con.destroy();
      destroySignal(sigA);
    });

    it('asyncValues({signal}) throws the abort reason when the signal aborts while a value is pending', {
      timeout: 500,
    }, async () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});
      const controller = new AbortController();

      const iter = con.asyncValues(undefined, {signal: controller.signal});
      const pending = iter.next();

      controller.abort();

      await expect(pending).rejects.toBe(controller.signal.reason);

      con.destroy();
      destroySignal(sigA);
    });

    it('a destroyed link, by contrast, still ends asyncValues() quietly (no signal involved)', {
      timeout: 500,
    }, async () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});

      const iter = con.asyncValues();
      con.destroy();

      await expect(iter.next()).resolves.toEqual({
        value: undefined,
        done: true,
      });

      destroySignal(sigA);
    });

    it('a destroy() while an asyncValues({signal}) read is genuinely pending (not yet destroyed at loop start) also ends quietly', {
      timeout: 500,
    }, async () => {
      // Distinct from the previous test: there the link was already
      // destroyed before the generator ever ran, so the `while
      // (!this.isDestroyed)` condition alone ended the loop. Here
      // `nextValue()` is actually awaiting, and destroy() rejects it from
      // outside — exercising the `catch (err) { ... break; }` path itself,
      // not just the loop guard, and confirming it takes the "end quietly"
      // branch rather than S9's "rethrow" branch when no signal aborted.
      const sigA = createSignal(1);
      const con = link(sigA, () => {});
      const controller = new AbortController();

      const iter = con.asyncValues(undefined, {signal: controller.signal});
      const pending = iter.next();

      con.destroy();

      await expect(pending).resolves.toEqual({value: undefined, done: true});
      expect(getEventListeners(controller.signal, 'abort').length).toBe(0);

      destroySignal(sigA);
    });

    it('destroy() immediately followed by abort() in the same synchronous block still ends quietly — the destroy error, not the abort, must not be mistaken for an abort', {
      timeout: 500,
    }, async () => {
      // A teardown path (unmount, dispose) naturally writes exactly this:
      // destroy whatever owns the link, then cancel its own controller.
      // `con.destroy()` synchronously rejects the pending nextValue() with
      // its own Error *and* — via that same rejection's unsubscribe() —
      // removes the abort listener before `ctrl.abort()` even runs. By the
      // time the microtask catch block in asyncValues() looks at
      // `options.signal.aborted`, it reads `true` regardless of which of
      // the two actually caused *this* rejection — checking only that flag
      // would misread the destroy-driven rejection as an abort and rethrow
      // it, breaking the documented "destroy ends the loop quietly"
      // contract.
      const sigA = createSignal(1);
      const con = link(sigA, () => {});
      const controller = new AbortController();

      const iter = con.asyncValues(undefined, {signal: controller.signal});
      const pending = iter.next();

      con.destroy();
      controller.abort();

      await expect(pending).resolves.toEqual({value: undefined, done: true});

      destroySignal(sigA);
    });
  });

  describe('ASYNC-005: asyncValues() shares retain() across parallel iterators', () => {
    it('a finishing asyncValues() iterator does not clear the retained value while a sibling iterator is still active', {
      timeout: 1000,
    }, async () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});

      const iter1 = con.asyncValues();
      const iter2 = con.asyncValues();

      // Both subscribe synchronously (async generators run up to their
      // first `await` immediately on `.next()`), so this update reaches
      // both live.
      const p1 = iter1.next();
      const p2 = iter2.next();
      sigA.set(2);

      await expect(p1).resolves.toEqual({value: 2, done: false});
      await expect(p2).resolves.toEqual({value: 2, done: false});

      // iter1 finishes; iter2 must keep working.
      await iter1.return(undefined as any);

      // A genuinely new value arrives while iter2 is paused between reads
      // (not currently subscribed — it's sitting at its `yield`, waiting
      // for this test to pull the next one). This is deliberately *not*
      // the `2` iter2 already saw (W4): asserting that exact duplicate
      // would pin down retain()'s synchronous-replay behavior — real, but
      // not what ASYNC-005 is about, and not documented as a promise. What
      // ASYNC-005 promises is narrower: iter1 finishing does not cut iter2
      // off. If iter1's cleanup had wrongly cleared the shared retained
      // slot, iter2's next read would have nothing to synchronously replay
      // and would hang until a *further* emission that never comes here.
      sigA.set(3);

      const raced = await Promise.race([
        iter2.next(),
        // Not a wall-clock threshold: a macrotask only runs once the
        // microtask queue drains, so this sentinel wins only if iter2's
        // read never settles in microtasks — the outcome is decided by
        // event-loop ordering, not runner speed.
        //
        // Against a release *one iterator too early* — the failure mode
        // this test is named for — the assertion bites only since the
        // MEM-004 fix. Back when iter1's cleanup called `retainClear()`,
        // an early release was invisible here: the policy survived it, so
        // `sigA.set(3)` refilled the slot either way and iter2's read was
        // replayed regardless. Now the cleanup calls `unretain()` and takes
        // the policy with it — an early release leaves `sigA.set(3)`
        // nowhere to land, iter2 hangs, and the sentinel wins. Measured
        // against exactly that mutant (`#activeAsyncValuesCount === 0` →
        // `>= 0`): green before the fix, `expected 'TIMEOUT' to deeply
        // equal {value: 3, done: false}` after it. Other damage to the
        // retain machinery — dropping the `retain(this, VALUE)` on entry,
        // say — this test caught before the fix too.
        new Promise((resolve) => setImmediate(() => resolve('TIMEOUT'))),
      ]);

      expect(raced).toEqual({value: 3, done: false});

      await iter2.return(undefined as any);
      con.destroy();
      destroySignal(sigA);
    });
  });

  // Deliberately not built like the ASYNC-005 test above. That one is
  // sensitive to a release one iterator too early (see its comment), but not
  // to what MEM-004 is actually about: whether the release after the *last*
  // iterator drops the retain policy or only the stored value. It never
  // looks at the link again once its last iterator is gone — every read it
  // makes happens while iter2 is still alive and VALUE is still retained
  // under either implementation. Measured: swap `unretain()` back for
  // `retainClear()` at the correct moment and ASYNC-005 stays green, while
  // both tests below fail. They see it because they do the opposite: they
  // write *after* the last iterator and claim that nothing sticks.
  describe('MEM-004: the last asyncValues() iterator switches VALUE retaining off', () => {
    it('drops the retain policy, not just the stored value', {
      timeout: 1000,
    }, async () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});

      const iter = con.asyncValues();
      const p = iter.next();
      sigA.set(2);
      await expect(p).resolves.toEqual({value: 2, done: false});

      await iter.return(undefined as any);

      expect(getRetainedEventNames(con)).toEqual([]);

      // With the policy gone, an unobserved write has nowhere to land.
      sigA.set(3);
      expect(getRetainedCount(con)).toBe(0);

      con.destroy();
      destroySignal(sigA);
    });

    it('so a later nextValue() waits for the next value instead of resolving with an old one', {
      timeout: 1000,
    }, async () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});

      const iter = con.asyncValues();
      const p = iter.next();
      sigA.set(2);
      await expect(p).resolves.toEqual({value: 2, done: false});

      await iter.return(undefined as any);

      // Nobody is listening for this one.
      sigA.set(3);

      let settled: unknown = 'PENDING';
      const pending = con.nextValue();
      pending.then((value) => {
        settled = value;
      });

      // A retained replay runs *synchronously inside* the `once()` call
      // that `nextValue()` makes, so it would have landed long before this
      // macrotask — which only runs once the microtask queue has drained.
      await new Promise((resolve) => {
        setImmediate(resolve);
      });
      expect(settled).toBe('PENDING');

      sigA.set(4);
      await expect(pending).resolves.toBe(4);

      con.destroy();
      destroySignal(sigA);
    });
  });

  describe('S6: destroy() reports every failing teardown step, not just the last one', () => {
    // `releaseOnDestroy()` is `protected`, so a throwing handle can only be
    // installed from a subclass — these exist solely to give the spec that
    // hook. Two variants, one per error-count path: `destroy()` rethrows a
    // single collected error unchanged, and bundles several into an
    // `AggregateError` — this is the proof that the `throwCollectedErrors()`
    // refactor of `destroy()`'s tail is behavior-preserving, not a
    // regression test for a bug.
    class SingleThrowingLink extends SignalLinkToCallback<number> {
      constructor(source: SignalLike<number>, target: (value: number) => void) {
        super(source, target);
        this.releaseOnDestroy(() => {
          throw new Error('release-a');
        });
      }
    }

    class DoubleThrowingLink extends SignalLinkToCallback<number> {
      constructor(source: SignalLike<number>, target: (value: number) => void) {
        super(source, target);
        this.releaseOnDestroy(() => {
          throw new Error('release-a');
        });
        this.releaseOnDestroy(() => {
          throw new Error('release-b');
        });
      }
    }

    it('a single throwing handle rethrows that error unchanged, and the teardown still completes', () => {
      const sigA = createSignal(1);
      const con = new SingleThrowingLink(sigA, () => {});

      let destroyFired = false;
      once(con, 'destroy', () => {
        destroyFired = true;
      });

      // toThrow('release-a') also rules out the AggregateError shape: its
      // message is `[signalize] N errors while ...`, not the bare original.
      expect(() => con.destroy()).toThrow('release-a');

      expect(con.isDestroyed).toBe(true);
      expect(Object.isFrozen(con)).toBe(true);
      expect(con.lastValue).toBeUndefined();
      expect(destroyFired).toBe(true);

      destroySignal(sigA);
    });

    it('two throwing handles are bundled into an AggregateError, in registration order, with the collect-errors message', () => {
      const sigA = createSignal(1);
      const con = new DoubleThrowingLink(sigA, () => {});

      let caught: unknown;
      try {
        con.destroy();
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      const agg = caught as AggregateError;
      expect((agg.errors as Error[]).map((e) => e.message)).toEqual([
        'release-a',
        'release-b',
      ]);
      expect(agg.message).toBe(
        '[signalize] 2 errors while tearing down a SignalLink',
      );

      destroySignal(sigA);
    });
  });

  describe('BUG-001/002/008: destroy and re-entrancy during propagation', () => {
    it('a callback destroying its own link mid-propagation lets the rest of the delivery finish', () => {
      const sigA = createSignal(1);

      const received: number[] = [];
      const con: SignalLink<number> = link(sigA, (value: number) => {
        received.push(value);
        if (value === 2) {
          con.destroy();
        }
      });

      const sibling: number[] = [];
      const witness = link(sigA, (value: number) => {
        sibling.push(value);
      });

      expect(
        received,
        'the constructor touch delivered the first value',
      ).toEqual([1]);
      expect(sibling).toEqual([1]);

      expect(() => {
        sigA.set(2);
      }).not.toThrow();

      expect(received, 'the callback saw the value it destroyed on').toEqual([
        1, 2,
      ]);
      expect(con.isDestroyed).toBe(true);
      expect(
        con.lastValue,
        'destroy() cleared it and nothing wrote it back',
      ).toBeUndefined();
      expect(
        sibling,
        'the second link on the same source was still served',
      ).toEqual([1, 2]);

      witness.destroy();
      destroySignal(sigA);
    });

    it('a link-to-signal whose target effect destroys the source mid-propagation does not throw', () => {
      const src = createSignal(0);
      const dst = createSignal(0);
      const con = link(src, dst);

      const {destroy: destroyEffect} = createEffect(() => {
        if (dst.get() === 42) {
          destroySignal(src);
        }
      });

      expect(() => {
        src.set(42);
      }).not.toThrow();

      expect(con.isDestroyed).toBe(true);
      expect(con.lastValue).toBeUndefined();
      expect(dst.value, 'the target did receive the value').toBe(42);

      destroyEffect();
      destroySignal(dst);
    });

    it('an on() DESTROY listener calling destroy() again is a no-op instead of a stack overflow', () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});

      let destroyEvents = 0;
      let flagSeenByListener: boolean | undefined;
      on(con, DESTROY, () => {
        destroyEvents += 1;
        flagSeenByListener = con.isDestroyed;
        con.destroy();
      });

      expect(() => {
        con.destroy();
      }).not.toThrow();

      expect(destroyEvents, 'DESTROY is emitted exactly once').toBe(1);
      expect(
        flagSeenByListener,
        'the flag is already set when the listener runs',
      ).toBe(true);
      expect(con.isDestroyed).toBe(true);
      expect(Object.isFrozen(con)).toBe(true);

      destroySignal(sigA);
    });

    it('a throwing DESTROY listener does not leave the link half torn down', () => {
      const sigA = createSignal(1);
      const con = link(sigA, () => {});

      // A second listener so the subscription balance below says something:
      // `off(this)` is what has to clear it, and that step sits *after* the
      // emit that throws.
      on(con, VALUE, () => {});
      on(con, DESTROY, () => {
        throw new Error('destroy-listener-boom');
      });

      expect(() => {
        con.destroy();
      }, 'the listener error still reaches the caller').toThrow(
        'destroy-listener-boom',
      );

      expect(con.isDestroyed).toBe(true);
      expect(
        Object.isFrozen(con),
        'the teardown ran to the end despite the throw',
      ).toBe(true);
      expect(
        getSubscriptionCount(con),
        'off(this) released the remaining listeners',
      ).toBe(0);
      expect(con.lastValue).toBeUndefined();

      destroySignal(sigA);
    });

    it('a feedback write during propagation does not emit the superseded value afterwards', () => {
      const src = createSignal(0);
      const dst = createSignal(0);
      const con = link(src, dst);

      const emitted: number[] = [];
      on(con, VALUE, (value: number) => {
        emitted.push(value);
      });

      let bounced = false;
      const {destroy: destroyEffect} = createEffect(() => {
        const v = dst.get();
        if (v === 1 && !bounced) {
          bounced = true;
          src.set(2);
        }
      });

      src.set(1);

      expect(emitted, 'only the value that survived is announced').toEqual([2]);
      expect(con.lastValue).toBe(2);
      expect(src.value).toBe(2);
      expect(dst.value).toBe(2);

      destroyEffect();
      con.destroy();
      destroySignal(src);
      destroySignal(dst);
    });
  });
});
