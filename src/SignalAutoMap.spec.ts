import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './assert-helpers.js';
import {isSignal} from './createSignal.js';
import {createEffect} from './effects.js';
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

  it('keys() iterator', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3}, ['a', 'b', 'c']);
    const keys = Array.from(sm.keys());
    expect(keys.length).toBe(3);
    expect(keys).toContain('a');
    expect(keys).toContain('b');
    expect(keys).toContain('c');
    sm.clear();
  });

  it('entries() iterator', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2});
    const entries = Array.from(sm.entries());
    expect(entries.length).toBe(2);
    const keysFromEntries = entries.map(([key]) => key);
    expect(keysFromEntries).toContain('a');
    expect(keysFromEntries).toContain('b');
    for (const [, signal] of entries) {
      expect(isSignal(signal)).toBeTruthy();
    }
    sm.clear();
  });

  it('symbol keys are supported', () => {
    const sm = new SignalAutoMap();
    const symA = Symbol('a');
    const symB = Symbol('b');

    expect(sm.has(symA)).toBe(false);
    const sigA = sm.get(symA);
    expect(sm.has(symA)).toBe(true);
    expect(isSignal(sigA)).toBeTruthy();

    sigA.value = 'hello';
    expect(sm.get(symA).value).toBe('hello');

    sm.get(symB).value = 42;
    expect(sm.get(symB).value).toBe(42);

    const keys = Array.from(sm.keys());
    expect(keys).toContain(symA);
    expect(keys).toContain(symB);

    sm.clear();
  });

  it('update() with empty Map does nothing', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2});
    sm.update(new Map());
    expect(sm.get('a').value).toBe(1);
    expect(sm.get('b').value).toBe(2);
    sm.clear();
  });

  it('updateFromProps() without explicit keys', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2});
    sm.updateFromProps({a: 10, b: 20, c: 30});
    expect(sm.get('a').value).toBe(10);
    expect(sm.get('b').value).toBe(20);
    expect(sm.get('c').value).toBe(30);
    sm.clear();
  });

  it('get() returns the same signal for the same key', () => {
    const sm = new SignalAutoMap();
    const sig1 = sm.get('foo');
    const sig2 = sm.get('foo');
    expect(sig1).toBe(sig2);
    sm.clear();
  });

  it('get() creates a new signal with undefined value for new key', () => {
    const sm = new SignalAutoMap();
    const sig = sm.get<number>('newKey');
    expect(isSignal(sig)).toBeTruthy();
    expect(sig.value).toBeUndefined();
    sm.clear();
  });

  it('signals are reactive with effects', () => {
    const sm = SignalAutoMap.fromProps({count: 0});
    let effectCallCount = 0;
    let lastValue: number | undefined;

    const effect = createEffect(() => {
      lastValue = sm.get<number>('count').get();
      effectCallCount++;
    });

    expect(effectCallCount).toBe(1);
    expect(lastValue).toBe(0);

    sm.get<number>('count').set(5);
    expect(effectCallCount).toBe(2);
    expect(lastValue).toBe(5);

    sm.update(new Map([['count', 10]]));
    expect(effectCallCount).toBe(3);
    expect(lastValue).toBe(10);

    effect.destroy();
    sm.clear();
  });

  it('update() batches signal updates', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3});
    let effectCallCount = 0;
    let lastValues: {a?: number; b?: number; c?: number} = {};

    const effect = createEffect(() => {
      lastValues = {
        a: sm.get<number>('a').get(),
        b: sm.get<number>('b').get(),
        c: sm.get<number>('c').get(),
      };
      effectCallCount++;
    });

    expect(effectCallCount).toBe(1);
    expect(lastValues).toEqual({a: 1, b: 2, c: 3});

    sm.update(
      new Map([
        ['a', 10],
        ['b', 20],
        ['c', 30],
      ]),
    );

    expect(effectCallCount).toBe(2);
    expect(lastValues).toEqual({a: 10, b: 20, c: 30});

    effect.destroy();
    sm.clear();
  });

  it('updateFromProps() batches signal updates', () => {
    const sm = SignalAutoMap.fromProps({x: 'a', y: 'b'});
    let effectCallCount = 0;

    const effect = createEffect(() => {
      sm.get<string>('x').get();
      sm.get<string>('y').get();
      effectCallCount++;
    });

    expect(effectCallCount).toBe(1);

    sm.updateFromProps({x: 'hello', y: 'world'});
    expect(effectCallCount).toBe(2);
    expect(sm.get('x').value).toBe('hello');
    expect(sm.get('y').value).toBe('world');

    effect.destroy();
    sm.clear();
  });

  it('clear() properly destroys all signals', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3});
    assertSignalsCount(3);

    sm.clear();
    assertSignalsCount(0);

    expect(sm.has('a')).toBe(false);
    expect(sm.has('b')).toBe(false);
    expect(sm.has('c')).toBe(false);
  });

  it('mixed string and symbol keys', () => {
    const sm = new SignalAutoMap();
    const symKey = Symbol('mySymbol');

    sm.get('stringKey').value = 'string value';
    sm.get(symKey).value = 'symbol value';

    expect(sm.get('stringKey').value).toBe('string value');
    expect(sm.get(symKey).value).toBe('symbol value');
    expect(sm.has('stringKey')).toBe(true);
    expect(sm.has(symKey)).toBe(true);

    const keys = Array.from(sm.keys());
    expect(keys.length).toBe(2);

    sm.clear();
  });

  it('fromProps() with empty object', () => {
    const sm = SignalAutoMap.fromProps({});
    const keys = Array.from(sm.keys());
    expect(keys.length).toBe(0);
    sm.clear();
  });

  it('fromProps() with empty keys array', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2}, []);
    const keys = Array.from(sm.keys());
    expect(keys.length).toBe(0);
    sm.clear();
  });
});
