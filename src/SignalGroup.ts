import {emit, eventize, off} from '@spearwolf/eventize';
import {EffectImpl} from './EffectImpl.js';
import {Signal} from './Signal.js';
import {SignalLink} from './SignalLink.js';
import {DESTROY} from './constants.js';
import {destroySignal, signalImpl} from './createSignal.js';
import {ISignalImpl, SignalLike} from './types.js';

const store = new Map<object, SignalGroup>();

type SignalNameType = string | symbol;

/**
 * A container for managing the lifecycle of signals, effects, links, and child groups.
 *
 * SignalGroups provide automatic cleanup - when a group is cleared, all attached
 * signals, effects, links, and child groups are destroyed. Groups can be nested
 * hierarchically for scoped lifecycle management.
 *
 * Use `SignalGroup.findOrCreate(object)` to create or retrieve a group associated
 * with any object, enabling component-based lifecycle management.
 */
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

  /**
   * Get an existing SignalGroup associated with an object, or undefined if none exists.
   * @param object - The object to look up
   * @returns The associated SignalGroup or undefined
   */
  static get(object: object) {
    if (object == null) return undefined;
    if (object instanceof SignalGroup) {
      return object;
    }
    return store.get(object);
  }

  /**
   * Get or create a SignalGroup associated with an object.
   * If the object already has an associated group, returns that group.
   * @param object - The object to associate with a group
   * @returns The SignalGroup (existing or newly created)
   */
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

  /**
   * Delete and clear the SignalGroup associated with an object.
   * @param object - The object whose group should be deleted
   */
  static delete(object: object) {
    store.get(object)?.clear();
  }

  /**
   * Clear and delete all SignalGroups in the global store.
   */
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

  /**
   * Attach a child group to this group. The child will be cleared when this group is cleared.
   * @param group - The child group to attach
   * @returns The attached group
   */
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

  /**
   * Detach a child group from this group.
   * @param group - The child group to detach
   * @returns The detached group
   */
  detachGroup(group: SignalGroup) {
    if (group !== this && this.#groups.has(group)) {
      this.#groups.delete(group);
      group.#parentGroup = undefined;
    }
    return group;
  }

  /**
   * Attach a signal to this group. The signal will be destroyed when the group is cleared.
   * @param signal - The signal to attach
   * @returns The attached signal
   */
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

  /**
   * Attach a signal with a name for later retrieval via `signal(name)`.
   * If signal is undefined, removes the name association.
   * @param name - The name to associate with the signal
   * @param signal - The signal to attach (or undefined to remove)
   * @returns The attached signal
   */
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

  /**
   * Check if a signal with the given name exists in this group or parent groups.
   * @param name - The signal name to check
   * @returns True if a signal with that name exists
   */
  hasSignal(name: SignalNameType): boolean {
    return this.#namedSignals.has(name) || !!this.#parentGroup?.hasSignal(name);
  }

  /**
   * Get a signal by name from this group or parent groups.
   * @param name - The signal name to look up
   * @returns The Signal object or undefined if not found
   */
  signal<Type = any>(name: SignalNameType): Signal<Type> | undefined {
    return (
      this.#namedSignals.get(name)?.object ?? this.#parentGroup?.signal(name)
    );
  }

  /**
   * Detach a signal from this group (does not destroy it).
   * @param signal - The signal to detach
   * @returns The detached signal
   */
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

  /**
   * Attach an effect to this group. The effect will be destroyed when the group is cleared.
   * @param effect - The effect to attach
   * @returns The attached effect
   */
  attachEffect(effect: EffectImpl) {
    this.#effects.add(effect);
    return effect;
  }

  /**
   * Run all effects in this group and child groups.
   */
  runEffects() {
    for (const effect of this.#effects) {
      effect.run();
    }
    for (const childGroup of this.#groups) {
      childGroup.runEffects();
    }
  }

  /**
   * Attach a link to this group. The link will be destroyed when the group is cleared.
   * @param link - The link to attach
   * @returns The attached link
   */
  attachLink(link: SignalLink<any>) {
    if (link?.isDestroyed) {
      throw new Error('Cannot attach a destroyed link to a group');
    }

    if (link) {
      this.#links.add(link);
    }

    return link;
  }

  /**
   * Detach a link from this group (does not destroy it).
   * @param link - The link to detach
   * @returns The detached link
   */
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

  /**
   * Clear this group, destroying all attached signals, effects, links, and child groups.
   * Also removes this group from the global store and detaches from parent.
   */
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
