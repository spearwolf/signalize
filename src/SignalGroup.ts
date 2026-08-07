import {
  type EventizedObject,
  emit,
  eventize,
  off,
  on,
  once,
  Priority,
} from '@spearwolf/eventize';
import {throwCollectedErrors} from './collect-errors.js';
import {DESTROY, OFF} from './constants.js';
import {EffectImpl} from './EffectImpl.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {Signal} from './Signal.js';
import {SignalLink} from './SignalLink.js';
import {destroySignal, signalImpl} from './signal-core.js';
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
//
// Since Package 1, `clear()` finishes the whole teardown before it throws,
// and it throws into a FinalizationRegistry job — a context with no caller.
// An `uncaughtException` there takes the whole process down. Re-throwing
// here would just be that crash again, and swallowing silently would be
// worse still: a throwing cleanup would stay invisible forever. So it gets
// reported instead, never re-thrown. This is the one path in the package
// where `clear()` runs without a caller at all — everywhere else the caller
// gets its error unchanged.
/**
 * @internal Exported for the regression test in `SignalGroup.teardown.spec.ts`.
 */
export const clearGroupFromFinalizer = (group: SignalGroup): void => {
  if (!allGroups.has(group)) return;
  try {
    group.clear();
  } catch (err) {
    console.error(
      '[signalize] a SignalGroup teardown threw in the FinalizationRegistry callback, where no caller can catch it:',
      err,
    );
  }
};

const groupFinalizationRegistry = new FinalizationRegistry<SignalGroup>(
  clearGroupFromFinalizer,
);

/**
 * Get the current count of live SignalGroups.
 * Useful for debugging and detecting leaks (e.g. forgotten `clear()`/`delete()`).
 */
export const getSignalGroupsCount = (): number => allGroups.size;

/**
 * @internal Test seam for the cycle guard in `attachGroup()`.
 *
 * The guard rejects every edge that would close a cycle, so a cyclic parent
 * chain cannot be built through the public API — and the Floyd branch that
 * catches one anyway would stay forever untested. This is the only way in.
 * Never call it from production code.
 */
export const $setParentGroup = Symbol.for(
  '@spearwolf/signalize/setParentGroup',
);

type SignalNameType = string | symbol;

// Cycle / re-entrancy guard for the five recursive walks.
//
// `attachGroup()` rejects any edge that would close a cycle, so the group
// graph is a forest. The walks below must survive a broken invariant anyway:
// `clear()` runs from the FinalizationRegistry callback, where a RangeError is
// out of reach for any application-level try/catch. The same marker also stops
// user code from re-entering a walk it is already inside — a DESTROY listener
// calling `clear()` again, an OFF listener calling `off()` again.
//
// A per-instance bitmask instead of a `Set` passed down the recursion. The two
// are not the same marker: the bit says "this group is on the current
// recursion stack" and is cleared again on the way out, where a visited set
// says "this group has been seen at all" and keeps saying it. For breaking
// cycles they agree; where they differ the bit is the one we want. A diamond
// (two paths reaching the same group) is a legitimate second visit and must
// still run — a visited set would swallow it, the bit lets it through, because
// the group is no longer on the stack by then. The bit also catches what no
// set threaded through the recursion can: user code that re-enters the same
// method from a listener, starting a fresh top-level walk with a fresh set.
// One bit per method — walks of different kinds may legitimately nest (a
// DESTROY listener asking `hasSignal()` mid-`clear()`).
const BUSY_HAS_SIGNAL = 1 << 0;
const BUSY_SIGNAL = 1 << 1;
const BUSY_RUN_EFFECTS = 1 << 2;
const BUSY_OFF = 1 << 3;
const BUSY_CLEAR = 1 << 4;

const CYCLE_REJECTED =
  'Cannot attach a group to one of its own descendants: this would create a cycle in the group graph';

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

  // Signals handed to the public `attachSignal()`. They stay group-owned even
  // when a name they are bound to is rebound to another signal — signals that
  // only ever arrived through `attachSignalByName()` do not.
  readonly #directSignals = new Set<ISignalImpl>();

  readonly #effects = new Set<EffectImpl>();

  // One `globalDestroySignalQueue` unsubscribe handle per attached signal
  // (MEM-002): the group has to hear about a signal it holds being destroyed,
  // or a long-lived group accumulates dead SignalImpls until `clear()`.
  readonly #signalDestroySubscriptions = new Map<ISignalImpl, () => void>();

  readonly #links = new Set<SignalLink<any>>();

  // MEM-002: which links this group has already registered its DESTROY
  // counter-edge for. Not `#links.has(link)` as the guard: `detachLink()` is
  // public API and takes a *live* link back out, so every detach/attach
  // cycle would append another listener. And not a second `Set` either: that
  // would be a new strong holder for exactly the links `detachLink()` just
  // released.
  readonly #linksWithDestroyHook = new WeakSet<SignalLink<any>>();

  #parentGroup?: SignalGroup;

  #busy = 0;

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
    // PERF-002: check the store before constructing. The field initializers
    // alone allocate four Sets, two Maps and a WeakMap, so `new
    // SignalGroup(object)` on a cache hit built and discarded all of that
    // just to have the constructor's own `store.has()` check hand back the
    // existing instance. Checked here first, this path is a plain WeakMap
    // lookup on a hit. The constructor's `store.has()` check (and the
    // `instanceof SignalGroup` early return) stay in place as the
    // authoritative safety net — for direct/re-entrant construction and for
    // the race between this lookup and the constructor's own set — they just
    // no longer carry the common case.
    if (object instanceof SignalGroup) {
      return object;
    }
    return store.get(object) ?? new SignalGroup(object);
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
   *
   * A group whose teardown throws does not stop the sweep: every failure is
   * collected, the remaining groups are torn down regardless, and the
   * errors are re-raised afterwards — a lone one unchanged, several as an
   * `AggregateError` holding them in sweep order.
   */
  static clear() {
    const errors: unknown[] = [];
    // Snapshot — each group.clear() mutates `allGroups`, and it also takes
    // itself out of the set (before its own throw, so a failing teardown
    // deregisters just like a clean one). Nothing sweeps up afterwards: an
    // `allGroups.clear()` here would only ever hit groups created *during*
    // the sweep — by a DESTROY listener — and those are live groups, still
    // in `store` and still handed out by `findOrCreate()`. Wiping them out
    // of the set alone would leave them uncounted by
    // `getSignalGroupsCount()`, out of reach of the next sweep, and with a
    // FinalizationRegistry callback that can never fire again, because it
    // starts with `allGroups.has(group)` (BUG-009). They survive the sweep
    // instead, fully registered. Deliberately no loop-until-empty: a
    // listener that recreates a group on every teardown would turn that
    // into a hang.
    for (const group of [...allGroups]) {
      try {
        group.clear();
      } catch (err) {
        errors.push(err);
      }
    }
    throwCollectedErrors(errors, 'clearing all signal groups');
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

    // Walk up our own parent chain: if the prospective child is already an
    // ancestor, the edge would close a cycle and every recursive walk over the
    // graph would run until the stack gives out.
    //
    // The walk itself must not hang if the chain is *already* cyclic — a guard
    // that assumes the invariant it defends is worth nothing. Floyd: `fast`
    // takes two links per round, `slow` one; they can only ever meet inside a
    // loop, and no bookkeeping is allocated to find out.
    let slow: SignalGroup | undefined = this;
    let fast: SignalGroup | undefined = this.#parentGroup;

    while (fast != null) {
      if (fast === group) throw new Error(CYCLE_REJECTED);

      fast = fast.#parentGroup;
      if (fast == null) break;

      if (fast === group) throw new Error(CYCLE_REJECTED);

      fast = fast.#parentGroup;
      slow = slow.#parentGroup;

      if (fast != null && fast === slow) {
        throw new Error(
          'Cannot attach a group: the parent chain of this group is already cyclic',
        );
      }
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

  /** @internal See {@link $setParentGroup}. */
  [$setParentGroup](parent: SignalGroup | undefined): void {
    this.#parentGroup = parent;
  }

  /**
   * Attach a signal to this group. The signal will be destroyed when the group is cleared.
   * @param signal - The signal to attach
   * @returns The attached signal
   */
  attachSignal(signal: SignalLike) {
    const si = this.#addSignal(signal);

    if (si) {
      this.#directSignals.add(si);
    }

    return signal;
  }

  #addSignal(signal: SignalLike): ISignalImpl | undefined {
    const si = signalImpl(signal);

    if (si?.destroyed) {
      throw new Error('Cannot attach a destroyed signal to a group');
    }

    if (si) {
      this.#signals.add(si);

      if (!this.#signalDestroySubscriptions.has(si)) {
        // Deliberately `on`, not `once`: the same queue carries the
        // soft-detach emit from `off()` with `{detach: true}`, and a `once`
        // would be consumed by that one — leaving nobody to hear the real
        // destruction later.
        const unsubscribe = on(
          globalDestroySignalQueue,
          si.id,
          (_id: symbol, params?: {detach?: boolean}) => {
            if (params?.detach) return;
            this.#removeSignal(si);
          },
        );
        this.#signalDestroySubscriptions.set(si, unsubscribe);
      }
    }

    return si;
  }

  /**
   * Release the destroy-queue subscription the group holds for `si`, if any.
   *
   * Every path that drops a signal from `#signals` goes through here first —
   * an orphaned handle would keep the closure (and with it the group) on a
   * process-lifetime queue.
   */
  #dropSignalSubscription(si: ISignalImpl) {
    const unsubscribe = this.#signalDestroySubscriptions.get(si);
    if (unsubscribe) {
      unsubscribe();
      this.#signalDestroySubscriptions.delete(si);
    }
  }

  /**
   * Drop the (name → signal) association, and with it the group's hold on the
   * signal if that name was the only thing holding it.
   *
   * A signal that arrived through `attachSignalByName()` alone belongs to the
   * group: once its last name is gone nothing can reach it any more, so it is
   * destroyed rather than quietly abandoned. A signal that was additionally
   * handed to `attachSignal()` stays group-owned and alive — it loses the
   * name, not its life, and `clear()` still destroys it.
   */
  #releaseFromName(name: SignalNameType, si: ISignalImpl) {
    const otherSignals = this.#otherSignals.get(name);
    if (otherSignals) {
      otherSignals.delete(si);
      if (otherSignals.size === 0) {
        this.#otherSignals.delete(name);
      }
    }

    const keys = this.#signalKeys.get(si);
    if (keys) {
      keys.delete(name);
      if (keys.size === 0) {
        this.#signalKeys.delete(si);
        if (!this.#directSignals.has(si)) {
          this.#dropSignalSubscription(si);
          this.#signals.delete(si);
          destroySignal(si);
        }
      }
    }
  }

  /**
   * A name is being rebound to another signal: release the signal it displaces
   * — unless the group owns that one directly, in which case it keeps its slot
   * under the name as a fallback candidate for `detachSignal()`.
   */
  #displaceFromName(name: SignalNameType, si: ISignalImpl) {
    if (this.#directSignals.has(si)) return;
    this.#releaseFromName(name, si);
  }

  /**
   * Attach a signal with a name for later retrieval via `signal(name)`.
   *
   * Binding a name is a transfer of ownership: unless the signal is also
   * handed to `attachSignal()`, the name is the group's only hold on it.
   *
   * Rebinding the name therefore *destroys* the signal it displaces — nothing
   * could reach it any more. Exempt are signals held by another name and
   * signals attached explicitly via `attachSignal()`; those stay alive and, in
   * the second case, group-owned. Without this, a repeatedly rebound slot
   * would pile up every signal it ever held until `clear()`.
   *
   * Passing `undefined` as the signal releases the name the same way: every
   * signal still listed under it loses that name, and loses its life with it
   * if the name was all the group had on it.
   *
   * @param name - The name to associate with the signal
   * @param signal - The signal to attach (or undefined to remove)
   * @returns The attached signal
   */
  attachSignalByName(name: SignalNameType, signal?: SignalLike) {
    if (signal) {
      const si = this.#addSignal(signal);

      const previous = this.#namedSignals.get(name);
      if (previous != null && previous !== si) {
        this.#displaceFromName(name, previous);
      }

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
      // Release *this* name from every signal listed under it — not the
      // signals from all of their names. `detachSignal()` would do the latter
      // and would also strip an explicitly attached signal of its group
      // ownership, which the rebind path deliberately preserves.
      const otherSignals = this.#otherSignals.get(name);
      if (otherSignals) {
        for (const si of [...otherSignals]) {
          this.#releaseFromName(name, si);
        }
      }
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
    if (this.#busy & BUSY_HAS_SIGNAL) return false;
    this.#busy |= BUSY_HAS_SIGNAL;
    try {
      return (
        this.#namedSignals.has(name) || !!this.#parentGroup?.hasSignal(name)
      );
    } finally {
      this.#busy &= ~BUSY_HAS_SIGNAL;
    }
  }

  /**
   * Get a signal by name from this group or parent groups.
   * @param name - The signal name to look up
   * @returns The Signal object or undefined if not found
   */
  signal<Type = any>(name: SignalNameType): Signal<Type> | undefined {
    if (this.#busy & BUSY_SIGNAL) return undefined;
    this.#busy |= BUSY_SIGNAL;
    try {
      return (
        this.#namedSignals.get(name)?.object ?? this.#parentGroup?.signal(name)
      );
    } finally {
      this.#busy &= ~BUSY_SIGNAL;
    }
  }

  /**
   * Detach a signal from this group (does not destroy it).
   * @param signal - The signal to detach
   * @returns The detached signal
   */
  detachSignal(signal: SignalLike) {
    const si = signalImpl(signal);

    if (si) {
      this.#removeSignal(si);
    }

    return signal;
  }

  /**
   * Take a signal out of the group completely — the signal set, the
   * direct-ownership set, the destroy-queue subscription, and every name it
   * is bound to. Where a name still lists other candidates, the most recently
   * added one takes the slot over.
   *
   * Shared by the public `detachSignal()` and by the destroy hook from
   * `#addSignal()`: a hard-destroyed signal has to leave through exactly this
   * door. Emptying only `#signals`/`#directSignals` would leave the dead
   * `SignalImpl` reachable through `#namedSignals`/`#otherSignals` — which is
   * the whole of the `@signal` decorator path, where `attachSignalByName()`
   * is the only way in (MEM-002).
   */
  #removeSignal(si: ISignalImpl) {
    this.#dropSignalSubscription(si);
    this.#signals.delete(si);
    this.#directSignals.delete(si);

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

  /**
   * Attach an effect to this group. The effect will be destroyed when the group is cleared.
   *
   * A destroyed effect takes itself out of the group again (MEM-002) —
   * without that, a long-lived group with effect churn keeps every dead
   * `EffectImpl` and its callback closure alive until `clear()`.
   *
   * @param effect - The effect to attach
   * @returns The attached effect
   */
  attachEffect(effect: EffectImpl) {
    // Guarded because eventize's own dedup can't help: `add()` only dedupes
    // `LISTENER_IS_OBJ` and `LISTENER_IS_NAMED_FUNC` (method-name) listeners.
    // A function is neither, so `once()` re-adds it every call — held
    // reference or fresh arrow, same result. Unguarded, a repeated
    // `attachEffect(sameEffect)` would grow the DESTROY list without bound.
    if (!this.#effects.has(effect)) {
      this.#effects.add(effect);
      once(effect, DESTROY, () => {
        this.#effects.delete(effect);
      });
    }
    return effect;
  }

  /**
   * Run all effects in this group and child groups.
   */
  runEffects() {
    if (this.#busy & BUSY_RUN_EFFECTS) return;
    this.#busy |= BUSY_RUN_EFFECTS;
    try {
      for (const effect of this.#effects) {
        effect.run();
      }
      for (const childGroup of this.#groups) {
        childGroup.runEffects();
      }
    } finally {
      this.#busy &= ~BUSY_RUN_EFFECTS;
    }
  }

  /**
   * Attach a link to this group. The link will be destroyed when the group is cleared.
   *
   * A destroyed link takes itself out of the group again (MEM-002),
   * whichever route attached it — `link(…, {attach})`, `link.attach(obj)`
   * or a direct `attachLink()` call.
   *
   * @param link - The link to attach
   * @returns The attached link
   */
  attachLink(link: SignalLink<any>) {
    if (link?.isDestroyed) {
      throw new Error('Cannot attach a destroyed link to a group');
    }

    if (link) {
      this.#links.add(link);
      // Guarded because eventize's own dedup can't help: `isSimilar()` only
      // covers `LISTENER_IS_OBJ` and `LISTENER_IS_NAMED_FUNC` listeners. A
      // plain function is neither, so even the same function reference
      // registered twice yields two subscriptions.
      if (!this.#linksWithDestroyHook.has(link)) {
        this.#linksWithDestroyHook.add(link);
        // MEM-002: the counter-edge to `attachEffect()`'s hook. It lives
        // here rather than in `SignalLink.attach()` because `attachLink()`
        // is the common passage of both routes — `link({attach})` and
        // `link.attach(obj)` come through here, a direct
        // `group.attachLink(link)` likewise. Without it, a link attached
        // that way stayed in `#links` after `destroy()` and kept its source
        // SignalImpl and its callback closure alive for the lifetime of the
        // group.
        //
        // Priority.Max: eventize aborts delivery at a throwing listener. At
        // normal priority the registration order decided whether this line
        // ever ran — an application listener registered before the attach
        // and throwing would swallow it. The group's bookkeeping comes
        // before application code.
        //
        // The guarantee reaches exactly as far as the priority does:
        // `Priority.Max` is `+Infinity`, not an exclusive slot. A listener
        // registered at `Priority.Max` *before* this one still runs first
        // — ties fall back to registration order — and if it throws, the
        // group keeps its dead link after all (measured). Every listener
        // below `Priority.Max`, which is every ordinary one, is covered.
        once(link, DESTROY, Priority.Max, () => {
          this.#links.delete(link);
        });
      }
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

  /**
   * Sizes of the group's own member collections.
   *
   * The global counters (`getSignalsCount()`, `getEffectsCount()`,
   * `getLinksCount()`) cannot answer whether a *group* is still holding a
   * member that is already dead — a destroyed effect is off the global books
   * long before the group lets go of it. This getter is the window for that
   * question; `getGroupMemberCounts()` in `assert-helpers.ts` is its only
   * consumer, and no production code path reads it.
   *
   * @internal
   */
  get memberCounts(): {
    signals: number;
    namedSignals: number;
    otherSignals: number;
    effects: number;
    links: number;
    groups: number;
  } {
    return {
      signals: this.#signals.size,
      namedSignals: this.#namedSignals.size,
      otherSignals: this.#otherSignals.size,
      effects: this.#effects.size,
      links: this.#links.size,
      groups: this.#groups.size,
    };
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
   *   remains in the registry and accepts new attachments — except a memo
   *   signal `{attach}`ed inside an effect body, which belongs to that
   *   effect and dies with it, name included.
   * - Child groups are recursively `off()`'d (not cleared).
   *
   * Use this when a component-style group should be paused/swapped without
   * losing its signal identities. For a full teardown use `clear()`.
   *
   * A throwing cleanup callback or listener does not abort the teardown: every
   * failure is collected, the remaining work runs to the end, and the errors
   * are re-raised afterwards — a lone one unchanged, several as an
   * `AggregateError` holding them in teardown order.
   */
  off(): void {
    if (this.#busy & BUSY_OFF) return;
    this.#busy |= BUSY_OFF;

    try {
      // Nothing below may abort the teardown: a half-`off()` group keeps
      // effects running and links subscribed with no way left to reach them.
      const errors: unknown[] = [];

      // Recurse into child groups first (depth-first, mirrors clear()).
      // Snapshots throughout — a destroy hook may mutate the sets underneath.
      for (const childGroup of [...this.#groups]) {
        try {
          childGroup.off();
        } catch (err) {
          errors.push(err);
        }
      }

      // Destroy own effects: their cleanup callbacks fire, their signal-queue
      // subscriptions are removed via EffectImpl.destroy().
      for (const effect of [...this.#effects]) {
        try {
          effect.destroy();
        } catch (err) {
          errors.push(err);
        }
      }
      this.#effects.clear();

      // Destroy own links: they unsubscribe from their source signals.
      for (const link of [...this.#links]) {
        try {
          link.destroy();
        } catch (err) {
          errors.push(err);
        }
      }
      this.#links.clear();

      // Soft-detach: notify any remaining external subscribers (effects/links
      // not attached to this group) that they should drop their subscription
      // to each group signal. The signal itself stays alive and usable; an
      // external effect whose only dependency was a group signal destroys
      // itself via EffectImpl[$destroySignal].
      for (const si of [...this.#signals]) {
        if (!si.destroyed) {
          try {
            emit(globalDestroySignalQueue, si.id, si.id, {detach: true});
          } catch (err) {
            errors.push(err);
          }
        }
      }

      // Signals, named-signal lookup, signal-key map, and child-group set
      // are intentionally left intact — the group remains reusable.

      try {
        emit(this, OFF, this);
      } catch (err) {
        errors.push(err);
      }

      throwCollectedErrors(errors, 'switching off a signal group');
    } finally {
      this.#busy &= ~BUSY_OFF;
    }
  }

  /**
   * Clear this group, destroying all attached signals, effects, links, and child groups.
   * Also removes this group from the global store and detaches from parent.
   *
   * A throwing cleanup callback or `DESTROY` listener does not abort the
   * teardown: every failure is collected, the group is dismantled to the end
   * and deregistered, and the errors are re-raised afterwards — a lone one
   * unchanged, several as an `AggregateError` holding them in teardown order.
   * This matters most where nobody is listening: `clear()` also runs from the
   * FinalizationRegistry callback, out of reach of any application try/catch —
   * there, the error is reported via `console.error` instead of escaping.
   */
  clear() {
    if (this.#busy & BUSY_CLEAR) return;
    this.#busy |= BUSY_CLEAR;

    try {
      const errors: unknown[] = [];

      try {
        emit(this, DESTROY, this);
      } catch (err) {
        errors.push(err);
      }
      off(this);

      // Snapshots throughout: a destroyed effect takes itself out of
      // `#effects`, a destroyed signal out of `#signals`, mid-loop.
      for (const childGroup of [...this.#groups]) {
        try {
          childGroup.clear();
        } catch (err) {
          errors.push(err);
        }
      }

      for (const effect of [...this.#effects]) {
        try {
          effect.destroy();
        } catch (err) {
          errors.push(err);
        }
      }

      for (const signal of [...this.#signals]) {
        try {
          destroySignal(signal);
        } catch (err) {
          errors.push(err);
        }
      }

      for (const link of [...this.#links]) {
        try {
          link.destroy();
        } catch (err) {
          errors.push(err);
        }
      }

      for (const unsubscribe of [
        ...this.#signalDestroySubscriptions.values(),
      ]) {
        unsubscribe();
      }
      this.#signalDestroySubscriptions.clear();

      this.#groups.clear();
      this.#signals.clear();
      this.#namedSignals.clear();
      this.#otherSignals.clear();
      this.#directSignals.clear();
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

      // Last — the group is fully dismantled and deregistered by now, so the
      // throw can no longer leave anything half-torn-down behind.
      throwCollectedErrors(errors, 'clearing a signal group');
    } finally {
      this.#busy &= ~BUSY_CLEAR;
    }
  }
}
