import {on} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {DESTROY} from './constants.js';
import {createSignal, destroySignal, link, unlink} from './index.js';
import type {SignalLink} from './SignalLink.js';

describe('unlink()', () => {
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

  it('unlink a specific link between two signals', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

    try {
      expect(sigA()).toBe(1);
      expect(sigB()).toBe(-1);

      const con = link(sigA, sigB);

      assertLinksCount(1, 'after link');

      expect(sigB()).toBe(1);

      setA(42);

      expect(sigA()).toBe(42);
      expect(sigB()).toBe(42);

      unlink(sigA, sigB);

      assertLinksCount(0, 'after unlink');
      expect(con.isDestroyed).toBe(true);

      setA(100);

      expect(sigA()).toBe(100);
      expect(sigB()).toBe(42); // should not update
    } finally {
      destroySignal(sigA, sigB);
    }
  });

  it('unlink a specific link between signal and callback', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const callbackMock = vi.fn();

    try {
      link(sigA, callbackMock);

      expect(callbackMock).toHaveBeenCalledWith(1);
      expect(callbackMock).toHaveBeenCalledTimes(1);

      assertLinksCount(1, 'after link');

      setA(42);

      expect(callbackMock).toHaveBeenCalledWith(42);
      expect(callbackMock).toHaveBeenCalledTimes(2);

      unlink(sigA, callbackMock);

      assertLinksCount(0, 'after unlink');

      setA(100);

      expect(callbackMock).toHaveBeenCalledTimes(2); // should not be called again
    } finally {
      destroySignal(sigA);
    }
  });

  it('unlink all links from a source signal', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);
    const {get: sigC} = createSignal(-2);
    const callbackMock = vi.fn();

    try {
      link(sigA, sigB);
      link(sigA, sigC);
      link(sigA, callbackMock);

      assertLinksCount(3, 'after links');

      expect(sigB()).toBe(1);
      expect(sigC()).toBe(1);
      expect(callbackMock).toHaveBeenCalledTimes(1);

      setA(42);

      expect(sigB()).toBe(42);
      expect(sigC()).toBe(42);
      expect(callbackMock).toHaveBeenCalledWith(42);
      expect(callbackMock).toHaveBeenCalledTimes(2);

      unlink(sigA);

      assertLinksCount(0, 'after unlink all');

      setA(100);

      expect(sigA()).toBe(100);
      expect(sigB()).toBe(42); // should not update
      expect(sigC()).toBe(42); // should not update
      expect(callbackMock).toHaveBeenCalledTimes(2); // should not be called again
    } finally {
      destroySignal(sigA, sigB, sigC);
    }
  });

  it('unlink emits DESTROY event', () => {
    const {get: sigA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

    const destroyMock = vi.fn();

    try {
      const con = link(sigA, sigB);

      on(con, DESTROY, destroyMock);

      expect(destroyMock).toHaveBeenCalledTimes(0);

      unlink(sigA, sigB);

      expect(destroyMock).toHaveBeenCalledTimes(1);
      expect(con.isDestroyed).toBe(true);
    } finally {
      destroySignal(sigA, sigB);
    }
  });

  it('unlink all links emits DESTROY event for all links', () => {
    const {get: sigA} = createSignal(1);
    const {get: sigB} = createSignal(-1);
    const {get: sigC} = createSignal(-2);

    const destroyMock = vi.fn();

    try {
      const con1 = link(sigA, sigB);
      const con2 = link(sigA, sigC);

      on(con1, DESTROY, destroyMock);
      on(con2, DESTROY, destroyMock);

      expect(destroyMock).toHaveBeenCalledTimes(0);

      unlink(sigA);

      expect(destroyMock).toHaveBeenCalledTimes(2);
      expect(con1.isDestroyed).toBe(true);
      expect(con2.isDestroyed).toBe(true);
    } finally {
      destroySignal(sigA, sigB, sigC);
    }
  });

  it('unlink on non-existent link is a no-op', () => {
    const sigA = createSignal(1);
    const sigB = createSignal(-1);

    try {
      assertLinksCount(0, 'before unlink');

      // unlink without any links should not throw
      unlink(sigA.get, sigB.get);

      assertLinksCount(0, 'after unlink');
    } finally {
      destroySignal(sigA.get, sigB.get);
    }
  });

  it('unlink() with an unknown target on a source that has other links is a no-op (TEST-026)', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);
    const {get: sigC} = createSignal(-2); // never linked from sigA

    try {
      link(sigA, sigB);
      assertLinksCount(1, 'after link');

      unlink(sigA, sigC);

      assertLinksCount(1, 'unchanged — sigC was never a target of sigA');

      setA(42);
      expect(sigB()).toBe(42); // the real link is untouched
    } finally {
      destroySignal(sigA, sigB, sigC);
    }
  });

  it('unlink all on source with no links is a no-op', () => {
    const sigA = createSignal(1);

    try {
      assertLinksCount(0, 'before unlink');

      // unlink without any links should not throw
      unlink(sigA.get);

      assertLinksCount(0, 'after unlink');
    } finally {
      destroySignal(sigA.get);
    }
  });

  it('unlink one link while others remain', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);
    const {get: sigC} = createSignal(-2);

    try {
      link(sigA, sigB);
      link(sigA, sigC);

      assertLinksCount(2, 'after links');

      expect(sigB()).toBe(1);
      expect(sigC()).toBe(1);

      unlink(sigA, sigB);

      assertLinksCount(1, 'after unlink sigB');

      setA(42);

      expect(sigA()).toBe(42);
      expect(sigB()).toBe(1); // should not update
      expect(sigC()).toBe(42); // should update
    } finally {
      destroySignal(sigA, sigB, sigC);
    }
  });

  it('unlink with signal reader (get function)', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

    try {
      link(sigA, sigB);

      assertLinksCount(1, 'after link');

      setA(42);

      expect(sigB()).toBe(42);

      // unlink using the reader functions
      unlink(sigA, sigB);

      assertLinksCount(0, 'after unlink');

      setA(100);

      expect(sigA()).toBe(100);
      expect(sigB()).toBe(42); // should not update
    } finally {
      destroySignal(sigA, sigB);
    }
  });

  it('repeated unlink calls are safe', () => {
    const {get: sigA} = createSignal(1);
    const {get: sigB} = createSignal(-1);

    try {
      const con = link(sigA, sigB);

      assertLinksCount(1, 'after link');

      unlink(sigA, sigB);

      assertLinksCount(0, 'after first unlink');
      expect(con.isDestroyed).toBe(true);

      // unlinking again should be safe
      unlink(sigA, sigB);

      assertLinksCount(0, 'after second unlink');
    } finally {
      destroySignal(sigA, sigB);
    }
  });

  it('unlink specific target when multiple targets exist', () => {
    const {get: sigA, set: setA} = createSignal(1);
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    try {
      link(sigA, callback1);
      link(sigA, callback2);

      assertLinksCount(2, 'after links');

      expect(callback1).toHaveBeenCalledWith(1);
      expect(callback2).toHaveBeenCalledWith(1);

      setA(42);

      expect(callback1).toHaveBeenCalledWith(42);
      expect(callback2).toHaveBeenCalledWith(42);
      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(2);

      unlink(sigA, callback1);

      assertLinksCount(1, 'after unlink callback1');

      setA(100);

      expect(callback1).toHaveBeenCalledTimes(2); // should not be called again
      expect(callback2).toHaveBeenCalledWith(100);
      expect(callback2).toHaveBeenCalledTimes(3);
    } finally {
      destroySignal(sigA);
    }
  });

  describe('MEM-011: one failing link does not cost its siblings their teardown', () => {
    it('unlink(source) tears every link down and reports afterwards', () => {
      const src = createSignal(0);
      const first = link(src, () => {});
      const second = link(src, () => {});
      const third = link(src, () => {});

      try {
        assertLinksCount(3, 'three links on one source');

        on(first, DESTROY, () => {
          throw new Error('listener boom');
        });

        expect(
          () => unlink(src),
          'the failure still reaches the caller',
        ).toThrow('listener boom');

        expect(
          [first, second, third].map((l) => l.isDestroyed),
          'every link was torn down, not only the ones before the throw',
        ).toEqual([true, true, true]);

        assertLinksCount(0, 'and the register is empty again');
      } finally {
        destroySignal(src);
      }
    });

    it('one failure is rethrown unchanged, several arrive as an AggregateError', () => {
      const src = createSignal(0);
      const solo = new Error('solo boom');
      const created: SignalLink<number>[] = [];

      try {
        const one = link(src, () => {});
        created.push(one);

        on(one, DESTROY, () => {
          throw solo;
        });

        let caught: unknown;
        try {
          unlink(src);
        } catch (err) {
          caught = err;
        }

        expect(caught, 'the single error is the very same object').toBe(solo);
        assertLinksCount(0, 'after the single failure');

        const a = link(src, () => {});
        const b = link(src, () => {});
        created.push(a, b);

        on(a, DESTROY, () => {
          throw new Error('boom-a');
        });
        on(b, DESTROY, () => {
          throw new Error('boom-b');
        });

        let aggregated: unknown;
        try {
          unlink(src);
        } catch (err) {
          aggregated = err;
        }

        expect(aggregated, 'two failures are bundled').toBeInstanceOf(
          AggregateError,
        );
        expect(
          (aggregated as AggregateError).errors.map((e: Error) => e.message),
          'in teardown order',
        ).toEqual(['boom-a', 'boom-b']);
        assertLinksCount(0, 'after the double failure');
      } finally {
        // Rule (d) from package 7a: on the unfixed code `unlink()` leaves
        // links standing that still carry their throwing listeners, so an
        // unguarded teardown here would fail a second time and replace the
        // assertion that brought us here. Each link goes down on its own.
        for (const l of created) {
          try {
            l.destroy();
          } catch {
            /* ignore */
          }
        }
        destroySignal(src);
      }
    });
  });
});
