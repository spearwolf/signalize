import {getEventListeners} from 'node:events';
import {getSubscriptionCount, once} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './assert-helpers.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {createSignal, destroySignal, link} from './index.js';
import {SignalLinkToCallback} from './SignalLink.js';
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

      await expect(
        con.nextValue({signal: controller.signal}),
      ).rejects.toBeDefined();

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

      await expect(pending).rejects.toBeDefined();
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
        new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 200)),
      ]);

      expect(raced).toEqual({value: 3, done: false});

      await iter2.return(undefined as any);
      con.destroy();
      destroySignal(sigA);
    });
  });

  describe('S6: destroy() reports every failing destroy-queue release, not just the last one', () => {
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
        '[signalize] 2 errors while releasing SignalLink destroy-queue subscriptions',
      );

      destroySignal(sigA);
    });
  });
});
