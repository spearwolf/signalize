import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './create-signal.js';
import {EffectImpl} from './EffectImpl.js';
import {createEffect, onCreateEffect} from './effects.js';
import type {FailingEffect} from './types.js';

// `EffectImpl` declares `run`, `runImmediately` and `destroy` as prototype
// methods, and `childEffects` as a real `#`-field rather than a TS-erasable
// `private`.
//
// Z3 measures what stands between that declaration form and a caller: the
// `Effect` facade wraps those prototype methods in bound arrow properties,
// so a destructured `run` or `destroy` survives a detached call.
// `Signal#onChange()` hands such a destructured `destroy` back as its
// published unsubscribe contract — a facade that lost the binding would
// break that contract silently.
describe('EffectImpl: how its members are declared', () => {
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

  describe('Z3 — the Effect facade stays bound', () => {
    it('run() and destroy() on the facade still work when destructured off it', () => {
      const seen: number[] = [];
      const {run, destroy} = createEffect(
        () => {
          seen.push(1);
        },
        {autorun: false},
      );

      try {
        // Detached call — `run` is a bound arrow property on `Effect`, so
        // this must not throw "Cannot read properties of undefined".
        run();
        expect(seen).toEqual([1]);
      } finally {
        // Detached call, same reasoning.
        destroy();
      }
    });

    it("sig.onChange()'s returned unsubscribe function still unsubscribes when called detached", () => {
      const sig = createSignal(0);
      const seen: number[] = [];

      // `Signal#onChange()` destructures `destroy` out of the `Effect`
      // facade and hands it back as-is — already detached from any
      // receiver. That is the published contract this witness holds.
      const unsubscribe = sig.onChange((val) => {
        seen.push(val);
      });

      try {
        sig.set(1);
        expect(seen).toEqual([1]);

        unsubscribe();

        sig.set(2);
        expect(
          seen,
          'no further notification after the detached unsubscribe',
        ).toEqual([1]);
      } finally {
        sig.destroy();
      }
    });

    it('run, runImmediately and destroy remain own properties of the Effect facade', () => {
      const effect = createEffect(() => {}, {autorun: false});

      try {
        expect(Object.hasOwn(effect, 'run')).toBe(true);
        expect(Object.hasOwn(effect, 'runImmediately')).toBe(true);
        expect(Object.hasOwn(effect, 'destroy')).toBe(true);
      } finally {
        effect.destroy();
      }
    });
  });

  describe('Z1 — the enumerable side', () => {
    it('Object.keys() on the FailingEffect instance no longer lists childEffects', () => {
      let seen: FailingEffect | undefined;
      const unsubscribe = onCreateEffect((effect) => {
        seen = effect;
      });

      const handle = createEffect(() => {}, {autorun: false});

      try {
        expect(seen).toBeDefined();
        expect(Object.keys(seen!)).not.toContain('childEffects');
      } finally {
        unsubscribe();
        handle.destroy();
      }
    });
  });

  describe('Z2 — the writable side', () => {
    it('an outside write to childEffects no longer derails destroy()', () => {
      let seen: FailingEffect | undefined;
      const unsubscribe = onCreateEffect((effect) => {
        seen = effect;
      });

      try {
        const handle = createEffect(() => {}, {autorun: false});

        try {
          // `childEffects` is a `#`-field, invisible and unreachable from
          // here: this assignment lands on a harmless own property that
          // `destroy()` never looks at. As a plain (TS-erasable `private`)
          // instance property it would overwrite the real array with a
          // string, and the teardown would walk into it.
          (seen as any).childEffects = 'pwned';

          expect(() => handle.destroy()).not.toThrow();
        } finally {
          // Guarded no-op if the first call above already completed the
          // teardown; still needed if it threw partway through.
          handle.destroy();
        }
      } finally {
        unsubscribe();
      }
    });
  });

  describe('Z4 — the declaration form', () => {
    it('run, runImmediately and destroy sit on the prototype, not the instance', () => {
      let seen: FailingEffect | undefined;
      const unsubscribe = onCreateEffect((effect) => {
        seen = effect;
      });

      const handle = createEffect(() => {}, {autorun: false});

      try {
        expect(Object.hasOwn(seen!, 'run')).toBe(false);
        expect(Object.hasOwn(seen!, 'runImmediately')).toBe(false);
        expect(Object.hasOwn(seen!, 'destroy')).toBe(false);

        expect(Object.hasOwn(EffectImpl.prototype, 'run')).toBe(true);
        expect(Object.hasOwn(EffectImpl.prototype, 'runImmediately')).toBe(
          true,
        );
        expect(Object.hasOwn(EffectImpl.prototype, 'destroy')).toBe(true);

        // The full, spelled-out list — not a second derivation from the
        // class — so it also catches a new public instance field arriving
        // unnoticed in a `FailingEffect` handler's view.
        expect(Object.keys(seen!).sort()).toEqual([
          'autorun',
          'callback',
          'id',
          'priority',
          'shouldRun',
        ]);
      } finally {
        unsubscribe();
        handle.destroy();
      }
    });
  });
});
