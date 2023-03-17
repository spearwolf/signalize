import {UnsubscribeFunc} from '@spearwolf/eventize';
import {getSignal} from './createSignal';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues';
import {Signal, SignalReader} from './types';

export class Connection<T> {
  #unsubscribe?: UnsubscribeFunc;

  #muted = false;

  isMuted(): boolean {
    return this.#muted;
  }

  #source?: Signal<T>;
  #target?: Signal<T>;

  get target(): SignalReader<T> | undefined {
    return this.#target?.reader;
  }

  set target(target: SignalReader<T> | undefined) {
    this.#target = target != null ? getSignal(target) : undefined;
  }

  constructor(source: SignalReader<T>, target?: SignalReader<T>) {
    this.#source = getSignal(source);

    if (target) {
      this.target = target;
    }

    this.#unsubscribe = globalSignalQueue.on(this.#source.id, 'touch', this);
    globalDestroySignalQueue.once(this.#source.id, 'destroy', this);
  }

  touch(): Connection<T> {
    if (!this.#muted && !this.isDestroyed && this.#target != null) {
      this.#target.writer(this.#source.value);
    }
    return this;
  }

  mute(): Connection<T> {
    this.#muted = true;
    return this;
  }

  unmute(): Connection<T> {
    this.#muted = false;
    return this;
  }

  toggle(): boolean {
    this.#muted = !this.#muted;
    return this.#muted;
  }

  destroy(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#source = undefined;
    this.#target = undefined;
  }

  get isDestroyed(): boolean {
    return this.#unsubscribe == null;
  }
}

export function connect<T = unknown>(
  source: SignalReader<T>,
  target: SignalReader<T>,
): Connection<T> {
  return new Connection(source, target);
}
