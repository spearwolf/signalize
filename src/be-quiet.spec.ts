import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {beQuiet, isQuiet} from './be-quiet.js';
import {createSignal} from './create-signal.js';
import {createEffect} from './effects.js';
import {destroySignal} from './signal-core.js';
import {touch} from './touch.js';

describe('beQuiet', () => {
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

    try {
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
    } finally {
      effect.destroy();
      destroySignal(a, b, c, d);
    }
  });

  it('returns what the action returns, so an untracked peek is usable', () => {
    const {get: a, set: setA} = createSignal(0);
    const {get: b, set: setB} = createSignal(23);

    let runs = 0;

    const effect = createEffect(() => {
      a();
      runs++;
    });

    try {
      const peek = beQuiet(() => b());

      expect(peek).toBe(23);
      expect(isQuiet()).toBe(false);

      runs = 0;
      setB(42);
      expect(runs, 'the quiet read stayed untracked').toBe(0);

      setA(1);
      expect(runs).toBe(1);
    } finally {
      effect.destroy();
      destroySignal(a, b);
    }
  });

  it('closes the quiet frame when the action throws, so the next write is loud again', () => {
    // The counter behind `beQuiet()` is module state, so a frame that is
    // not closed on the way out is not a local mistake: every later write
    // in the process stays muted and every effect stays deaf. Drop the
    // `finally` in `src/be-quiet.ts` and this test is the only one that
    // notices.
    const {get: a, set: setA} = createSignal(0);

    let runs = 0;

    const effect = createEffect(() => {
      a();
      runs++;
    });

    try {
      expect(() =>
        beQuiet(() => {
          throw new Error('boom');
        }),
      ).toThrow('boom');

      expect(isQuiet(), 'the quiet frame closed on the way out').toBe(false);

      runs = 0;
      setA(1);

      expect(runs, 'the effect still hears a write after the throw').toBe(1);
    } finally {
      effect.destroy();
      destroySignal(a);
    }
  });

  describe('rejects thenable-returning actions', () => {
    it('throws when the action is an async function, instead of silently letting reads track again', async () => {
      let caught: unknown;
      try {
        // @ts-expect-error — async action is rejected at the type level too; calling it anyway to exercise the runtime guard
        beQuiet(async () => {
          await Promise.resolve();
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(TypeError);
      expect((caught as TypeError).message).toContain('[signalize] beQuiet:');

      // the quiet frame is closed before the TypeError reaches the caller
      expect(isQuiet()).toBe(false);

      // let the orphaned promise settle, as batch.spec.ts does
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('throws for a synchronous action that happens to return a thenable-shaped object', () => {
      let caught: unknown;
      try {
        // biome-ignore lint/suspicious/noThenProperty: intentionally building a non-promise thenable to prove the runtime duck-type check catches it too
        beQuiet(() => ({then: () => {}}));
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(TypeError);
      expect(isQuiet()).toBe(false);
    });

    it('leaves an enclosing quiet frame open when a nested action is refused', () => {
      let insideAfterThrow: boolean;

      beQuiet(() => {
        try {
          // biome-ignore lint/suspicious/noThenProperty: as above
          beQuiet(() => ({then: () => {}}));
        } catch {
          // the nested frame closed, the enclosing one did not
        }
        insideAfterThrow = isQuiet();
      });

      expect(insideAfterThrow, 'the outer frame survives').toBe(true);
      expect(isQuiet(), 'and closes normally').toBe(false);
    });
  });
});
