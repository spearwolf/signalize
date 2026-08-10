import {getRetainedEventNames, getSubscriptionCount} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal, destroySignal, link} from './index.js';

const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

// A promise that must settle on its own — the alternative is a test that
// hangs instead of failing. `iter.return()` on a parked generator either
// settles or it does not; a race says which, in an assertion.
const withinTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`did not settle within ${ms}ms`)), ms);
    }),
  ]);

// Emergency exit *inside* the loop body. A runaway asyncValues() loop
// starves every timer, Vitest's own testTimeout included (measured: killed
// after 45 s with testTimeout 3000), so the runaway guard has to be the one
// thing that still runs — stopAction.
const RUNAWAY = 20;

describe('link.asyncValues', () => {
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

  it('async values iteration', async () => {
    const a = createSignal(23);
    const b = createSignal(0);

    try {
      const con = link(a, b);

      expect(a.value).toBe(23);

      const result = new Promise(async (resolve) => {
        const values = [];

        for await (const val of con.asyncValues((_, i) => i >= 5)) {
          values.push(val);
          a.set(val + 1);
        }

        resolve(values);
      });

      a.set(1);

      await expect(result).resolves.toEqual([1, 2, 3, 4, 5]);
    } finally {
      destroySignal(a, b);
    }
  });

  it('async values with destroy', async () => {
    const a = createSignal(23);
    const b = createSignal(0);

    try {
      const con = link(a, b);

      expect(a.value).toBe(23);

      const result = new Promise(async (resolve) => {
        const values = [];

        for await (const val of con.asyncValues()) {
          values.push(val);
          a.set(val + 1);
          if (val === 5) con.destroy();
        }

        resolve(values);
      });

      a.set(1);

      await expect(result).resolves.toEqual([1, 2, 3, 4, 5]);
    } finally {
      destroySignal(a, b);
    }
  });

  it('delivers one propagated value once, without a writing loop body (ASYNC-005)', async () => {
    const a = createSignal(23);
    const b = createSignal(0);

    try {
      const con = link(a, b);
      const seen: number[] = [];

      const iteration = (async () => {
        for await (const val of con.asyncValues((_v, i) => i >= RUNAWAY)) {
          seen.push(val);
        }
      })();

      a.set(1);

      await macrotask();

      expect(
        seen.length,
        'the loop must not replay the retained value at itself',
      ).toBeLessThan(RUNAWAY);
      expect(seen).toEqual([1]);

      con.destroy();
      await iteration;

      expect(seen).toEqual([1]);
    } finally {
      destroySignal(a, b);
    }
  });

  it('two parallel iterators each see every value once (ASYNC-005)', async () => {
    const a = createSignal(23);

    try {
      const con = link(a, () => {});
      const seenA: number[] = [];
      const seenB: number[] = [];

      const one = (async () => {
        for await (const val of con.asyncValues((_v, i) => i >= RUNAWAY)) {
          seenA.push(val);
        }
      })();
      const two = (async () => {
        for await (const val of con.asyncValues((_v, i) => i >= RUNAWAY)) {
          seenB.push(val);
        }
      })();

      a.set(1);
      await macrotask();
      a.set(2);
      await macrotask();

      expect(seenA).toEqual([1, 2]);
      expect(seenB).toEqual([1, 2]);

      con.destroy();
      await Promise.all([one, two]);
    } finally {
      destroySignal(a);
    }
  });

  it('a value that arrives between two reads is still delivered (the retained slot earns its keep)', async () => {
    const a = createSignal(23);

    try {
      const con = link(a, () => {});
      const seen: number[] = [];

      const iteration = (async () => {
        for await (const val of con.asyncValues((_v, i) => i >= RUNAWAY)) {
          seen.push(val);
          await macrotask(); // busy: no VALUE listener subscribed meanwhile
        }
      })();

      a.set(1);
      await macrotask();
      a.set(2); // lands in the retained slot with nobody waiting
      await macrotask();
      await macrotask();

      expect(seen).toEqual([1, 2]);

      con.destroy();
      await iteration;
    } finally {
      destroySignal(a);
    }
  });

  it('return() closes an iterator that is waiting for the next value (W1)', async () => {
    const a = createSignal(23);

    try {
      const con = link(a, () => {});
      const baseline = getSubscriptionCount(con);

      const iter = con.asyncValues();
      const p0 = iter.next();
      a.set(1);
      await expect(p0).resolves.toEqual({value: 1, done: false});

      // Nothing new to read: the generator is parked inside its own
      // `await nextValue()`, not at its `yield`. That is the one state a
      // plain async generator cannot be closed from — a `return()` is
      // queued behind the pending read, and the read waits for a value
      // that nobody is going to write.
      const idle = iter.next();
      await macrotask();

      await expect(
        withinTimeout(iter.return(undefined as any), 100),
      ).resolves.toEqual({value: undefined, done: true});
      await expect(idle).resolves.toEqual({value: undefined, done: true});

      expect(
        getSubscriptionCount(con),
        'a closed iterator leaves no subscription on the link',
      ).toBe(baseline);
      expect(getRetainedEventNames(con)).toEqual([]);

      con.destroy();
    } finally {
      destroySignal(a);
    }
  });

  it('return() closes an iterator that never got a value at all (W1)', async () => {
    const a = createSignal(23);

    try {
      const con = link(a, () => {});
      const baseline = getSubscriptionCount(con);

      const iter = con.asyncValues();
      const idle = iter.next(); // nothing propagated yet, and nothing will be
      await macrotask();

      await expect(
        withinTimeout(iter.return(undefined as any), 100),
      ).resolves.toEqual({value: undefined, done: true});
      await expect(idle).resolves.toEqual({value: undefined, done: true});

      expect(getSubscriptionCount(con)).toBe(baseline);
      expect(getRetainedEventNames(con)).toEqual([]);

      con.destroy();
    } finally {
      destroySignal(a);
    }
  });

  it('throw() closes an iterator that is waiting for the next value (W1)', async () => {
    const a = createSignal(23);

    try {
      const con = link(a, () => {});
      const baseline = getSubscriptionCount(con);

      const iter = con.asyncValues();
      const p0 = iter.next();
      a.set(1);
      await expect(p0).resolves.toEqual({value: 1, done: false});

      const idle = iter.next();
      await macrotask();

      const boom = new Error('boom');
      await expect(withinTimeout(iter.throw(boom), 100)).rejects.toBe(boom);
      await expect(idle).resolves.toEqual({value: undefined, done: true});

      expect(
        getSubscriptionCount(con),
        'a closed iterator leaves no subscription on the link',
      ).toBe(baseline);
      expect(getRetainedEventNames(con)).toEqual([]);

      con.destroy();
    } finally {
      destroySignal(a);
    }
  });
});
