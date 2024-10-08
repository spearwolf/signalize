import {once} from '@spearwolf/eventize';
import {$effect} from './constants.js';
import {EffectImpl} from './EffectImpl.js';

export class Effect {
  [$effect]?: EffectImpl;

  constructor(effect: EffectImpl) {
    this[$effect] = effect;

    once(effect, EffectImpl.Destroy, () => {
      this[$effect] = undefined;
    });
  }

  run = () => this[$effect]?.run();

  destroy = () => {
    this[$effect]?.destroy();
    this[$effect] = undefined;
  };
}
