import {emit, off, on, once, retain, retainClear} from '@spearwolf/eventize';
import {signalImpl} from './createSignal.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import {ISignalImpl, SignalLike} from './types.js';

export type ValueCallback<ValueType = any> = (value: ValueType) => void;

export abstract class SignalLink<ValueType = any> {
  static Value = 'value';
  static Mute = 'mute';
  static Unmute = 'unmute';
  static Destroy = 'destroy';

  #muted = false;
  #unsubscribe?: () => void;

  readonly source: ISignalImpl<ValueType>;

  isDestroyed = false;

  constructor(source: SignalLike<ValueType>) {
    retain(this, SignalLink.Value);

    this.source = signalImpl(source);

    this.#unsubscribe = on(globalSignalQueue, this.source.id, (_, params) => {
      if (!this.#muted && !this.isDestroyed) {
        if (params?.touch === true) {
          this.touch();
        } else {
          this.write();
        }
      }
    });

    once(globalDestroySignalQueue, this.source.id, () => this.destroy());
  }

  nextValue(): Promise<ValueType> {
    return new Promise((resolve, reject) => {
      // we can not just use 'once' here because the value is retained
      let valEmitCount = 0;
      const unsubscribe = [
        on(this, SignalLink.Value, (val) => {
          if (valEmitCount === 1) {
            unsubscribe.forEach((unsub) => {
              unsub();
            });
            resolve(val);
          } else {
            ++valEmitCount;
          }
        }),
        once(this, SignalLink.Destroy, () => {
          unsubscribe.forEach((unsub) => {
            unsub();
          });
          reject();
        }),
      ];
    });
  }

  destroy() {
    if (this.isDestroyed) return;

    this.#unsubscribe?.();
    this.#unsubscribe = undefined;

    emit(this, SignalLink.Destroy, this);
    retainClear(this, SignalLink.Value);
    off(this);

    this.isDestroyed = true;

    Object.freeze(this);
  }

  mute(): this {
    if (!this.isDestroyed && !this.#muted) {
      this.#muted = true;
      emit(this, SignalLink.Mute, this);
    }
    return this;
  }

  unmute(): this {
    if (!this.isDestroyed && this.#muted) {
      this.#muted = false;
      emit(this, SignalLink.Unmute, this);
    }
    return this;
  }

  toggle(): boolean {
    if (!this.isDestroyed) {
      this.#muted = !this.#muted;
      emit(this, this.#muted ? SignalLink.Mute : SignalLink.Unmute, this);
    }
    return this.#muted;
  }

  abstract touch(): this;
  protected abstract write(): void;

  protected updateValue(action: (value: ValueType) => void) {
    if (!this.#muted && !this.isDestroyed) {
      const {value} = this.source;
      action(value);
      emit(this, SignalLink.Value, value);
    }
  }
}

export class SignalLinkToSignal<ValueType = any> extends SignalLink<ValueType> {
  readonly target: ISignalImpl<ValueType>;

  constructor(source: SignalLike<ValueType>, target: SignalLike<ValueType>) {
    super(source);
    this.target = signalImpl(target);
    once(globalDestroySignalQueue, this.target.id, () => this.destroy());
    this.touch();
  }

  touch(): this {
    this.updateValue((value) => {
      this.target.writer(value, {touch: true});
    });
    return this;
  }

  protected write() {
    this.updateValue((value) => {
      this.target.writer(value);
    });
  }
}

export class SignalLinkToCallback<
  ValueType = any,
> extends SignalLink<ValueType> {
  readonly target: ValueCallback<ValueType>;

  constructor(source: SignalLike<ValueType>, target: ValueCallback<ValueType>) {
    super(source);
    this.target = target;
    this.touch();
  }

  touch() {
    this.updateValue((value) => {
      this.target(value);
    });
    return this;
  }

  protected write() {
    this.updateValue((value) => {
      this.target(value);
    });
  }
}
