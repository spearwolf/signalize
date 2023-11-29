import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
import {beQuiet} from './bequiet.js';
import {createSignal, destroySignal} from './createSignal.js';
import {createEffect} from './effects-api.js';
import {touch} from './touch.js';

describe('beQuiet', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
  });

  it('if it is silent, there will be no signal when it is read (dynamic effects)', () => {
    const [a, setA] = createSignal(0);
    const [b, setB] = createSignal(0);
    const [c, setC] = createSignal(0);
    const [d, setD] = createSignal(0);

    const [runEffect, destroyEffect] = createEffect(() => {
      setB(a() + 1);
      beQuiet(() => {
        setD(c() + 1);
      });
    });

    setA(1);
    setC(4);

    expect(a()).toBe(1);
    expect(b()).toBe(2);
    expect(c()).toBe(4);
    expect(d()).toBe(1);

    runEffect(); // has no effect - no dependencies changed!

    expect(b()).toBe(2);
    expect(d()).toBe(1);

    touch(a);

    expect(b()).toBe(2);
    expect(d()).toBe(5);

    destroyEffect();
    destroySignal(a, b, c, d);
  });
});
