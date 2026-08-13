import {once} from '@spearwolf/eventize';
import {$effect, DESTROY} from './constants.js';
import type {EffectImpl} from './EffectImpl.js';
import type {VoidFunc} from './types.js';

const noop = () => {};

export class Effect {
  [$effect]?: EffectImpl;

  constructor(effect: EffectImpl) {
    this[$effect] = effect;

    once(effect, DESTROY, () => {
      this[$effect] = undefined;
    });
  }

  run = () => this[$effect]?.run();

  /**
   * Run the effect callback now, even while a batch is open.
   *
   * @internal Used by `createMemo()` as the memo signal's `beforeRead`
   * hook. Stripped from the published `.d.ts` by `stripInternal`.
   */
  runImmediately = () => this[$effect]?.runImmediately();

  /**
   * Whether this effect has been destroyed.
   *
   * True as soon as the effect is gone — through `destroy()` on this
   * wrapper, through its group, or because an `onCreateEffect()` handler
   * destroyed it before `createEffect()` even handed the wrapper out. A
   * destroyed effect no longer reacts and `run()` is a no-op.
   *
   * That handler is the only route to the second case: a first run that
   * throws also destroys the effect, but it rethrows out of
   * `createEffect()` — with `{attach}` as without — so the caller gets the
   * error instead of a wrapper and has nothing to ask (measured).
   */
  get destroyed(): boolean {
    const effect = this[$effect];
    return effect == null || effect.destroyed;
  }

  destroy = () => {
    this[$effect]?.destroy();
    this[$effect] = undefined;
  };

  /**
   * Subscribe to this effect's destruction.
   *
   * Handles the edge case a plain `once(effect, DESTROY, cb)` on the wrapped
   * instance cannot: the effect may already be destroyed by the time this is
   * called — an `onCreateEffect()` handler destroyed it before
   * `createEffect()` even returned this wrapper (the first run destroying
   * itself does not reach here: it throws out of `createEffect()` instead).
   * `DESTROY` was already emitted then, so a fresh subscription would never
   * fire and the caller's cleanup would silently never happen. Here, an
   * already-destroyed effect (or one whose wrapper reference is already
   * gone) runs `callback` immediately instead.
   *
   * Returns an unsubscribe function, like every other subscribe in this
   * library. In the already-destroyed case the callback has run before this
   * method returns, so there is nothing left to cancel and the returned
   * function is a no-op.
   *
   * @internal Used by `createMemo()` to bind a memo signal to the lifetime of
   * the effect that created it. Not part of the public API surface: unlike
   * `run`, `runImmediately` and `destroy` on this class, it is a prototype
   * method rather than a bound property. That is not an inconsistency to
   * settle — the other three are deliberately bound, because callers detach
   * them: `Signal#onChange()` returns `destroy` as a standalone unsubscribe
   * function, and `createMemo()` passes `runImmediately` and `destroy` on to
   * event queues the same way. Nobody detaches `onDestroy()`, so a plain
   * prototype method costs it nothing.
   */
  onDestroy(callback: VoidFunc): () => void {
    const effect = this[$effect];
    if (effect == null || effect.destroyed) {
      callback();
      return noop;
    }
    return once(effect, DESTROY, callback);
  }
}
