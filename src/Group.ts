import {Effect} from './Effect.js';
import {destroySignal, getSignalInstance} from './createSignal.js';
import {SignalLike, Signal} from './types.js';

const store = new Map<object, Group>();

export class Group {
  #groups = new Set<Group>();
  #signals = new Set<Signal<any>>();
  #effects = new Set<Effect>();

  #destroyed = false;

  static get(object: object) {
    return object instanceof Group ? object : store.get(object);
  }

  static destroy(object: object) {
    const group = store.get(object);
    if (group) {
      group.destroy();
    }
  }

  static clear() {
    for (const group of store.values()) {
      group.destroy();
    }
    store.clear();
  }

  constructor(object: object) {
    if (object instanceof Group) {
      return object;
    }
    if (store.has(object)) {
      return store.get(object)!;
    }
    store.set(object, this);
  }

  addGroup(group: Group) {
    if (this.#destroyed) {
      throw new Error('Cannot add a group to a destroyed group');
    }
    if (group === this) {
      throw new Error('Cannot add a group to itself');
    }
    this.#groups.add(group);
    return group;
  }

  removeGroup(group: Group) {
    this.#groups.delete(group);
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

  removeSignal(signal: SignalLike<any>) {
    const sig = getSignalInstance(signal);
    if (sig) {
      this.#signals.delete(sig);
    }
    return signal;
  }

  addEffect(effect: Effect) {
    if (this.#destroyed) {
      throw new Error('Cannot add an effect to a destroyed group');
    }
    this.#effects.add(effect);
    return effect;
  }

  //removeEffect(effect: Effect) {
  //  this.#effects.delete(effect);
  //  return effect;
  //}

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
    this.#effects.clear();

    store.delete(this);

    this.#destroyed = true;
  }
}
