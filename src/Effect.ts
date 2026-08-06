import {once} from '@spearwolf/eventize';
import {$effect, DESTROY} from './constants.js';
import {EffectImpl} from './EffectImpl.js';
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

  destroy = () => {
    this[$effect]?.destroy();
    this[$effect] = undefined;
  };

  /**
   * Subscribe to this effect's destruction.
   *
   * Handles the edge case a plain `once(effect, DESTROY, cb)` on the wrapped
   * instance cannot: the effect may already be destroyed by the time this is
   * called — e.g. an `onCreateEffect()` handler, or the effect's own first
   * run, destroyed it before `createEffect()` even returned this wrapper.
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
   * `run` and `destroy` on this class it is a prototype method, not a bound
   * property, and that inconsistency should be settled before it becomes a
   * promise.
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
