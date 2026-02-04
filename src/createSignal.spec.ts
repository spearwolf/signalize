import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
import {
  createSignal,
  destroySignal,
  isSignal,
  muteSignal,
  unmuteSignal,
} from './createSignal.js';
import {createEffect} from './effects.js';
import {touch} from './touch.js';

describe('createSignal', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
  });

  it('works as expected', () => {
    const {get: num, set: setNum} = createSignal(1);
    const {get: str, set: setStr} = createSignal('foo');
    const {get: obj, set: setObj} = createSignal<object>();

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

    destroySignal(num, str, obj);
  });

  it('isSignal', () => {
    const {get: signal, set} = createSignal();
    expect(isSignal(signal)).toBe(true);
    expect(isSignal(set)).toBe(false);
    expect(isSignal(() => {})).toBe(false);
    destroySignal(signal);
  });

  it('signal reader has an optional effect callback as argument', () => {
    const {get: signal, set} = createSignal(666);
    const effect = jest.fn();

    signal(effect);

    expect(effect).not.toHaveBeenCalled();

    touch(signal);

    expect(effect).toHaveBeenCalledWith(666);

    set(1001);

    expect(effect).toHaveBeenCalledWith(1001);

    destroySignal(signal);
  });

  it('createSignal(otherSignal) should return otherSignal and NOT create a new signal', () => {
    const {get: signal, set} = createSignal(666);

    assertSignalsCount(1, 'createSignal(666)');

    const {get: otherSignal, set: setOther} = createSignal(signal);

    assertSignalsCount(1, 'createSignal(otherSignal)');

    expect(signal).toBe(otherSignal);
    expect(set).toBe(setOther);

    destroySignal(signal);
  });

  it('mute, unmute and unsubscribe', () => {
    const {get: sigFoo, set: setFoo} = createSignal(666);

    let foo = 0;

    const effect = createEffect(() => {
      foo = sigFoo();
    });

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

    destroySignal(sigFoo);
  });

  it('mute, unmute with signal reader callback effect', () => {
    const {get: sigFoo, set: setFoo} = createSignal(666);

    let foo = 0;

    sigFoo((val) => {
      foo = val;
    });

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
  });

  it('createSignal returns the new object-based signal api', () => {
    const foo = createSignal(666);
    const effect = jest.fn();

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

    foo.destroy();
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

    eff.destroy();
    foo.destroy();
  });

  it('dynamic depencenies', () => {
    const a = createSignal(true);
    const b = createSignal(1);
    const c = createSignal(20);

    let val = 0;
    let callCount = 0;

    createEffect(() => {
      ++callCount;
      if (a.get()) {
        val = b.get() + 1;
      } else {
        val = c.get() + 10;
      }
    });

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

    b.destroy();
  });
});
