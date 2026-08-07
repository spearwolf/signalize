import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
import {createSignal} from './createSignal.js';
import {
  destroyObjectSignals,
  findObjectSignalByName,
  findObjectSignalNames,
  findObjectSignals,
  storeAsObjectSignal,
} from './object-signals.js';
import {touch} from './touch.js';

describe('object signals', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
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

    const signals = findObjectSignals(host);

    expect(signals).toHaveLength(3);
    expect(signals[0]).toBe(foo);
    expect(signals[1]).toBe(bar);
    expect(signals[2]).toBe(xyz);

    // the names come from the same Map, symbol keys included
    expect(findObjectSignalNames(host)).toEqual(['foo', 'bar', sym]);

    destroyObjectSignals(host);
  });

  it('destroyObjectSignals() destroys the signals and drops the map', () => {
    const host: Record<string, unknown> = {};
    const foo = createSignal(1);
    const bar = createSignal('a');

    storeAsObjectSignal(host, 'foo', foo);
    storeAsObjectSignal(host, 'bar', bar);
    assertSignalsCount(2, 'after storeAsObjectSignal');

    destroyObjectSignals(host);

    assertSignalsCount(0, 'after destroyObjectSignals');
    expect(findObjectSignals(host)).toBeUndefined();
    expect(findObjectSignalNames(host)).toBeUndefined();
    expect(findObjectSignalByName(host, 'foo')).toBeUndefined();
  });

  it('destroyObjectSignals() ignores an unknown object and a second call', () => {
    // never seen by the WeakMap at all
    expect(() => destroyObjectSignals({neverStored: true})).not.toThrow();

    const host: Record<string, unknown> = {};
    storeAsObjectSignal(host, 'foo', createSignal(1));

    destroyObjectSignals(host);
    assertSignalsCount(0, 'after the first call');

    // the store survives in the WeakMap, only its map is gone — the second
    // call must fall through both guards instead of dereferencing undefined
    expect(() => destroyObjectSignals(host)).not.toThrow();
    assertSignalsCount(0, 'after the second call');
  });

  it('touch([obj, name]) notifies through the object store', () => {
    const host: Record<string, unknown> = {};
    const foo = createSignal(1);
    storeAsObjectSignal(host, 'foo', foo);

    const onChange = vi.fn();
    const unsubscribe = foo.onChange(onChange);

    touch([host, 'foo']);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(1);

    unsubscribe();
    destroyObjectSignals(host);
  });

  it('touch([obj, name]) is a no-op when no signal is stored under that name', () => {
    const host: Record<string, unknown> = {};
    const foo = createSignal(1);
    storeAsObjectSignal(host, 'foo', foo);

    const onChange = vi.fn();
    const unsubscribe = foo.onChange(onChange);

    // the name is not in the store …
    expect(() => touch([host, 'bar'])).not.toThrow();
    // … and this object has no store at all
    expect(() => touch([{other: 1}, 'other'])).not.toThrow();

    expect(onChange).not.toHaveBeenCalled();

    unsubscribe();
    destroyObjectSignals(host);
  });
});
