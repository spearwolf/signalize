/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */

import {$signal} from './constants.js';
import {destroySignal} from './createSignal.js';
import {createEffect} from './effects-api.js';
import {touch} from './touch.js';
import type {
  DestroyEffectCallback,
  Signal,
  SignalFuncs,
  SignalLike,
  SignalReader,
  SignalWriter,
} from './types.js';
import {value} from './value.js';

export interface SignalObject<Type> extends SignalFuncs<Type> {}

export class SignalObject<Type = unknown> implements SignalLike<Type> {
  readonly [$signal]: Signal<Type>;

  constructor(sig: Signal<Type>) {
    this[$signal] = sig;
  }

  get get(): SignalReader<Type> {
    return this[$signal].reader;
  }

  get set(): SignalWriter<Type> {
    return this[$signal].writer;
  }

  *[Symbol.iterator]() {
    yield this.get;
    yield this.set;
  }

  get value(): Type {
    return value(this.get);
  }

  set value(val: Type) {
    this.set(val);
  }

  onChange(action: (val: Type) => any): DestroyEffectCallback {
    const {destroy} = createEffect(() => {
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

  touch() {
    touch(this);
  }

  destroy() {
    destroySignal(this);
  }
}
