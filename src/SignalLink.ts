import {
  emit,
  eventize,
  off,
  on,
  once,
  retain,
  retainClear,
} from '@spearwolf/eventize';
import {DESTROY, MUTE, UNMUTE, VALUE} from './constants.js';
import {signalImpl} from './createSignal.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import {SignalGroup} from './SignalGroup.js';
import {ISignalImpl, SignalLike} from './types.js';

export type ValueCallback<ValueType = any> = (value: ValueType) => void;

export abstract class SignalLink<ValueType = any> {
  #muted = false;
  #unsubscribe?: () => void;

  readonly source: ISignalImpl<ValueType>;

  lastValue?: ValueType;

  isDestroyed = false;

  constructor(source: SignalLike<ValueType>) {
    eventize(this);

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

  attach(to: object) {
    const group = SignalGroup.findOrCreate(to);
    group.attachLink(this);
    once(this, DESTROY, () => {
      group.detachLink(this);
    });
    return group;
  }

  nextValue(): Promise<ValueType> {
    return new Promise((resolve, reject) => {
      const subscriptions: (() => void)[] = [];
      const unsubscribe = () =>
        subscriptions.forEach((unsub) => {
          unsub();
        });

      subscriptions.push(
        // we can not just use 'once' here because the value is retained
        once(this, VALUE, (val) => {
          unsubscribe();
          resolve(val);
        }),
        once(this, DESTROY, () => {
          unsubscribe();
          reject();
        }),
      );
    });
  }

  async *asyncValues(
    stopAction?: (value: ValueType, index: number) => boolean,
  ) {
    retain(this, VALUE);
    try {
      let i = 0;
      while (!this.isDestroyed) {
        try {
          const next = await this.nextValue();
          if (stopAction && stopAction(next, i++)) break;
          yield next;
        } catch {
          break;
        }
      }
    } finally {
      retainClear(this, VALUE);
    }
  }

  destroy() {
    if (this.isDestroyed) return;

    this.#unsubscribe?.();
    this.#unsubscribe = undefined;

    emit(this, DESTROY, this);
    retainClear(this, VALUE);
    off(this);

    this.lastValue = undefined;

    this.isDestroyed = true;

    Object.freeze(this);
  }

  get isMuted(): boolean {
    return this.#muted;
  }

  mute(): this {
    if (!this.isDestroyed && !this.#muted) {
      this.#muted = true;
      emit(this, MUTE, this);
    }
    return this;
  }

  unmute(): this {
    if (!this.isDestroyed && this.#muted) {
      this.#muted = false;
      emit(this, UNMUTE, this);
    }
    return this;
  }

  toggleMute(): boolean {
    if (!this.isDestroyed) {
      this.#muted = !this.#muted;
      emit(this, this.#muted ? MUTE : UNMUTE, this);
    }
    return this.#muted;
  }

  abstract touch(): this;
  protected abstract write(): void;

  protected updateValue(action: (value: ValueType) => void) {
    if (!this.#muted && !this.isDestroyed) {
      const {value} = this.source;
      action(value);
      emit(this, VALUE, value);
      this.lastValue = value;
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
