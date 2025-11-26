import {emit, eventize, off} from '@spearwolf/eventize';
import {EffectImpl} from './EffectImpl.js';
import {Signal} from './Signal.js';
import {SignalLink} from './SignalLink.js';
import {DESTROY} from './constants.js';
import {destroySignal, signalImpl} from './createSignal.js';
import {ISignalImpl, SignalLike} from './types.js';

const store = new Map<object, SignalGroup>();

type SignalNameType = string | symbol;

export class SignalGroup {
  readonly #groups = new Set<SignalGroup>();

  readonly #signals = new Set<ISignalImpl>();
  readonly #namedSignals = new Map<SignalNameType, ISignalImpl>();

  readonly #signalKeys = new WeakMap<ISignalImpl<any>, Set<SignalNameType>>();
  readonly #otherSignals = new Map<SignalNameType, ISignalImpl[]>();

  readonly #effects = new Set<EffectImpl>();

  readonly #links = new Set<SignalLink<any>>();

  #parentGroup?: SignalGroup;

  #storeKey?: object;

  static get(object: object) {
    if (object == null) return undefined;
    if (object instanceof SignalGroup) {
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
    // eslint-disable-next-line no-console
    console.warn(
      'SignalGroup.destroy(obj) is deprecated. Use SignalGroup.delete(obj) instead.',
    );
    SignalGroup.delete(object);
  }

  static delete(object: object) {
    store.get(object)?.clear();
  }

  static clear() {
    for (const group of store.values()) {
      group.destroy();
    }
    store.clear();
  }

  private constructor(object?: object) {
    if (object != null && object instanceof SignalGroup) {
      return object;
    }
    object ??= this;
    if (store.has(object)) {
      return store.get(object)!;
    }
    this.#storeKey = object;
    store.set(object, this);
    eventize(this);
  }

  attachGroup(group: SignalGroup) {
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

  attachSignal(signal: SignalLike) {
    const si = signalImpl(signal);

    if (si?.destroyed) {
      throw new Error('Cannot attach a destroyed signal to a group');
    }

    if (si) {
      this.#signals.add(si);
    }

    return signal;
  }

  attachSignalByName(name: SignalNameType, signal?: SignalLike) {
    if (signal) {
      this.attachSignal(signal);

      const si = signalImpl(signal);

      this.#namedSignals.set(name, si);

      if (this.#otherSignals.has(name)) {
        this.#otherSignals.get(name)!.push(si);
      } else {
        this.#otherSignals.set(name, [si]);
      }

      if (this.#signalKeys.has(si)) {
        this.#signalKeys.get(si)!.add(name);
      } else {
        this.#signalKeys.set(si, new Set([name]));
      }
    } else {
      this.#namedSignals.delete(name);
    }

    return signal;
  }

  hasSignal(name: SignalNameType): boolean {
    return this.#namedSignals.has(name) || !!this.#parentGroup?.hasSignal(name);
  }

  signal<Type = any>(name: SignalNameType): Signal<Type> | undefined {
    return (
      this.#namedSignals.get(name)?.object ?? this.#parentGroup?.signal(name)
    );
  }

  detachSignal(signal: SignalLike) {
    const si = signalImpl(signal);

    if (si) {
      this.#signals.delete(si);

      if (this.#signalKeys.has(si)) {
        // signal has named keys
        const keys = this.#signalKeys.get(si)!;
        for (const name of keys) {
          // for each signal key
          if (this.#otherSignals.has(name)) {
            // find all signals that use this key
            const otherSignals = this.#otherSignals.get(name)!;

            // remove the signal from the other signals list (we know, the signal must be part of the list)
            otherSignals.splice(otherSignals.indexOf(si), 1);

            if (otherSignals.length === 0) {
              // if there are no further signals for this name, then we can delete
              this.#namedSignals.delete(name);
              this.#otherSignals.delete(name);
            } else if (this.#namedSignals.get(name) === si) {
              // there are other signals and the signal was the active one.
              // so the previous signal will be associated with the name again.
              this.#namedSignals.set(name, otherSignals.at(-1)!);
            }
          }
        }

        keys.clear();
        this.#signalKeys.delete(si);
      }
    }

    return signal;
  }

  attachEffect(effect: EffectImpl) {
    this.#effects.add(effect);
    return effect;
  }

  runEffects() {
    for (const effect of this.#effects) {
      effect.run();
    }
    for (const childGroup of this.#groups) {
      childGroup.runEffects();
    }
  }

  attachLink(link: SignalLink<any>) {
    if (link?.isDestroyed) {
      throw new Error('Cannot attach a destroyed link to a group');
    }

    if (link) {
      this.#links.add(link);
    }

    return link;
  }

  detachLink(link: SignalLink<any>) {
    if (link) {
      this.#links.delete(link);
    }

    return link;
  }

  destroy() {
    // eslint-disable-next-line no-console
    console.warn(
      'SignalGroup#destroy is deprecated. Use SignalGroup#clear instead.',
    );
    this.clear();
  }

  clear() {
    emit(this, DESTROY, this);
    off(this);

    for (const childGroup of this.#groups) {
      childGroup.destroy();
    }

    for (const effect of this.#effects) {
      effect.destroy();
    }

    for (const signal of this.#signals) {
      destroySignal(signal);
    }

    for (const link of this.#links) {
      link.destroy();
    }

    this.#groups.clear();
    this.#signals.clear();
    this.#namedSignals.clear();
    this.#otherSignals.clear();
    this.#effects.clear();
    this.#links.clear();

    this.#parentGroup?.detachGroup(this);

    if (this.#storeKey) {
      store.delete(this.#storeKey);
      this.#storeKey = undefined;
    }
  }
}
