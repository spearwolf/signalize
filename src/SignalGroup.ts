import {type EventizedObject, emit, eventize, off} from '@spearwolf/eventize';
import {DESTROY, OFF} from './constants.js';
import {destroySignal, signalImpl} from './createSignal.js';
import {EffectImpl} from './EffectImpl.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {Signal} from './Signal.js';
import {SignalLink} from './SignalLink.js';
import {ISignalImpl, SignalLike} from './types.js';

// Lookup map: user-object → SignalGroup. WeakMap so that user objects are not
// kept alive by the registry — once the user object is unreachable, its entry
// can be reclaimed.
const store = new WeakMap<object, SignalGroup>();

// Iteration set: holds every live SignalGroup so the static `clear()` can
// walk all groups. The set holds SignalGroups, NOT user objects, so it does
// not pin user objects in memory. SignalGroups remove themselves from this
// set in their instance `clear()`.
const allGroups = new Set<SignalGroup>();

// Auto-cleanup: when the user object becomes unreachable without an explicit
// `SignalGroup.delete(obj)` / `group.clear()`, the FinalizationRegistry
// callback runs `group.clear()` so attached signals/effects/links are
// reclaimed. FR firing is non-deterministic — explicit cleanup remains
// preferred — but this prevents the worst-case leak.
const groupFinalizationRegistry = new FinalizationRegistry<SignalGroup>(
  (group) => {
    if (allGroups.has(group)) group.clear();
  },
);

/**
 * Get the current count of live SignalGroups.
 * Useful for debugging and detecting leaks (e.g. forgotten `clear()`/`delete()`).
 */
export const getSignalGroupsCount = (): number => allGroups.size;

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
// Eventize injects EventizedObject members at runtime via eventize(this) in
// the constructor — declaration merging tells TS the brand is present.
export interface SignalGroup extends EventizedObject {}

export class SignalGroup {
  readonly #groups = new Set<SignalGroup>();

  readonly #signals = new Set<ISignalImpl>();
  readonly #namedSignals = new Map<SignalNameType, ISignalImpl>();

  readonly #signalKeys = new WeakMap<ISignalImpl<any>, Set<SignalNameType>>();
  readonly #otherSignals = new Map<SignalNameType, Set<ISignalImpl>>();

  readonly #effects = new Set<EffectImpl>();

  readonly #links = new Set<SignalLink<any>>();

  #parentGroup?: SignalGroup;

  // Held weakly so that the SignalGroup does not pin the user object: if the
  // user drops their reference, the user object becomes GC-eligible even
  // though the SignalGroup is still referenced from `allGroups`.
  #storeKey?: WeakRef<object>;

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
    // Snapshot — each group.clear() mutates `allGroups`.
    for (const group of [...allGroups]) {
      group.clear();
    }
    allGroups.clear();
  }

  private constructor(object?: object) {
    if (object != null && object instanceof SignalGroup) {
      return object;
    }
    object ??= this;
    if (store.has(object)) {
      return store.get(object)!;
    }
    this.#storeKey = new WeakRef(object);
    store.set(object, this);
    allGroups.add(this);
    // Register for auto-cleanup if the user object becomes unreachable
    // without an explicit clear/delete. Skip self-registration (when
    // object === this) — a group used as its own key cannot outlive itself.
    if (object !== this) {
      groupFinalizationRegistry.register(object, this, this);
    }
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

      const otherSignals = this.#otherSignals.get(name);
      if (otherSignals) {
        otherSignals.add(si);
      } else {
        this.#otherSignals.set(name, new Set([si]));
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
          const otherSignals = this.#otherSignals.get(name);
          if (otherSignals) {
            // remove the signal from the other-signals set (idempotent)
            otherSignals.delete(si);

            if (otherSignals.size === 0) {
              // if there are no further signals for this name, then we can delete
              this.#namedSignals.delete(name);
              this.#otherSignals.delete(name);
            } else if (this.#namedSignals.get(name) === si) {
              // there are other signals and the signal was the active one —
              // fall back to the most recently inserted remaining signal (Set
              // preserves insertion order).
              let previous: ISignalImpl | undefined;
              for (const s of otherSignals) previous = s;
              this.#namedSignals.set(name, previous!);
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
    console.warn(
      'SignalGroup#destroy is deprecated. Use SignalGroup#clear instead.',
    );
    this.clear();
  }

  /**
   * Tear down all subscriptions associated with this group without destroying
   * the group itself.
   *
   * - Attached effects and links are destroyed (their cleanup callbacks run).
   * - External effects/links that subscribed to signals in this group lose
   *   their subscription; if a group signal was an external effect's only
   *   dependency, that effect is destroyed too.
   * - Attached signals stay alive and reachable (incl. by name); the group
   *   remains in the registry and accepts new attachments.
   * - Child groups are recursively `off()`'d (not cleared).
   *
   * Use this when a component-style group should be paused/swapped without
   * losing its signal identities. For a full teardown use `clear()`.
   */
  off(): void {
    // Recurse into child groups first (depth-first, mirrors clear()).
    for (const childGroup of this.#groups) {
      childGroup.off();
    }

    // Destroy own effects: their cleanup callbacks fire, their signal-queue
    // subscriptions are removed via EffectImpl.destroy().
    for (const effect of this.#effects) {
      effect.destroy();
    }
    this.#effects.clear();

    // Destroy own links: they unsubscribe from their source signals.
    for (const link of this.#links) {
      link.destroy();
    }
    this.#links.clear();

    // Soft-detach: notify any remaining external subscribers (effects/links
    // not attached to this group) that they should drop their subscription
    // to each group signal. The signal itself stays alive and usable; an
    // external effect whose only dependency was a group signal destroys
    // itself via EffectImpl[$destroySignal].
    for (const si of this.#signals) {
      if (!si.destroyed) {
        emit(globalDestroySignalQueue, si.id, si.id, {detach: true});
      }
    }

    // Signals, named-signal lookup, signal-key map, and child-group set
    // are intentionally left intact — the group remains reusable.

    emit(this, OFF, this);
  }

  /**
   * Clear this group, destroying all attached signals, effects, links, and child groups.
   * Also removes this group from the global store and detaches from parent.
   */
  clear() {
    emit(this, DESTROY, this);
    off(this);

    for (const childGroup of this.#groups) {
      childGroup.clear();
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
      const key = this.#storeKey.deref();
      if (key !== undefined) {
        store.delete(key);
      }
      this.#storeKey = undefined;
    }
    allGroups.delete(this);
    groupFinalizationRegistry.unregister(this);
  }
}
