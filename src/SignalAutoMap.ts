import {batch} from './batch.js';
import {createSignal} from './createSignal.js';
import {Signal} from './Signal.js';

export type SignalAutoMapKeyType = string | symbol;

export class SignalAutoMap {
  static fromProps<PropsObjectType extends object>(
    obj: PropsObjectType,
    propKeys?: (keyof PropsObjectType)[],
  ): SignalAutoMap {
    const sm = new SignalAutoMap();
    const entries = propKeys
      ? propKeys.map((key) => [key, obj[key]])
      : Object.entries(obj);
    for (const [key, value] of entries) {
      sm.#signals.set(key as any, createSignal(value as unknown));
    }
    return sm;
  }

  #signals = new Map<SignalAutoMapKeyType, Signal<any>>();

  keys(): IterableIterator<SignalAutoMapKeyType> {
    return this.#signals.keys();
  }

  signals(): IterableIterator<Signal<any>> {
    return this.#signals.values();
  }

  entries(): IterableIterator<[SignalAutoMapKeyType, Signal<any>]> {
    return this.#signals.entries();
  }

  clear() {
    for (const sig of this.#signals.values()) {
      sig.destroy();
    }
    this.#signals.clear();
  }

  has(key: SignalAutoMapKeyType): boolean {
    return this.#signals.has(key);
  }

  /**
   * will always return a signal, if it doesn't exist it will be created
   */
  get<T = unknown>(key: SignalAutoMapKeyType): Signal<T> {
    if (!this.#signals.has(key)) {
      const signal = createSignal<T>();
      this.#signals.set(key, signal);
      return signal;
    }
    return this.#signals.get(key)!;
  }

  update(props: Map<any, unknown>): void {
    if (props.size) {
      batch(() => {
        for (const [key, val] of props.entries()) {
          this.get(key as any).set(val);
        }
      });
    }
  }

  updateFromProps<PropsObjType extends object>(
    obj: PropsObjType,
    propKeys?: (keyof PropsObjType)[],
  ): void {
    batch(() => {
      const entries = propKeys
        ? propKeys.map((key) => [key, obj[key]])
        : Object.entries(obj);
      for (const [key, value] of entries) {
        this.get(key as any).set(value);
      }
    });
  }
}
