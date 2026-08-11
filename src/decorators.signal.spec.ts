import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {signal} from './decorators.js';
import {
  createEffect,
  createMemo,
  createSignal,
  destroyObjectSignals,
  destroySignal,
  type Effect,
  findObjectSignalByName,
  findObjectSignalNames,
  type Signal,
  SignalGroup,
  type SignalReader,
  value,
} from './index.js';

describe('@signal is a class accessor decorator', () => {
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

  it('works as expected', () => {
    class Foo {
      @signal() accessor foo = 1;
    }

    const foo = new Foo();

    let computedFoo: SignalReader<number>;

    try {
      expect(foo.foo).toBe(1);
      assertSignalsCount(1, 'after new Foo');

      const fooSignal = findObjectSignalByName(foo, 'foo');

      expect(fooSignal).toBeDefined();
      expect(value(fooSignal)).toBe(1);
      expect(value([foo, 'foo'])).toBe(1);

      computedFoo = createMemo(() => foo.foo + 100);

      foo.foo = 2;

      expect(foo.foo).toBe(2);
      expect(value(fooSignal)).toBe(2);
      expect(computedFoo()).toBe(102);
      assertSignalsCount(2, 'after createMemo()');
    } finally {
      destroyObjectSignals(foo);
      destroySignal(computedFoo);
    }
  });

  it('signal with custom comparator', () => {
    const equals = (a: number, b: number) =>
      b != null && (a === b || a === b + 1);

    class Foo {
      @signal({compare: equals}) accessor foo = 1;
    }

    const foo = new Foo();
    const bar = createMemo(() => foo.foo + 100, {lazy: true});

    try {
      expect(foo.foo).toBe(1);
      expect(bar()).toBe(101);

      foo.foo = 2;

      expect(foo.foo).toBe(1);
      expect(bar()).toBe(101);

      foo.foo = 4;

      expect(foo.foo).toBe(4);
      expect(bar()).toBe(104);
    } finally {
      destroyObjectSignals(foo);
      destroySignal(bar);
    }
  });

  it('each object has its on signal instance', () => {
    class Foo {
      @signal() accessor foo = 1;
    }

    const foo = new Foo();

    let foo2: Foo;

    try {
      expect(foo.foo).toBe(1);
      assertSignalsCount(1, 'after new Foo');

      foo2 = new Foo();
      expect(foo2.foo).toBe(1);
      assertSignalsCount(2, 'after new Foo (2)');

      const fooSignal = findObjectSignalByName(foo, 'foo');
      const foo2Signal = findObjectSignalByName(foo2, 'foo');

      expect(fooSignal).toBeDefined();
      expect(foo2Signal).toBeDefined();
      expect(fooSignal).not.toBe(foo2Signal);

      const onFoo = vi.fn();
      const onFoo2 = vi.fn();

      fooSignal.onChange(onFoo);
      foo2Signal.onChange(onFoo2);

      foo.foo = 123;
      expect(onFoo).toHaveBeenCalledTimes(1);
      expect(onFoo2).not.toHaveBeenCalled();

      foo2.foo = 456;
      expect(onFoo2).toHaveBeenCalledTimes(1);

      expect(foo.foo).toBe(123);
      expect(foo2.foo).toBe(456);
    } finally {
      destroyObjectSignals(foo, foo2);
    }
  });

  it('get the signals from the object using the group', () => {
    class Foo {
      @signal() accessor foo = 1;
      @signal({name: 'plah'}) accessor bar = 23;
      @signal() accessor xyz = 'abc';
    }

    const foo = new Foo();

    try {
      assertSignalsCount(3, 'after new Foo');

      foo.foo = 666;

      expect(foo.foo).toBe(666);

      const group = SignalGroup.get(foo);

      expect(group.signal('foo').value).toBe(666);

      foo.bar = 42;

      expect(foo.bar).toBe(42);
      expect(group.signal('plah').value).toBe(42);

      foo.xyz = 'hello';

      expect(foo.xyz).toBe('hello');
      expect(group.signal('xyz').value).toBe('hello');

      expect(findObjectSignalNames(foo).sort()).toEqual(
        ['foo', 'plah', 'xyz'].sort(),
      );
    } finally {
      SignalGroup.get(foo)?.clear();
    }
  });

  it('readAsValue: true makes the property getter an untracked read', () => {
    class Foo {
      @signal({readAsValue: true}) accessor foo = 1;
    }

    const foo = new Foo();

    let tick: Signal<number>;
    let eff: Effect;

    try {
      expect(foo.foo).toBe(1);
      assertSignalsCount(1, 'after new Foo');

      tick = createSignal(0);
      const runs: number[] = [];

      eff = createEffect(() => {
        tick.get();
        runs.push(foo.foo);
      });

      expect(runs).toEqual([1]);

      // the write notifies the property's own signal, but the effect never
      // subscribed to it — with the default (tracking) getter it would rerun
      foo.foo = 2;
      expect(foo.foo).toBe(2);
      expect(runs).toEqual([1]);

      // a tracked dependency does rerun it, and the untracked read then shows
      // the value that was written in between
      tick.set(1);
      expect(runs).toEqual([1, 2]);
    } finally {
      eff?.destroy();
      destroyObjectSignals(foo);
      destroySignal(tick);
    }
  });

  it('carries a function-valued accessor and a freely chosen name (TYPE-004)', () => {
    // The two behaviours the five casts used to cover up: a function-valued
    // accessor goes through the *value* overload of `SignalWriter` and is
    // stored, not called; a freely chosen name is a name, not a property of
    // the class. This is a behaviour test, not a regression guard for the
    // casts themselves — put them back and it stays green, because they never
    // changed what runs. TYPE-004 has no type witness to write: the lie sat
    // in the body, never in a shipped signature (`lib/decorators.d.ts` is
    // unchanged by the fix).
    class Foo {
      @signal() accessor cb: () => number = () => 1;
      @signal({name: 'renamed'}) accessor other = 'x';
    }

    const foo = new Foo();
    let eff: Effect;

    try {
      const seen: number[] = [];

      eff = createEffect(() => {
        seen.push(foo.cb());
      });

      expect(seen).toEqual([1]);

      foo.cb = () => 2;

      // The accessor stored the new function as a value — it was not called
      // as a factory — and the effect saw the change.
      expect(seen).toEqual([1, 2]);
      expect(foo.cb()).toBe(2);

      // The renamed one lives under its free name, not under `other`:
      expect(findObjectSignalNames(foo).sort()).toEqual(['cb', 'renamed']);
      expect(SignalGroup.get(foo).signal('renamed').value).toBe('x');

      foo.other = 'y';
      expect(foo.other).toBe('y');
    } finally {
      eff?.destroy();
      destroyObjectSignals(foo);
      SignalGroup.get(foo)?.clear();
    }
  });

  it('the property getter returns undefined once the object signals are destroyed', () => {
    class Foo {
      @signal() accessor foo = 1;
    }

    const foo = new Foo();
    try {
      expect(foo.foo).toBe(1);

      destroyObjectSignals(foo);

      // the store is empty, so the accessor has nothing left to read from
      expect(foo.foo).toBeUndefined();

      // and the setter falls through its optional chain instead of throwing
      expect(() => {
        foo.foo = 42;
      }).not.toThrow();
      expect(foo.foo).toBeUndefined();
    } finally {
      destroyObjectSignals(foo);
    }
  });
});
