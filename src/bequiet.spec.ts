import {assertEffectsCount, assertSignalsCount} from './assert-helpers.js';
import {beQuiet, isQuiet} from './bequiet.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {destroySignal} from './signal-core.js';
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

  it('returns what the action returns, so an untracked peek is usable (BUG-010)', () => {
    const {get: a, set: setA} = createSignal(0);
    const {get: b, set: setB} = createSignal(23);

    let runs = 0;

    const effect = createEffect(() => {
      a();
      runs++;
    });

    const peek = beQuiet(() => b());

    expect(peek).toBe(23);
    expect(isQuiet()).toBe(false);

    runs = 0;
    setB(42);
    expect(runs, 'the quiet read stayed untracked').toBe(0);

    setA(1);
    expect(runs).toBe(1);

    effect.destroy();
    destroySignal(a, b);
  });
});
