import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './assert-helpers.js';
import {isSignal} from './createSignal.js';
import {SignalAutoMap} from './SignalAutoMap.js';

describe('SignalAutoMap', () => {
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

  it('get(), has() and clear()', () => {
    const sm = new SignalAutoMap();
    expect(sm.has('a')).toBe(false);
    expect(sm.get('a')).not.toBeUndefined();
    expect(sm.has('a')).toBe(true);
    sm.clear();
  });

  it('fromProps()', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3, d: undefined}, [
      'a',
      'b',
      'd',
    ]);
    expect(sm.get('a').value).toBe(1);
    expect(sm.get('b').value).toBe(2);
    expect(sm.has('c')).toBe(false);
    expect(sm.has('d')).toBe(true);
    sm.clear();
  });

  it('fromProps() without explicit keys', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3, d: undefined});
    expect(sm.get('a').value).toBe(1);
    expect(sm.get('b').value).toBe(2);
    expect(sm.has('c')).toBe(true);
    expect(sm.has('d')).toBe(true);
    sm.clear();
  });

  it('update()', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3}, ['a', 'b']);
    sm.update(new Map(Object.entries({a: 4, b: 5, c: 6})));
    expect(sm.get('a').value).toBe(4);
    expect(sm.get('b').value).toBe(5);
    expect(sm.get('c').value).toBe(6);
    sm.clear();
  });

  it('updateFromProps()', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3, d: undefined}, [
      'a',
      'b',
      'd',
    ]);
    sm.updateFromProps({a: 4, b: 5, c: 6, e: undefined, f: 7}, [
      'a',
      'c',
      'e',
      'f',
    ]);
    expect(sm.get('a').value).toBe(4);
    expect(sm.get('b').value).toBe(2);
    expect(sm.get('c').value).toBe(6);
    expect(sm.has('d')).toBeTruthy();
    expect(sm.has('e')).toBeTruthy();
    expect(sm.has('f')).toBeTruthy();
    sm.clear();
  });

  it('updateFromProps() from prototype chain', () => {
    const Base = class {
      a = 1;
      b = 2;
      c = 3;
    };
    const Derived = new (class extends Base {
      d = 4;
    })();
    const sm = SignalAutoMap.fromProps(Derived, ['a', 'd']);
    expect(sm.get('a').value).toBe(1);
    expect(sm.get('d').value).toBe(4);
    sm.clear();
  });

  it('signals() iterator', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3}, ['a', 'b']);
    const signals = Array.from(sm.signals());
    expect(signals.length).toBe(2);
    expect(isSignal(signals[0])).toBeTruthy();
    expect(isSignal(signals[1])).toBeTruthy();
    sm.clear();
  });
});
