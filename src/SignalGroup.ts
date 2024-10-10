import {EffectImpl} from './EffectImpl.js';
import {Signal} from './Signal.js';
import {destroySignal, getSignalInstance} from './createSignal.js';
import {ISignalImpl, SignalLike} from './types.js';

const store = new Map<object, SignalGroup>();

export class SignalGroup {
  #groups = new Set<SignalGroup>();
  #signals = new Set<ISignalImpl<any>>();
  #namedSignals = new Map<string | symbol, Signal<any>>();
  #effects = new Set<EffectImpl>();

  #destroyed = false;

  #parentGroup?: SignalGroup;

  static get(object: object) {
    if (object == null) return undefined;
    if (object instanceof SignalGroup && !object.#destroyed) {
      return object;
    }
    return store.get(object);
  }

  static findOrCreate(object: object) {
    if (object == null) {
      throw new Error('Cannot create a group with a null object');
    }
    return new SignalGroup(object);
  }

  static destroy(object: object) {
    store.get(object)?.destroy();
  }

  static clear() {
    for (const group of store.values()) {
      group.destroy();
    }
    store.clear();
  }

  private constructor(object?: object) {
    if (object != null && object instanceof SignalGroup && !object.#destroyed) {
      return object;
    }
    object ??= this;
    if (store.has(object)) {
      return store.get(object)!;
    }
    store.set(object, this);
  }

  addGroup(group: SignalGroup) {
    if (this.#destroyed) {
      throw new Error('Cannot add a group to a destroyed group');
    }
    if (group === this) {
      throw new Error('Cannot add a group to itself');
    }

    this.#groups.add(group);

    if (group.#parentGroup && group.#parentGroup !== this) {
      group.#parentGroup.#groups.delete(group);
    }
    group.#parentGroup = this;

    return group;
  }

  removeGroup(group: SignalGroup) {
    if (group !== this && this.#groups.has(group)) {
      this.#groups.delete(group);
      group.#parentGroup = undefined;
    }
    return group;
  }

  addSignal(signal: SignalLike<any>) {
    if (this.#destroyed) {
      throw new Error('Cannot add a signal to a destroyed group');
    }
    const sig = getSignalInstance(signal);
    if (sig && !sig.destroyed) {
      this.#signals.add(sig);
    }
    return signal;
  }

  setSignal(name: string | symbol, signal?: Signal<any>) {
    if (this.#destroyed) {
      throw new Error('Cannot attach a named signal to a destroyed group');
    }
    if (signal) {
      this.addSignal(signal);
    }
    if (this.#namedSignals.has(name)) {
      this.removeSignal(this.#namedSignals.get(name)!);
    }
    if (signal) {
      this.#namedSignals.set(name, signal);
    } else {
      this.#namedSignals.delete(name);
    }
    return signal;
  }

  getSignal<Type = any>(name: string | symbol): Signal<Type> | undefined {
    return this.#namedSignals.get(name) ?? this.#parentGroup?.getSignal(name);
  }

  removeSignal(signal: SignalLike<any>) {
    const sig = getSignalInstance(signal);
    if (sig) {
      this.#signals.delete(sig);
    }
    return signal;
  }

  addEffect(effect: EffectImpl) {
    if (this.#destroyed) {
      throw new Error('Cannot add an effect to a destroyed group');
    }
    this.#effects.add(effect);
    return effect;
  }

  runEffects() {
    if (this.#destroyed) {
      throw new Error('Cannot run effects on a destroyed group');
    }
    for (const effect of this.#effects) {
      effect.run();
    }
    for (const childGroup of this.#groups) {
      childGroup.runEffects();
    }
  }

  destroy() {
    if (this.#destroyed) return;

    for (const childGroup of this.#groups) {
      childGroup.destroy();
    }

    for (const effect of this.#effects) {
      effect.destroy();
    }

    for (const signal of this.#signals) {
      destroySignal(signal);
    }

    this.#groups.clear();
    this.#signals.clear();
    this.#namedSignals.clear();
    this.#effects.clear();

    this.#parentGroup?.removeGroup(this);

    store.delete(this);

    this.#destroyed = true;
  }
}
