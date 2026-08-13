import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './create-signal.js';
import {createEffect} from './effects.js';
import {
  destroyObjectSignals,
  findObjectSignalByName,
  findObjectSignalNames,
  findObjectSignals,
  storeAsObjectSignal,
} from './object-signals.js';
import {destroySignal} from './signal-core.js';
import {touch} from './touch.js';
import {value} from './value.js';

describe('object signals', () => {
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

  it('findObjectSignals() and findObjectSignalNames() return undefined for an object without a store', () => {
    const host: Record<string, unknown> = {alreadyAPlainProperty: 1};

    expect(findObjectSignals(host)).toBeUndefined();
    expect(findObjectSignalNames(host)).toBeUndefined();
    expect(
      findObjectSignalByName(host, 'alreadyAPlainProperty'),
    ).toBeUndefined();
  });

  it('findObjectSignals() lists the signals of an object in insertion order', () => {
    const host: Record<string | symbol, unknown> = {};
    const sym = Symbol('xyz');

    const foo = createSignal(1);
    const bar = createSignal('a');
    const xyz = createSignal(true);

    storeAsObjectSignal(host, 'foo', foo);
    storeAsObjectSignal(host, 'bar', bar);
    storeAsObjectSignal(host, sym, xyz);

    try {
      const signals = findObjectSignals(host);

      expect(signals).toHaveLength(3);
      expect(signals[0]).toBe(foo);
      expect(signals[1]).toBe(bar);
      expect(signals[2]).toBe(xyz);

      // the names come from the same Map, symbol keys included
      expect(findObjectSignalNames(host)).toEqual(['foo', 'bar', sym]);
    } finally {
      destroyObjectSignals(host);
    }
  });

  it('destroyObjectSignals() destroys the signals and drops the map', () => {
    const host: Record<string, unknown> = {};
    const foo = createSignal(1);
    const bar = createSignal('a');

    storeAsObjectSignal(host, 'foo', foo);
    storeAsObjectSignal(host, 'bar', bar);
    try {
      assertSignalsCount(2, 'after storeAsObjectSignal');

      destroyObjectSignals(host);

      assertSignalsCount(0, 'after destroyObjectSignals');
      expect(findObjectSignals(host)).toBeUndefined();
      expect(findObjectSignalNames(host)).toBeUndefined();
      expect(findObjectSignalByName(host, 'foo')).toBeUndefined();
    } finally {
      destroyObjectSignals(host);
    }
  });

  it('destroyObjectSignals() ignores an unknown object and a second call', () => {
    // never seen by the WeakMap at all
    expect(() => destroyObjectSignals({neverStored: true})).not.toThrow();

    const host: Record<string, unknown> = {};
    storeAsObjectSignal(host, 'foo', createSignal(1));

    try {
      destroyObjectSignals(host);
      assertSignalsCount(0, 'after the first call');

      // the store survives in the WeakMap, only its map is gone — the second
      // call must fall through both guards instead of dereferencing undefined
      expect(() => destroyObjectSignals(host)).not.toThrow();
      assertSignalsCount(0, 'after the second call');
    } finally {
      destroyObjectSignals(host);
    }
  });

  it('touch([obj, name]) notifies through the object store', () => {
    const host: Record<string, unknown> = {};
    const foo = createSignal(1);
    storeAsObjectSignal(host, 'foo', foo);

    const onChange = vi.fn();
    const unsubscribe = foo.onChange(onChange);

    try {
      touch([host, 'foo']);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(1);
    } finally {
      unsubscribe();
      destroyObjectSignals(host);
    }
  });

  it('touch() and value() reject a source that is neither a signal nor a tuple (CONS-007)', () => {
    const notASignal = {} as any;

    expect(() => touch(notASignal)).toThrow(TypeError);
    expect(() => touch(notASignal)).toThrow(
      '[signalize] touch: source must be a signal or an [object, propertyName] tuple',
    );

    expect(() => value(notASignal)).toThrow(TypeError);
    expect(() => value(notASignal)).toThrow(
      '[signalize] value: source must be a signal or an [object, propertyName] tuple',
    );

    expect(() => touch(undefined as any)).toThrow(
      '[signalize] touch: source must be a signal or an [object, propertyName] tuple',
    );
    expect(() => value(undefined as any)).toThrow(
      '[signalize] value: source must be a signal or an [object, propertyName] tuple',
    );
  });

  it('value([obj, name]) stays a plain undefined when no signal is stored under that name (CONS-007)', () => {
    const host: Record<string, unknown> = {};
    const foo = createSignal(1);
    storeAsObjectSignal(host, 'foo', foo);

    try {
      expect(value([host, 'foo'] as any)).toBe(1);
      expect(value([host, 'bar'] as any)).toBeUndefined();
      expect(value([{other: 1}, 'other'] as any)).toBeUndefined();
    } finally {
      destroyObjectSignals(host);
    }
  });

  it('touch([obj, name]) is a no-op when no signal is stored under that name', () => {
    const host: Record<string, unknown> = {};
    const foo = createSignal(1);
    storeAsObjectSignal(host, 'foo', foo);

    const onChange = vi.fn();
    const unsubscribe = foo.onChange(onChange);

    try {
      // the name is not in the store …
      expect(() => touch([host, 'bar'])).not.toThrow();
      // … and this object has no store at all
      expect(() => touch([{other: 1}, 'other'])).not.toThrow();

      expect(onChange).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
      destroyObjectSignals(host);
    }
  });

  describe('destroyObjectSignals() teardown errors (BUG-015)', () => {
    it('a throwing cleanup does not spare the remaining signals of the same object', () => {
      const host: Record<string, unknown> = {};
      const foo = createSignal(1);
      const bar = createSignal(2);
      storeAsObjectSignal(host, 'foo', foo);
      storeAsObjectSignal(host, 'bar', bar);

      createEffect(() => {
        foo.get();
        return () => {
          throw new Error('cleanup boom');
        };
      });

      try {
        expect(() => destroyObjectSignals(host)).toThrow('cleanup boom');

        expect(
          bar.destroyed,
          'the signal behind the failing one must still be destroyed',
        ).toBe(true);
        expect(findObjectSignals(host)).toBeUndefined();
        assertSignalsCount(0, 'both signals of the host are gone');
      } finally {
        try {
          destroyObjectSignals(host);
        } catch {
          /* ignore */
        }
        try {
          destroySignal(bar);
        } catch {
          /* ignore */
        }
      }
    });

    it('a throwing cleanup does not spare the objects behind it', () => {
      const first: Record<string, unknown> = {};
      const second: Record<string, unknown> = {};
      const foo = createSignal(1);
      const bar = createSignal(2);
      storeAsObjectSignal(first, 'foo', foo);
      storeAsObjectSignal(second, 'bar', bar);

      createEffect(() => {
        foo.get();
        return () => {
          throw new Error('cleanup boom');
        };
      });

      try {
        expect(() => destroyObjectSignals(first, second)).toThrow(
          'cleanup boom',
        );

        expect(
          bar.destroyed,
          'the object behind the failing one must still be visited',
        ).toBe(true);
        expect(findObjectSignals(second)).toBeUndefined();
        assertSignalsCount(0, 'both hosts are swept');
      } finally {
        try {
          destroyObjectSignals(first, second);
        } catch {
          /* ignore */
        }
        try {
          destroySignal(bar);
        } catch {
          /* ignore */
        }
      }
    });

    it('two failing cleanups arrive as an AggregateError in teardown order', () => {
      const first: Record<string, unknown> = {};
      const second: Record<string, unknown> = {};
      const foo = createSignal(1);
      const bar = createSignal(2);
      storeAsObjectSignal(first, 'foo', foo);
      storeAsObjectSignal(second, 'bar', bar);

      createEffect(() => {
        foo.get();
        return () => {
          throw new Error('boom 1');
        };
      });
      createEffect(() => {
        bar.get();
        return () => {
          throw new Error('boom 2');
        };
      });

      try {
        let err: any;
        try {
          destroyObjectSignals(first, second);
        } catch (e) {
          err = e;
        }

        expect(err?.message).toBe(
          '[signalize] 2 errors while destroying the signals of an object',
        );
        expect(err).toBeInstanceOf(AggregateError);
        expect(err.errors.map((e: Error) => e.message)).toEqual([
          'boom 1',
          'boom 2',
        ]);
      } finally {
        try {
          destroyObjectSignals(first, second);
        } catch {
          /* ignore */
        }
        try {
          destroySignal(bar);
        } catch {
          /* ignore */
        }
      }
    });
  });
});
