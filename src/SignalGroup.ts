import {EffectImpl} from './EffectImpl.js';
import {Signal} from './Signal.js';
import {destroySignal, signalImpl} from './createSignal.js';
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

  attachGroup(group: SignalGroup) {
    if (this.#destroyed) {
      throw new Error('Cannot attach a group to a destroyed group');
    }
    if (group === this) {
      throw new Error('Cannot attach a group to itself');
    }

    this.#groups.add(group);

    if (group.#parentGroup && group.#parentGroup !== this) {
      group.#parentGroup.#groups.delete(group);
    }
    group.#parentGroup = this;

    return group;
  }

  detachGroup(group: SignalGroup) {
    if (group !== this && this.#groups.has(group)) {
      this.#groups.delete(group);
      group.#parentGroup = undefined;
    }
    return group;
  }

  attachSignal(signal: SignalLike<any>) {
    if (this.#destroyed) {
      throw new Error('Cannot attach a signal to a destroyed group');
    }
    const sig = signalImpl(signal);
    if (sig && !sig.destroyed) {
      this.#signals.add(sig);
    }
    return signal;
  }

  attachSignalByName(name: string | symbol, signal?: Signal<any>) {
    if (this.#destroyed) {
      throw new Error('Cannot attach a named signal to a destroyed group');
    }
    if (signal) {
      this.attachSignal(signal);
    }
    if (this.#namedSignals.has(name)) {
      this.detachSignal(this.#namedSignals.get(name)!);
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

  detachSignal(signal: SignalLike<any>) {
    const sig = signalImpl(signal);
    if (sig) {
      this.#signals.delete(sig);
    }
    return signal;
  }

  attachEffect(effect: EffectImpl) {
    if (this.#destroyed) {
      throw new Error('Cannot attach an effect to a destroyed group');
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

    this.#parentGroup?.detachGroup(this);

    store.delete(this);

    this.#destroyed = true;
  }
}
