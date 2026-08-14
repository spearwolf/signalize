import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {batch} from './batch.js';
import {createEffect} from './effects.js';
import {createSignal} from './index.js';
import {destroySignal} from './signal-core.js';

describe('Effect -> autorun: false', () => {
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

  it('if autorun is false then the effect is not executed by default', () => {
    let value = -1;

    const {get: signal, set: setValue} = createSignal(0);

    const effectCallback = vi.fn(() => {
      value = signal();
    });

    const effect = createEffect(effectCallback, {autorun: false});

    try {
      assertEffectsCount(1);

      expect(effectCallback).toHaveBeenCalledTimes(0);
      expect(value).toBe(-1);

      effect.run();

      expect(effectCallback).toHaveBeenCalledTimes(1);
      expect(value).toBe(0);

      setValue(1);

      expect(effectCallback).toHaveBeenCalledTimes(1);
      expect(value).toBe(0);

      effect.run();

      expect(effectCallback).toHaveBeenCalledTimes(2);
      expect(value).toBe(1);

      effect.destroy();

      setValue(2);

      expect(effectCallback).toHaveBeenCalledTimes(2);
      expect(value).toBe(1);
      expect(signal()).toBe(2);
    } finally {
      effect.destroy();
      destroySignal(signal);
    }
  });

  describe('an explicitly requested run inside a batch', () => {
    it('carries the requested run out when the batch closes, instead of dropping it', () => {
      const {get: signal, set: setValue} = createSignal(0);
      const seen: number[] = [];

      const effect = createEffect(
        () => {
          seen.push(signal());
        },
        {autorun: false},
      );

      try {
        effect.run(); // prime: this is what subscribes the effect to `signal`
        expect(seen).toEqual([0]);

        setValue(1); // marks it dirty; autorun is false, so nothing runs
        expect(seen).toEqual([0]);

        // No `expect()` inside the batch callback — an assertion that fails in
        // there can be replaced by the flush in `batch()`'s `finally`. The
        // observation is copied out and checked afterwards.
        let seenInsideTheBatch: number[] = [];
        batch(() => {
          effect.run();
          seenInsideTheBatch = [...seen];
        });

        expect(
          seenInsideTheBatch,
          'the run is deferred, like every other run inside a batch',
        ).toEqual([0]);
        expect(
          seen,
          'and it is actually carried out when the batch closes',
        ).toEqual([0, 1]);
      } finally {
        effect.destroy();
        destroySignal(signal);
      }
    });

    it('does not make the effect run on a later write of its own accord', () => {
      const {get: signal, set: setValue} = createSignal(0);
      const seen: number[] = [];

      const effect = createEffect(
        () => {
          seen.push(signal());
        },
        {autorun: false},
      );

      try {
        effect.run();
        setValue(1);

        batch(() => {
          effect.run();
        });

        expect(seen).toEqual([0, 1]);

        // The request is spent. If the effect kept the note it took when the
        // batch parked its run, this write would run it — and `{autorun:
        // false}` would quietly have become `true` for the rest of its life.
        setValue(2);
        expect(seen, 'the effect is still a non-autorun effect').toEqual([
          0, 1,
        ]);

        effect.run();
        expect(seen).toEqual([0, 1, 2]);
      } finally {
        effect.destroy();
        destroySignal(signal);
      }
    });

    it('a write inside the batch still does not run the effect on its own', () => {
      const {get: signal, set: setValue} = createSignal(0);
      const seen: number[] = [];

      const effect = createEffect(
        () => {
          seen.push(signal());
        },
        {autorun: false},
      );

      try {
        effect.run();
        expect(seen).toEqual([0]);

        batch(() => {
          setValue(1); // nobody asked for a run
        });

        expect(
          seen,
          'the flush marks it dirty and leaves it alone, batch or no batch',
        ).toEqual([0]);

        effect.run();
        expect(seen).toEqual([0, 1]);
      } finally {
        effect.destroy();
        destroySignal(signal);
      }
    });
  });
});
