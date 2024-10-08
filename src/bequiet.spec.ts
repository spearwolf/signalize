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
    const {get: a, set: setA} = createSignal(0);
    const {get: b, set: setB} = createSignal(0);
    const {get: c, set: setC} = createSignal(0);
    const {get: d, set: setD} = createSignal(0);

    const effect = createEffect(() => {
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

    effect.run(); // has no effect - no dependencies changed!

    expect(b()).toBe(2);
    expect(d()).toBe(1);

    touch(a);

    expect(b()).toBe(2);
    expect(d()).toBe(5);

    effect.destroy();
    destroySignal(a, b, c, d);
  });
});
