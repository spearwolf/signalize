import {once} from '@spearwolf/eventize';
import {$effect} from './constants.js';
import {Effect} from './Effect.js';

export class EffectObject {
  [$effect]?: Effect;

  constructor(effect: Effect) {
    this[$effect] = effect;

    once(effect, Effect.Destroy, () => {
      this[$effect] = undefined;
    });
  }

  run = () => this[$effect]?.run();

  destroy = () => {
    this[$effect]?.destroy();
    this[$effect] = undefined;
  };
}
