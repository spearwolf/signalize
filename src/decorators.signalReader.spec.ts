import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
import {signal, signalReader} from './decorators.js';
import {SignalReader, destroySignals, getObjectSignalKeys} from './index.js';

describe('@signalReader is a class accessor decorator', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
  });

  it('works as expected', () => {
    class Foo {
      @signal() accessor foo = 1;
      @signalReader({name: 'foo'}) accessor foo$: SignalReader<number>;

      @signal({name: 'plah'}) accessor bar = 23;
      @signalReader({name: 'plah'}) accessor bar$: SignalReader<number>;

      @signal() accessor xyz = 'abc';
      @signalReader() accessor xyz$: SignalReader<string>;
    }

    const foo = new Foo();

    assertSignalsCount(3, 'after new Foo');

    foo.foo = 666;

    expect(foo.foo).toBe(666);
    expect(foo.foo$()).toBe(666);

    foo.bar = 42;

    expect(foo.bar).toBe(42);
    expect(foo.bar$()).toBe(42);

    foo.xyz = 'hello';

    expect(foo.xyz).toBe('hello');
    expect(foo.xyz$()).toBe('hello');

    expect(getObjectSignalKeys(foo).sort()).toEqual(
      ['foo', 'plah', 'xyz'].sort(),
    );

    destroySignals(foo);
  });
});
