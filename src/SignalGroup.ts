import {
  type EventizedObject,
  emit,
  eventize,
  off,
  on,
  once,
  Priority,
} from '@spearwolf/eventize';
import {collect, throwCollectedErrors} from './collect-errors.js';
import {$effect, DESTROY, OFF} from './constants.js';
import {warnDeprecatedOnce} from './deprecation-warnings.js';
import type {Effect} from './Effect.js';
import type {EffectImpl} from './EffectImpl.js';
import {globalDestroySignalQueue} from './global-queues.js';
import type {Signal} from './Signal.js';
import type {SignalLink} from './SignalLink.js';
import {destroySignal, signalImpl} from './signal-core.js';
import {reportSignalizeError} from './signalize-error.js';
import type {ISignalImpl, SignalLike} from './types.js';

// Lookup map: user-object → SignalGroup. WeakMap so that user objects are not
// kept alive by the registry — once the user object is unreachable, its entry
// can be reclaimed.
const store = new WeakMap<object, SignalGroup>();

// Iteration set: holds a WeakRef per live SignalGroup so the static `clear()`
// can walk all groups. Weak, not strong (MEM-003): a plain `Set` here is a
// module-level GC root for every group ever created, and a group reaches its
// host through anything attached to it — an `@signal accessor` whose value is
// `this` was enough to keep 1000 of 1000 hosts alive. Dead husks are dropped
// by the group's own resource finalizer below, and skipped by the two readers
// as a safety net. SignalGroups remove themselves from this set in their
// instance `clear()`.
const allGroups = new Set<WeakRef<SignalGroup>>();

type GroupResources = {
  selfRef?: WeakRef<SignalGroup>;
  unsubs: Set<() => void>;
};

/**
 * @internal Test seam for the resource finalizer in `SignalGroup.gc.spec.ts`.
 */
export const $groupResources = Symbol.for(
  '@spearwolf/signalize/groupResources',
);

// MEM-003: what has to happen when a group is collected *without* its
// `clear()` ever running — the price of holding the two roots above weakly.
// The held value is resources only: the unsubscribe handles of the group's
// per-signal destroy-queue subscriptions, plus the WeakRef this group is
// filed under. Neither reaches the group (the listener closures know it
// through a WeakRef, see `#addSignal`), so this registration does not undo
// what the WeakRefs achieve. Without it the leak only moves: measured over
// 1000 collected groups, 2000 listeners stay on `globalDestroySignalQueue`
// for the lifetime of the process.
//
// Order is load-bearing: handles first, husk second. A GC test that waits for
// `getSignalGroupsCount()` to fall back to its baseline then knows every
// release has already run and needs no second settle step.
const groupResourceFinalizer = new FinalizationRegistry<GroupResources>(
  (resources) => {
    for (const unsubscribe of resources.unsubs) {
      try {
        unsubscribe();
      } catch (err) {
        // A throw out of a FinalizationRegistry callback has no caller to
        // reach — it would take the process down. So it goes out on the
        // named diagnostics channel (`onSignalizeError()`, console without a
        // handler), same as `clearGroupFromFinalizer` below.
        reportSignalizeError({
          level: 'error',
          source: 'group-finalizer',
          message:
            '[signalize] releasing the destroy-queue subscriptions of a collected SignalGroup failed:',
          error: err,
        });
      }
    }
    resources.unsubs.clear();
    if (resources.selfRef != null) {
      allGroups.delete(resources.selfRef);
    }
  },
);

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
// worse still: a throwing cleanup would stay invisible forever. So it goes
// out on the named diagnostics channel instead, never re-thrown — an
// `onSignalizeError()` handler can route it, and without one it lands on
// `console.error` as it always did. This is the one path in the package
// where `clear()` runs without a caller at all — everywhere else the caller
// gets its error unchanged.
/**
 * @internal Exported for the regression test in `SignalGroup.teardown.spec.ts`.
 */
export const clearGroupFromFinalizer = (group: SignalGroup): void => {
  // The group is asked for its own WeakRef rather than scanned for: with a
  // `Set<WeakRef<SignalGroup>>` a membership test on the group itself would
  // be a linear walk over every live group.
  const selfRef = group[$groupResources].selfRef;
  if (selfRef == null || !allGroups.has(selfRef)) return;
  try {
    group.clear();
  } catch (err) {
    reportSignalizeError({
      level: 'error',
      source: 'group-finalizer',
      message:
        '[signalize] a SignalGroup teardown threw in the FinalizationRegistry callback, where no caller can catch it:',
      error: err,
    });
  }
};

const groupFinalizationRegistry = new FinalizationRegistry<
  WeakRef<SignalGroup>
>((groupRef) => {
  // MEM-003: the held value is a WeakRef, not the group. As the group
  // itself, it kept the group alive, the group kept the host alive through
  // anything attached to it, and this callback never ran. Measured in
  // isolation: 200 registrations whose held value points at the target
  // produce 200 survivors and 0 callbacks; through a WeakRef, 0 survivors
  // and 200 callbacks.
  const group = groupRef.deref();
  if (group !== undefined) clearGroupFromFinalizer(group);
});

/**
 * Get the current count of live SignalGroups.
 * Useful for debugging and detecting leaks (e.g. a forgotten `clear()` or
 * `delete()`).
 *
 * A group that was collected together with its host is not counted, even
 * before its resource finalizer has run: the husk is dropped on the way past.
 * `Set.prototype.delete` during the set's own iteration is specified and safe.
 */
export const getSignalGroupsCount = (): number => {
  let count = 0;
  for (const ref of allGroups) {
    if (ref.deref() === undefined) {
      allGroups.delete(ref);
    } else {
      count += 1;
    }
  }
  return count;
};

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
// graph is a forest for every edge that goes through it — `[$setParentGroup]`
// is the one that does not, and `Symbol.for` keeps it reachable from the
// built bundle, not just from these tests. The walks below must survive a
// broken invariant anyway:
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
  '[signalize] Cannot attach a group to one of its own descendants: this would create a cycle in the group graph';

// PERF-004: the rarely used containers are only allocated on first write.
// Until then the field points at a module-wide shared empty stand-in — not
// at `undefined`.
//
// That is the whole reason for the design: every read path stays
// unchanged. `.size` is 0, `.has()`/`.get()` answer like an empty
// container, `.delete()` and `.clear()` are no-ops, iteration yields
// nothing. Three promises therefore hold by themselves that `undefined`
// would each break on its own: `memberCounts` still answers with 0; the
// `once(…, DESTROY, Priority.Max, …)` hooks from `attachEffect()` and
// `attachLink()` — which run ahead of every application listener below
// `Priority.Max`, though not ahead of one registered there first, see the
// note at `attachLink()` — cannot throw at the head of an eventize
// delivery and abort it for everyone; and a hook that fires after a
// `clear()` still finds something there.
//
// The stand-ins reject every write that would make them non-empty. A
// forgotten take-over would otherwise fill a container that every
// SignalGroup in the process shares — the loudest failure is the cheapest
// one here.
const SHARED_EMPTY_WRITE =
  '[signalize] internal error: a shared empty stand-in collection was written to';

class EmptySet extends Set<any> {
  add(): never {
    throw new Error(SHARED_EMPTY_WRITE);
  }
}
class EmptyMap extends Map<any, any> {
  set(): never {
    throw new Error(SHARED_EMPTY_WRITE);
  }
}
class EmptyWeakMap extends WeakMap<object, any> {
  set(): never {
    throw new Error(SHARED_EMPTY_WRITE);
  }
}
class EmptyWeakSet extends WeakSet<object> {
  add(): never {
    throw new Error(SHARED_EMPTY_WRITE);
  }
}

const EMPTY_SET: Set<any> = new EmptySet();
const EMPTY_MAP: Map<any, any> = new EmptyMap();
const EMPTY_WEAK_MAP: WeakMap<any, any> = new EmptyWeakMap();
const EMPTY_WEAK_SET: WeakSet<any> = new EmptyWeakSet();

const ownSet = <T>(collection: Set<T>): Set<T> =>
  collection === EMPTY_SET ? new Set<T>() : collection;
const ownMap = <K, V>(collection: Map<K, V>): Map<K, V> =>
  collection === EMPTY_MAP ? new Map<K, V>() : collection;
const ownWeakMap = <K extends object, V>(
  collection: WeakMap<K, V>,
): WeakMap<K, V> =>
  collection === EMPTY_WEAK_MAP ? new WeakMap<K, V>() : collection;
const ownWeakSet = <T extends object>(collection: WeakSet<T>): WeakSet<T> =>
  collection === EMPTY_WEAK_SET ? new WeakSet<T>() : collection;

/**
 * @internal Test seam for the four stand-ins above.
 *
 * Their `add`/`set` overrides are unreachable from every other route, and
 * an unreachable method is one nobody notices when it stops throwing.
 * `src/index.ts` re-exports `SignalGroup.ts` by name, so this stays out
 * of the public entry point.
 */
export const SHARED_EMPTY_COLLECTIONS = {
  set: EMPTY_SET,
  map: EMPTY_MAP,
  weakMap: EMPTY_WEAK_MAP,
  weakSet: EMPTY_WEAK_SET,
};

/**
 * A container for managing the lifecycle of signals, effects, links, and
 * child groups.
 *
 * SignalGroups provide automatic cleanup - when a group is cleared, all
 * attached signals, effects, links, and child groups are destroyed. Groups
 * can be nested hierarchically for scoped lifecycle management.
 *
 * Use `SignalGroup.findOrCreate(object)` to create or retrieve a group
 * associated with any object, enabling component-based lifecycle management.
 */
// Eventize injects EventizedObject members at runtime via eventize(this) in
// the constructor — declaration merging tells TS the brand is present.
export interface SignalGroup extends EventizedObject {}

export class SignalGroup {
  #groups: Set<SignalGroup> = EMPTY_SET;

  readonly #signals = new Set<ISignalImpl>();
  // The signal a name currently resolves to — one per name.
  #namedSignals: Map<SignalNameType, ISignalImpl> = EMPTY_MAP;

  #namesBySignal: WeakMap<ISignalImpl<any>, Set<SignalNameType>> =
    EMPTY_WEAK_MAP;
  // Every signal ever bound to a name, the active one included; the fallback
  // pool `#removeSignal()` promotes from.
  #signalsByName: Map<SignalNameType, Set<ISignalImpl>> = EMPTY_MAP;

  // Signals handed to the public `attachSignal()`. They stay group-owned even
  // when a name they are bound to is rebound to another signal — signals that
  // only ever arrived through `attachSignalByName()` do not.
  #directSignals: Set<ISignalImpl> = EMPTY_SET;

  readonly #effects = new Set<EffectImpl>();

  // One `globalDestroySignalQueue` unsubscribe handle per attached signal
  // (MEM-002): the group has to hear about a signal it holds being destroyed,
  // or a long-lived group accumulates dead SignalImpls until `clear()`.
  #signalDestroySubscriptions: Map<ISignalImpl, () => void> = EMPTY_MAP;

  // MEM-003: symbol-keyed rather than `#private` for the same reason as
  // `$queueUnsubscribes` in `SignalLink` — the module-level finalizer and
  // guard have to reach it, a `#` field is out of their reach, and a public
  // named field would be new API surface.
  /** @internal */
  readonly [$groupResources]: GroupResources = {unsubs: EMPTY_SET};

  #links: Set<SignalLink<any>> = EMPTY_SET;

  // MEM-002: which links this group has already registered its DESTROY
  // counter-edge for. Not `#links.has(link)` as the guard: `detachLink()` is
  // public API and takes a *live* link back out, so every detach/attach
  // cycle would append another listener. And not a second `Set` either: that
  // would be a new strong holder for exactly the links `detachLink()` just
  // released.
  #linksWithDestroyHook: WeakSet<SignalLink<any>> = EMPTY_WEAK_SET;

  #parentGroup?: SignalGroup;

  #busy = 0;

  // Held weakly so that the SignalGroup does not pin the user object: if the
  // user drops their reference, the user object becomes GC-eligible even
  // though the SignalGroup is still referenced from `allGroups`.
  #storeKey?: WeakRef<object>;

  /**
   * Get an existing SignalGroup associated with an object, or undefined if
   * none exists.
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
      throw new Error('[signalize] Cannot create a group with a null object');
    }
    // PERF-002: check the store before constructing. The field initializers
    // alone allocated eleven collections — six Sets, three Maps, a WeakMap
    // and a WeakSet — plus the `[$groupResources]` wrapper object, so
    // `new SignalGroup(object)` on a cache hit built and discarded all of
    // that just to have the constructor's own `store.has()` check hand back
    // the existing instance. Since PERF-004 the cache-miss side allocates
    // three objects — `#signals`, `#effects` and the wrapper — while the
    // other nine collections point at the shared empty stand-ins until
    // something writes to them; eight of the nine are fields, the ninth is
    // the wrapper's own `unsubs`. Checked here first, this path is a plain
    // WeakMap lookup on a hit. The constructor's `store.has()` check (and
    // the `instanceof SignalGroup` early return) stay in place as the
    // authoritative safety net for a direct or re-entrant construction. They
    // guard nothing else: in a single-threaded runtime nothing can run
    // between the lookup here and the constructor's own `store.set()`, which
    // is why both of those branches are uncovered to this day.
    if (object instanceof SignalGroup) {
      return object;
    }
    return store.get(object) ?? new SignalGroup(object);
  }

  /**
   * Delete and clear the group associated with an object, and warn about it.
   *
   * Behaves exactly like {@link SignalGroup.delete}, plus a `deprecation`
   * notice — once per process, not once per call (CONS-004).
   *
   * @deprecated Use {@link SignalGroup.delete} instead.
   * @param object - The object whose group should be deleted, or the group
   */
  static destroy(object: object) {
    warnDeprecatedOnce(
      'SignalGroup.destroy',
      '[signalize] SignalGroup.destroy(obj) is deprecated. Use SignalGroup.delete(obj) instead.',
    );
    SignalGroup.delete(object);
  }

  /**
   * Delete and clear the SignalGroup associated with an object.
   * Passing a group itself works too and clears that group directly, the
   * same argument `get()` and `findOrCreate()` accept.
   * @param object - The object whose group should be deleted, or the group
   */
  static delete(object: object) {
    // API-014: a group is a valid argument for itself, exactly as in `get()`
    // and `findOrCreate()`. A group made by `findOrCreate(host)` is filed
    // under `host`, never under itself, so the store lookup alone turned
    // `SignalGroup.delete(group)` — the documented public destructor — into
    // a silent no-op. Nothing else has to be undone here: `clear()` drops
    // the store entry under the host itself, through `#storeKey`.
    if (object instanceof SignalGroup) {
      object.clear();
      return;
    }
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
    for (const ref of [...allGroups]) {
      const group = ref.deref();
      if (group === undefined) {
        allGroups.delete(ref);
        continue;
      }
      collect(errors, () => group.clear());
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

    // One WeakRef, three uses: the element in `allGroups`, the held value of
    // the host finalizer, and the way back for `clearGroupFromFinalizer()`.
    // None of them strong (MEM-003).
    const selfRef = new WeakRef(this);
    this[$groupResources].selfRef = selfRef;
    allGroups.add(selfRef);
    // Unconditionally, even for a self-keyed group: that one deliberately
    // gets no host backstop, but it holds handles on
    // `globalDestroySignalQueue` just the same, and somebody has to release
    // them now that nothing else keeps the group reachable.
    groupResourceFinalizer.register(this, this[$groupResources], this);

    // Register for auto-cleanup if the user object becomes unreachable
    // without an explicit clear/delete. Skip self-registration (when
    // object === this) — a group used as its own key cannot outlive itself.
    if (object !== this) {
      groupFinalizationRegistry.register(object, selfRef, this);
    }
    eventize(this);
  }

  /**
   * Attach a child group to this group. The child will be cleared when this
   * group is cleared.
   * @param group - The child group to attach
   * @returns The attached group
   */
  attachGroup(group: SignalGroup) {
    if (group === this) {
      throw new Error('[signalize] Cannot attach a group to itself');
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
          '[signalize] Cannot attach a group: the parent chain of this group is already cyclic',
        );
      }
    }

    (this.#groups = ownSet(this.#groups)).add(group);

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
   * Attach a signal to this group. The signal will be destroyed when the
   * group is cleared.
   * @param signal - The signal to attach
   * @returns The attached signal — the caller's own type, unchanged, so
   *   `group.attachSignal(createSignal(1))` still reads as `Signal<number>`
   */
  attachSignal<S extends SignalLike<any>>(signal: S): S {
    const si = this.#addSignal(signal);

    if (si) {
      (this.#directSignals = ownSet(this.#directSignals)).add(si);
    }

    return signal;
  }

  #addSignal(signal: SignalLike<any>): ISignalImpl | undefined {
    const si = signalImpl(signal);

    if (si?.destroyed) {
      throw new Error(
        '[signalize] Cannot attach a destroyed signal to a group',
      );
    }

    if (si) {
      this.#signals.add(si);

      if (!this.#signalDestroySubscriptions.has(si)) {
        // Deliberately `on`, not `once`: the same queue carries the
        // soft-detach emit from `off()` with `{detach: true}`, and a `once`
        // would be consumed by that one — leaving nobody to hear the real
        // destruction later.
        //
        // MEM-003: both captures are WeakRefs. `globalDestroySignalQueue` is
        // a module-level object and holds this listener for as long as the
        // subscription lives, so a strong `this` made every group with an
        // attached signal reachable from a GC root — and through the group,
        // its host. That is the third of the three roots; without it the
        // other two are worth nothing (measured: 1000 of 1000 hosts survive
        // with either one left strong).
        //
        // Nothing else in this scope may end up in the closure. V8 allocates
        // one context per scope, shared by every inner function, so a second
        // closure referencing `si` or `this` would drag them back in through
        // the context chain and quietly undo this. There is exactly one
        // inner function here — keep it that way. The same invariant, and
        // the same test shape that pins it, as in `SignalAutoMap#create()`.
        //
        // The `signal !== undefined` guard is not dead code, and unlike in
        // `SignalAutoMap` it cannot be argued away: `#addSignal()` takes a
        // foreign signal that may well have older subscribers on its id.
        const groupRef = this[$groupResources].selfRef!;
        const siRef = new WeakRef(si);
        const unsubscribe = on(
          globalDestroySignalQueue,
          si.id,
          (_id: symbol, params?: {detach?: boolean}) => {
            if (params?.detach) return;
            const signal = siRef.deref();
            const group = groupRef.deref();
            // Spelled out rather than `groupRef.deref()?.#removeSignal(…)`:
            // TypeScript rejects a private identifier inside an optional
            // chain (TS18030), the same reason `SignalAutoMap#create()`
            // spells its deref out.
            if (signal !== undefined && group !== undefined) {
              group.#removeSignal(signal);
            }
          },
        );
        (this.#signalDestroySubscriptions = ownMap(
          this.#signalDestroySubscriptions,
        )).set(si, unsubscribe);
        const resources = this[$groupResources];
        (resources.unsubs = ownSet(resources.unsubs)).add(unsubscribe);
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
      try {
        unsubscribe();
      } finally {
        this.#signalDestroySubscriptions.delete(si);
        // Out of both registers, or the held value accumulates dead handles
        // whenever signals come and go on a long-lived group.
        this[$groupResources].unsubs.delete(unsubscribe);
      }
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
    const signalsForName = this.#signalsByName.get(name);
    if (signalsForName) {
      signalsForName.delete(si);
      if (signalsForName.size === 0) {
        this.#signalsByName.delete(name);
      }
    }

    const names = this.#namesBySignal.get(si);
    if (names) {
      names.delete(name);
      if (names.size === 0) {
        this.#namesBySignal.delete(si);
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
   * @returns The attached signal — the caller's own type, unchanged — or
   *   `undefined` when called without a signal to release the name
   */
  attachSignalByName<S extends SignalLike<any>>(
    name: SignalNameType,
    signal?: S,
  ): S | undefined {
    if (signal) {
      const si = this.#addSignal(signal);

      const previous = this.#namedSignals.get(name);
      if (previous != null && previous !== si) {
        this.#displaceFromName(name, previous);
      }

      (this.#namedSignals = ownMap(this.#namedSignals)).set(name, si);

      const signalsForName = this.#signalsByName.get(name);
      if (signalsForName) {
        signalsForName.add(si);
      } else {
        (this.#signalsByName = ownMap(this.#signalsByName)).set(
          name,
          new Set([si]),
        );
      }

      if (this.#namesBySignal.has(si)) {
        this.#namesBySignal.get(si)!.add(name);
      } else {
        (this.#namesBySignal = ownWeakMap(this.#namesBySignal)).set(
          si,
          new Set([name]),
        );
      }
    } else {
      // Release *this* name from every signal listed under it — not the
      // signals from all of their names. `detachSignal()` would do the latter
      // and would also strip an explicitly attached signal of its group
      // ownership, which the rebind path deliberately preserves.
      const signalsForName = this.#signalsByName.get(name);
      if (signalsForName) {
        for (const si of [...signalsForName]) {
          this.#releaseFromName(name, si);
        }
      }
      this.#namedSignals.delete(name);
    }

    return signal;
  }

  /**
   * Check if a signal with the given name exists in this group or in a
   * parent group.
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
   *
   * Without a type argument the result is `Signal<unknown>`: a group holds
   * heterogeneous signals and cannot know what hides behind a name. Pass the
   * type you expect — `group.signal<string>('theme')`.
   *
   * @param name - The signal name to look up
   * @returns The Signal object or undefined if not found
   */
  signal<Type = unknown>(name: SignalNameType): Signal<Type> | undefined {
    if (this.#busy & BUSY_SIGNAL) return undefined;
    this.#busy |= BUSY_SIGNAL;
    try {
      return (
        // The map is keyed by name, not by type — this cast is the group
        // admitting it takes the caller's word for the value type.
        (this.#namedSignals.get(name)?.object as Signal<Type> | undefined) ??
        this.#parentGroup?.signal<Type>(name)
      );
    } finally {
      this.#busy &= ~BUSY_SIGNAL;
    }
  }

  /**
   * Detach a signal from this group (does not destroy it).
   * @param signal - The signal to detach
   * @returns The detached signal — the caller's own type, unchanged
   */
  detachSignal<S extends SignalLike<any>>(signal: S): S {
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
   * `SignalImpl` reachable through `#namedSignals`/`#signalsByName` — which is
   * the whole of the `@signal` decorator path, where `attachSignalByName()`
   * is the only way in (MEM-002).
   */
  #removeSignal(si: ISignalImpl) {
    // The unsubscribe is the one step here that can throw: the handle comes
    // from a queue this group does not own. It must not take the rest of the
    // removal with it — a signal left standing in `#signals` and
    // `#directSignals` with its destroy subscription already gone is one the
    // group can never hear about again. Same shape as `clear()` and `off()`
    // since CONS-005; a lone error comes back out unchanged, so
    // `detachSignal()` still throws exactly what the handle threw.
    const errors: unknown[] = [];
    collect(errors, () => this.#dropSignalSubscription(si));
    this.#signals.delete(si);
    this.#directSignals.delete(si);

    if (this.#namesBySignal.has(si)) {
      // signal is bound to names
      const names = this.#namesBySignal.get(si)!;
      for (const name of names) {
        // for each name
        const signalsForName = this.#signalsByName.get(name);
        if (signalsForName) {
          // remove the signal from this name's candidate set (idempotent)
          signalsForName.delete(si);

          if (signalsForName.size === 0) {
            // if there are no further signals for this name, then we can delete
            this.#namedSignals.delete(name);
            this.#signalsByName.delete(name);
          } else if (this.#namedSignals.get(name) === si) {
            // there are other signals and the signal was the active one —
            // fall back to the most recently inserted remaining signal (Set
            // preserves insertion order).
            let previous: ISignalImpl | undefined;
            for (const s of signalsForName) previous = s;
            (this.#namedSignals = ownMap(this.#namedSignals)).set(
              name,
              previous!,
            );
          }
        }
      }

      names.clear();
      this.#namesBySignal.delete(si);
    }

    throwCollectedErrors(errors, 'detaching a signal from a signal group');
  }

  /**
   * Attach an effect to this group. The effect will be destroyed when the
   * group is cleared.
   *
   * Takes both forms: the `Effect` that `createEffect()` hands out and the
   * internal instance behind it. The unwrapping happens here, so a consumer
   * no longer needs `as any` to call a documented method (API-001).
   *
   * A destroyed effect takes itself out of the group again (MEM-002) —
   * without that, a long-lived group with effect churn keeps every dead
   * `EffectImpl` and its callback closure alive until `clear()`. Because the
   * bookkeeping below hangs on the unwrapped instance, that also holds for a
   * wrapper: its `destroy()` reaches the same DESTROY the hook listens to.
   *
   * Throws on an effect that is already destroyed (CONS-006), the same rule
   * `#addSignal()` and `attachLink()` already apply: its DESTROY has fired
   * and `off(this)` has run, so the counter-hook below never fires again —
   * the group would carry the corpse and its callback closure until
   * `clear()`. One message covers three shapes of the same mistake — a dead
   * instance, a dead wrapper, and nothing at all — because they are one
   * error class, and a second wording would be a second promise.
   *
   * @param effect - The effect to attach: the wrapper or the instance
   * @returns The attached effect — the caller's own type, unchanged
   */
  attachEffect<E extends Effect | EffectImpl>(effect: E): E {
    // `$effect in effect`, not `instanceof Effect`: the latter needs a value
    // import of `Effect.ts`, which imports `EffectImpl.ts`, which imports
    // this file — `rollup.config.mjs` aborts on CIRCULAR_DEPENDENCY. The
    // property survives on a destroyed wrapper (set to `undefined`, not
    // deleted), so `in` still recognises it and `impl` falls to `undefined`.
    const impl: EffectImpl | undefined =
      effect != null && $effect in effect
        ? (effect as Effect)[$effect]
        : (effect as EffectImpl);

    if (impl == null || impl.destroyed) {
      throw new Error(
        '[signalize] Cannot attach a destroyed effect to a group',
      );
    }

    // Guarded because eventize's own dedup can't help: `add()` only dedupes
    // `LISTENER_IS_OBJ` and `LISTENER_IS_NAMED_FUNC` (method-name) listeners.
    // A function is neither, so `once()` re-adds it every call — held
    // reference or fresh arrow, same result. Unguarded, a repeated
    // `attachEffect(sameEffect)` would grow the DESTROY list without bound.
    if (!this.#effects.has(impl)) {
      this.#effects.add(impl);
      // MEM-009: the counter-edge to `attachLink()`'s hook (see its comment
      // at `Priority.Max` above). On normal priority, a higher-priority
      // application `DESTROY` listener that throws aborts eventize's
      // delivery before this line runs, and the group keeps the dead
      // `EffectImpl` and its callback closure until the next `clear()`. The
      // guarantee reaches exactly as far as the priority does — a listener
      // registered at `Priority.Max` *before* this one still wins the tie
      // and can still swallow it; every ordinary priority is covered.
      once(impl, DESTROY, Priority.Max, () => {
        this.#effects.delete(impl);
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
   * Attach a link to this group. The link will be destroyed when the group
   * is cleared.
   *
   * A destroyed link takes itself out of the group again (MEM-002),
   * whichever route attached it — `link(…, {attach})`, `link.attach(obj)`
   * or a direct `attachLink()` call.
   *
   * @param link - The link to attach
   * @returns The attached link — the caller's own type, unchanged
   */
  attachLink<L extends SignalLink<any>>(link: L): L {
    if (link?.isDestroyed) {
      throw new Error('[signalize] Cannot attach a destroyed link to a group');
    }

    if (link) {
      (this.#links = ownSet(this.#links)).add(link);
      // Guarded because eventize's own dedup can't help: `isSimilar()` only
      // covers `LISTENER_IS_OBJ` and `LISTENER_IS_NAMED_FUNC` listeners. A
      // plain function is neither, so even the same function reference
      // registered twice yields two subscriptions.
      if (!this.#linksWithDestroyHook.has(link)) {
        (this.#linksWithDestroyHook = ownWeakSet(
          this.#linksWithDestroyHook,
        )).add(link);
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
   * @returns The detached link — the caller's own type, unchanged
   */
  detachLink<L extends SignalLink<any>>(link: L): L {
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
   * question; `getGroupMemberCounts()` in `__testing__/assert-helpers.ts` is
   * its only consumer, and no production code path reads it.
   *
   * @internal
   */
  get memberCounts(): {
    signals: number;
    namedSignals: number;
    signalsByName: number;
    effects: number;
    links: number;
    groups: number;
  } {
    return {
      signals: this.#signals.size,
      namedSignals: this.#namedSignals.size,
      signalsByName: this.#signalsByName.size,
      effects: this.#effects.size,
      links: this.#links.size,
      groups: this.#groups.size,
    };
  }

  /**
   * Tear down all subscriptions of this group, and warn about it.
   *
   * Behaves exactly like {@link SignalGroup#clear} — the group itself
   * survives and stays usable — plus a `deprecation` notice, once per
   * process, not once per call (CONS-004).
   *
   * @deprecated Use {@link SignalGroup#clear} instead.
   */
  destroy() {
    warnDeprecatedOnce(
      'SignalGroup#destroy',
      '[signalize] SignalGroup#destroy is deprecated. Use SignalGroup#clear instead.',
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
        collect(errors, () => childGroup.off());
      }

      // Destroy own effects: their cleanup callbacks fire, their signal-queue
      // subscriptions are removed via EffectImpl.destroy().
      for (const effect of [...this.#effects]) {
        collect(errors, () => effect.destroy());
      }
      this.#effects.clear();

      // Destroy own links: they unsubscribe from their source signals.
      for (const link of [...this.#links]) {
        collect(errors, () => link.destroy());
      }
      this.#links.clear();

      // Soft-detach: notify any remaining external subscribers (effects/links
      // not attached to this group) that they should drop their subscription
      // to each group signal. The signal itself stays alive and usable; an
      // external effect whose only dependency was a group signal destroys
      // itself via EffectImpl[$destroySignal].
      for (const si of [...this.#signals]) {
        if (!si.destroyed) {
          collect(errors, () =>
            emit(globalDestroySignalQueue, si.id, si.id, {detach: true}),
          );
        }
      }

      // Signals, named-signal lookup, signal-key map, and child-group set
      // are intentionally left intact — the group remains reusable.

      collect(errors, () => emit(this, OFF, this));

      throwCollectedErrors(errors, 'switching off a signal group');
    } finally {
      this.#busy &= ~BUSY_OFF;
    }
  }

  /**
   * Clear this group, destroying all attached signals, effects, links, and
   * child groups. Also removes this group from the global store and detaches
   * from parent.
   *
   * A throwing cleanup callback or `DESTROY` listener does not abort the
   * teardown: every failure is collected, the group is dismantled to the end
   * and deregistered, and the errors are re-raised afterwards — a lone one
   * unchanged, several as an `AggregateError` holding them in teardown order.
   * This matters most where nobody is listening: `clear()` also runs from the
   * FinalizationRegistry callback, out of reach of any application try/catch —
   * there, the error is reported via `onSignalizeError()`, and to
   * `console.error` while nobody listens, instead of escaping.
   */
  clear() {
    if (this.#busy & BUSY_CLEAR) return;
    this.#busy |= BUSY_CLEAR;

    try {
      const errors: unknown[] = [];

      collect(errors, () => emit(this, DESTROY, this));
      off(this);

      // Snapshots throughout: a destroyed effect takes itself out of
      // `#effects`, a destroyed signal out of `#signals`, mid-loop.
      for (const childGroup of [...this.#groups]) {
        collect(errors, () => childGroup.clear());
      }

      for (const effect of [...this.#effects]) {
        collect(errors, () => effect.destroy());
      }

      for (const signal of [...this.#signals]) {
        collect(errors, () => destroySignal(signal));
      }

      for (const link of [...this.#links]) {
        collect(errors, () => link.destroy());
      }

      for (const unsubscribe of [
        ...this.#signalDestroySubscriptions.values(),
      ]) {
        collect(errors, () => unsubscribe());
      }
      this.#signalDestroySubscriptions.clear();

      this.#groups.clear();
      this.#signals.clear();
      this.#namedSignals.clear();
      this.#signalsByName.clear();
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
      allGroups.delete(this[$groupResources].selfRef!);
      // The handles themselves were released a few loops up; this only drops
      // the now-empty bookkeeping so a finalizer that still fires finds
      // nothing left to do.
      this[$groupResources].unsubs.clear();
      groupFinalizationRegistry.unregister(this);
      groupResourceFinalizer.unregister(this);

      // Last — the group is fully dismantled and deregistered by now, so the
      // throw can no longer leave anything half-torn-down behind.
      throwCollectedErrors(errors, 'clearing a signal group');
    } finally {
      this.#busy &= ~BUSY_CLEAR;
    }
  }
}
