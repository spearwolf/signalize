import {$signal} from './constants.js';
import {requireCreateEffect} from './effect-hook.js';
import {destroySignal} from './signal-core.js';
import {touch} from './touch.js';
import type {
  ISignalImpl,
  SignalLike,
  SignalReader,
  SignalWriter,
  VoidFunc,
} from './types.js';
import {value} from './value.js';

export class Signal<ValueType> implements SignalLike<ValueType> {
  readonly [$signal]: ISignalImpl<ValueType>;

  constructor(sig: ISignalImpl<ValueType>) {
    this[$signal] = sig;
  }

  get get(): SignalReader<ValueType> {
    return this[$signal].reader;
  }

  get set(): SignalWriter<ValueType> {
    return this[$signal].writer;
  }

  get value(): ValueType {
    return value(this.get);
  }

  set value(val: ValueType) {
    this.set(val);
  }

  onChange(action: (val: ValueType) => any): VoidFunc {
    const {destroy} = requireCreateEffect()(() => {
      return action(this.value);
    }, [this.get]);
    return destroy;
  }

  get muted(): boolean {
    return this[$signal].muted;
  }

  set muted(mute: boolean) {
    this[$signal].muted = mute;
  }

  /**
   * Whether this signal has been destroyed.
   *
   * A destroyed signal stays usable as a plain value container — `set()`
   * stores, reads return — it just no longer notifies. There is no way
   * back; see `destroySignal()`.
   */
  get destroyed(): boolean {
    return this[$signal].destroyed;
  }

  touch() {
    touch(this);
  }

  destroy() {
    destroySignal(this);
  }
}
