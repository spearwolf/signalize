// Leaf module — it may import, **type-only**, `./Effect.js` and `./types.js`.
// Nothing else, and `./effects.js` or `./EffectImpl.js` least of all: those
// modules write this placeholder, so a value import back would close exactly
// the ring this module exists to open (ARCH-002). `Signal.ts` and
// `createSignal.ts` read it, `effects.ts` fills it on module evaluation.

import type {Effect} from './Effect.js';
import type {EffectCallback, SignalLike} from './types.js';

/**
 * The one shape of `createEffect` the signal layer needs: a callback plus a
 * positional list of signal dependencies (overload 3 of
 * `EffectImpl.createEffect`).
 *
 * @internal
 */
export type CreateEffectHook = (
  callback: EffectCallback,
  dependencies: SignalLike<any>[],
) => Effect;

let g_createEffect: CreateEffectHook | undefined;

/**
 * Register the effect factory for the signal layer.
 *
 * Called once, from the last line of `effects.ts`. That module is the only
 * one that knows `createEffect` without anybody having to import it for this
 * purpose, which is the whole point: `Signal.ts` and `createSignal.ts` reach
 * the effect subsystem without an import edge to it, so a consumer bundle
 * that never touches `onChange()` or `signalReader(callback)` leaves the
 * subsystem behind.
 *
 * @param hook - the effect factory, in the shape the signal layer calls it
 *
 * @internal
 */
export const setCreateEffectHook = (hook: CreateEffectHook): void => {
  g_createEffect = hook;
};

/**
 * The registered effect factory.
 *
 * Throws when the placeholder is still empty. The only way there is a
 * multi-module build in which `effects.js` was eliminated as a whole while a
 * caller of `Signal.onChange()` or of the deprecated `signalReader(callback)`
 * survived. The shipped `dist/` bundle cannot reach that state: the hook is
 * the single edge between the two halves, so a bundler that drops the
 * registration has proven that nothing reads it.
 *
 * No `reportSignalizeError()` here — the caller is application code with a
 * live stack, so throwing at it is the right answer.
 *
 * @returns the registered effect factory
 * @throws If `effects.js` was never evaluated
 *
 * @internal
 */
export const requireCreateEffect = (): CreateEffectHook => {
  if (g_createEffect === undefined) {
    throw new Error(
      '[signalize] effect subsystem not registered — Signal.onChange() and signalReader(callback) need it. Import "@spearwolf/signalize" through its entry point, so that effects.js is evaluated.',
    );
  }
  return g_createEffect;
};
