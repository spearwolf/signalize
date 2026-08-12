import type {MockInstance} from 'vitest';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './create-signal.js';
import {createEffect} from './effects.js';
import {
  destroySignal,
  isSignal,
  muteSignal,
  unmuteSignal,
} from './signal-core.js';
import {touch} from './touch.js';
import {value} from './value.js';

describe('createSignal', () => {
  let warnSpy: MockInstance;

  beforeAll(() => {
    // Several legacy tests below exercise signalReader(callback), which now
    // emits a once-per-process deprecation warning. Silence it so the
    // unrelated test output stays clean.
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    warnSpy.mockRestore();
  });

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
    const {get: num, set: setNum} = createSignal(1);
    const {get: str, set: setStr} = createSignal('foo');
    const {get: obj, set: setObj} = createSignal<object>();

    try {
      expect(num()).toBe(1);
      expect(str()).toBe('foo');
      expect(obj()).toBeUndefined();

      setNum(666);
      setStr('bar');

      const myObj = {};
      setObj(myObj);

      expect(num()).toBe(666);
      expect(str()).toBe('bar');
      expect(obj()).toBe(myObj);
    } finally {
      destroySignal(num, str, obj);
    }
  });

  it('holds undefined until first written when created without an initial value (API-013)', () => {
    // The runtime half of API-013. The type half — `Signal<Type | undefined>`
    // for this call — cannot be witnessed here: this project compiles with
    // `strictNullChecks: false`, where `number | undefined` collapses back to
    // `number` and any directive would go unused. It is witnessed against the
    // shipped declarations instead, in `smoke/dist-smoke.test.ts`.
    const sig = createSignal<number>();

    try {
      expect(sig.value).toBeUndefined();
      expect(sig.get()).toBeUndefined();
      expect(value(sig.get)).toBeUndefined();

      sig.set(1);

      expect(sig.value).toBe(1);
      expect(sig.get()).toBe(1);
      expect(value(sig.get)).toBe(1);
    } finally {
      destroySignal(sig);
    }
  });

  it('isSignal', () => {
    const {get: signal, set} = createSignal();
    try {
      expect(isSignal(signal)).toBe(true);
      expect(isSignal(set)).toBe(false);
      expect(isSignal(() => {})).toBe(false);
    } finally {
      destroySignal(signal);
    }
  });

  it('isSignal rejects fake signals with generic Symbol.for keys (BUG-006)', () => {
    // A fake object using the old unnamespaced Symbol.for keys should not pass isSignal
    const fakeSignal = {
      [Symbol.for('signal')]: {id: Symbol('fake')},
    };
    expect(isSignal(fakeSignal)).toBe(false);
  });

  it('signal reader has an optional effect callback as argument', () => {
    const {get: signal, set} = createSignal(666);
    const effect = vi.fn();

    try {
      signal(effect);

      expect(effect).not.toHaveBeenCalled();

      touch(signal);

      expect(effect).toHaveBeenCalledWith(666);

      set(1001);

      expect(effect).toHaveBeenCalledWith(1001);
    } finally {
      destroySignal(signal);
    }
  });

  it('createSignal(otherSignal) should return otherSignal and NOT create a new signal', () => {
    const {get: signal, set} = createSignal(666);

    try {
      assertSignalsCount(1, 'createSignal(666)');

      const {get: otherSignal, set: setOther} = createSignal(signal);

      assertSignalsCount(1, 'createSignal(otherSignal)');

      expect(signal).toBe(otherSignal);
      expect(set).toBe(setOther);
    } finally {
      destroySignal(signal);
    }
  });

  it('mute, unmute and unsubscribe', () => {
    const {get: sigFoo, set: setFoo} = createSignal(666);

    let foo = 0;

    const effect = createEffect(() => {
      foo = sigFoo();
    });

    try {
      expect(foo).toBe(666);

      setFoo(23);

      expect(foo).toBe(23);

      muteSignal(sigFoo);
      setFoo(44);

      expect(foo).toBe(23);

      unmuteSignal(sigFoo);

      expect(foo).toBe(23);

      setFoo(111);

      expect(foo).toBe(111);

      effect.destroy();
      setFoo(222);

      expect(foo).toBe(111);
    } finally {
      effect.destroy();
      destroySignal(sigFoo);
    }
  });

  it('set(_, {touch: true}) does NOT emit when signal is muted', () => {
    const sig = createSignal(1);
    const effect = vi.fn();

    sig.onChange(effect);

    try {
      expect(effect).not.toHaveBeenCalled();

      // baseline: touch on an unmuted signal triggers the effect
      sig.set(1, {touch: true});
      expect(effect).toHaveBeenCalledTimes(1);

      // mute then touch with same value → no emit
      muteSignal(sig);
      sig.set(1, {touch: true});
      expect(effect).toHaveBeenCalledTimes(1);

      // mute then touch with different value → still no emit (writer stores new value, but mute blocks notification)
      sig.set(2, {touch: true});
      expect(effect).toHaveBeenCalledTimes(1);
      expect(sig.value).toBe(2);

      // unmute restores normal notification
      unmuteSignal(sig);
      sig.set(2, {touch: true});
      expect(effect).toHaveBeenCalledTimes(2);
    } finally {
      destroySignal(sig);
    }
  });

  it('set(_, {touch: true}) does NOT emit when signal is destroyed', () => {
    const sig = createSignal(1);
    const effect = vi.fn();

    sig.onChange(effect);

    try {
      sig.set(1, {touch: true});
      expect(effect).toHaveBeenCalledTimes(1);

      destroySignal(sig);

      // touch on destroyed signal must not emit
      sig.set(1, {touch: true});
      expect(effect).toHaveBeenCalledTimes(1);

      sig.set(99, {touch: true});
      expect(effect).toHaveBeenCalledTimes(1);
    } finally {
      destroySignal(sig);
    }
  });

  it('mute, unmute with signal reader callback effect', () => {
    const {get: sigFoo, set: setFoo} = createSignal(666);

    let foo = 0;

    sigFoo((val) => {
      foo = val;
    });

    try {
      expect(foo).toBe(0);

      setFoo(23);

      expect(foo).toBe(23);

      muteSignal(sigFoo);
      setFoo(44);

      expect(foo).toBe(23);

      unmuteSignal(sigFoo);

      expect(foo).toBe(23);

      setFoo(111);

      expect(foo).toBe(111);

      destroySignal(sigFoo);
      setFoo(222);

      expect(foo).toBe(111);
    } finally {
      destroySignal(sigFoo);
    }
  });

  it('createSignal returns the new object-based signal api', () => {
    const foo = createSignal(666);
    const effect = vi.fn();

    try {
      expect(foo.value).toBe(666);
      expect(foo.get()).toBe(666);
      expect(isSignal(foo)).toBe(true);

      const {get: sigRead, set: sigWrite} = foo;
      expect(sigRead).toBe(foo.get);
      expect(sigWrite).toBe(foo.set);

      foo.onChange(effect);

      expect(effect).not.toHaveBeenCalled();

      foo.touch();

      expect(effect).toHaveBeenCalledWith(666);

      foo.set(1001);

      expect(effect).toHaveBeenCalledWith(1001);
    } finally {
      foo.destroy();
    }
  });

  it('onChange tolerates a callback that returns a non-function value', () => {
    const sig = createSignal(1);

    // onChange passes whatever the callback returns on as the effect's
    // cleanup — and its signature allows `any`. A returned value that is not
    // a function counts as "no cleanup"; it used to be stored and then called
    // on the *second* change, throwing `cleanupCallback is not a function`.
    const seen: number[] = [];
    const unsubscribe = sig.onChange((val) => {
      seen.push(val);
      return val * 2;
    });

    try {
      sig.set(2);
      expect(seen).toEqual([2]);

      sig.set(3);
      expect(seen).toEqual([2, 3]);
    } finally {
      unsubscribe();
      destroySignal(sig);
    }
  });

  it('.value property read doesnt trigger dependencies, but write should do', () => {
    const foo = createSignal(1);

    let bar = 0;
    let plah = 0;

    foo.onChange((val) => {
      bar = val;
    });

    const eff = createEffect(() => {
      plah = foo.value; // Accessing .value should not trigger the effect
    });

    try {
      expect(foo.value).toBe(1);
      expect(bar).toBe(0);
      expect(plah).toBe(1);

      foo.value = 2;

      expect(foo.value).toBe(2);
      expect(bar).toBe(2);
      expect(plah).toBe(1);

      foo.set(3);

      expect(foo.value).toBe(3);
      expect(bar).toBe(3);
      expect(plah).toBe(1);
    } finally {
      eff.destroy();
      foo.destroy();
    }
  });

  it('dynamic depencenies', () => {
    const a = createSignal(true);
    const b = createSignal(1);
    const c = createSignal(20);

    let val = 0;
    let callCount = 0;

    const effect = createEffect(() => {
      ++callCount;
      if (a.get()) {
        val = b.get() + 1;
      } else {
        val = c.get() + 10;
      }
    });

    try {
      expect(a.get()).toBe(true);
      expect(val).toBe(2);
      expect(callCount).toBe(1);

      b.set(2);

      expect(val).toBe(3);
      expect(callCount).toBe(2);

      a.set(false);

      expect(val).toBe(30);
      expect(callCount).toBe(3);

      b.set(5);

      expect(callCount).toBe(3);

      a.destroy();
      c.destroy();

      assertEffectsCount(0, 'after [a,c].destroy()');
    } finally {
      effect.destroy();
      destroySignal(a, b, c);
    }
  });
});
