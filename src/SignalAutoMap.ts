import {on} from '@spearwolf/eventize';
import {batch} from './batch.js';
import {$autoMapResources} from './constants.js';
import {createSignal} from './createSignal.js';
import {globalDestroySignalQueue} from './global-queues.js';
import type {Signal} from './Signal.js';
import {signalImpl} from './signal-core.js';
import {reportSignalizeError} from './signalize-error.js';

export type SignalAutoMapKeyType = string | symbol;

type AutoMapResources = {unsubs: Set<() => void>};

// MEM-007: what has to happen when a map is collected without its `clear()`
// ever running. The held value is resources only — the unsubscribe handles of
// the per-entry destroy-queue subscriptions. None of them reaches the map:
// each handle closes over the listener, and the listener knows its map
// through a WeakRef (see `#create`), so this registration does not undo what
// that WeakRef achieves. Without it the leak only moves: measured over 200
// collected maps with two entries each, 400 listeners stay on
// `globalDestroySignalQueue` for the lifetime of the process.
const autoMapResourceFinalizer = new FinalizationRegistry<AutoMapResources>(
  (resources) => {
    for (const unsubscribe of resources.unsubs) {
      try {
        unsubscribe();
      } catch (err) {
        // A throw out of a FinalizationRegistry callback has no caller to
        // reach — it would take the process down. So it goes out on the
        // named diagnostics channel (`onSignalizeError()`, console without a
        // handler), same as the link and group finalizers.
        reportSignalizeError({
          level: 'error',
          source: 'automap-finalizer',
          message:
            '[signalize] releasing the destroy-queue subscriptions of a collected SignalAutoMap failed:',
          error: err,
        });
      }
    }
    resources.unsubs.clear();
  },
);

/**
 * A Map-like container that automatically creates signals for keys on first access.
 *
 * Useful for dynamic scenarios where signal keys are not known ahead of time,
 * such as mapping component props to signals.
 *
 * The map follows the lifetime of the signals it hands out: destroying an
 * entry's signal from the outside — `destroySignal(sig)`, `sig.destroy()`, or
 * the group it is attached to — removes the entry in the same synchronous
 * turn (MEM-007). `has(key)` is `false` immediately afterwards and `get(key)`
 * creates a fresh, live signal. A soft detach (`SignalGroup#off()`) is not a
 * destruction and leaves the entry alone.
 */
export class SignalAutoMap {
  /**
   * Create a SignalAutoMap pre-populated with signals from an object's properties.
   * @param obj - The source object
   * @param propKeys - Optional array of specific keys to include (defaults to all enumerable keys).
   *   Only `string` and `symbol` keys can be named: the map is keyed on
   *   {@link SignalAutoMapKeyType}, so a numeric key collapses to `never` and
   *   `TS2322: Type 'number' is not assignable to type 'never'` means exactly
   *   that (TYPE-005).
   * @returns A new SignalAutoMap with signals for each property
   */
  static fromProps<PropsObjectType extends object>(
    obj: PropsObjectType,
    propKeys?: Extract<keyof PropsObjectType, SignalAutoMapKeyType>[],
  ): SignalAutoMap {
    const sm = new SignalAutoMap();
    // The annotation is load-bearing: inferred from the array literal, the
    // element type would widen to include the property values and force a
    // cast back onto `#create()`.
    const entries: [SignalAutoMapKeyType, unknown][] = propKeys
      ? [...new Set(propKeys)].map((key) => [key, obj[key]])
      : Object.entries(obj);
    for (const [key, value] of entries) {
      // Through `#create()`, not straight into `#signals`: an entry that
      // skipped the hook would behave differently from every other one
      // depending on where it came from.
      sm.#create(key, value);
    }
    return sm;
  }

  /** @internal */
  readonly [$autoMapResources]: AutoMapResources = {unsubs: new Set()};

  #signals = new Map<SignalAutoMapKeyType, Signal<any>>();
  #unsubs = new Map<SignalAutoMapKeyType, () => void>();
  #selfRef = new WeakRef(this);

  constructor() {
    autoMapResourceFinalizer.register(this, this[$autoMapResources], this);
  }

  #create<T>(key: SignalAutoMapKeyType, initialValue?: unknown): Signal<T> {
    const signal = createSignal<T>(initialValue as T);
    this.#signals.set(key, signal);
    // MEM-007: `on`, not `once` — the same queue carries the soft-detach
    // emit from `SignalGroup#off()`, and a `once` would be consumed by that
    // one, leaving nobody to hear the real destruction later.
    //
    // Both captures are deliberate: `selfRef` is a WeakRef and `key` is a
    // primitive. `globalDestroySignalQueue` is a module-level object and
    // holds this listener for as long as the subscription lives, so a strong
    // `this` would make every SignalAutoMap — and every value it stores —
    // reachable from a GC root. Measured: 200 of 200 maps survive with a
    // strong `this`, 0 of 200 through the WeakRef.
    //
    // Nothing else from this scope may end up in the closure. V8 allocates
    // one context per scope, shared by every inner function, so a second
    // closure referencing `signal` or `this` would drag them back in and
    // quietly undo this. There is exactly one inner function here — keep it
    // that way. `SignalAutoMap.gc.spec.ts` pins it: a second one that reads
    // `signal` keeps 50 of 50 SignalImpls, and their values, alive.
    //
    // No identity guard in the listener (compare the signal id against
    // what is under `key` now, in case an earlier subscriber of the same
    // destroy emit already put a fresh entry there). On every path where
    // this class creates a signal, this listener is the first subscriber
    // for that id — the id comes into existence in the statement above —
    // and eventize does not deliver to a listener unsubscribed during the
    // same emit, which `#drop()` does before anything else can run. The one
    // path where "first subscriber" does not hold is `fromProps()` with a
    // value that already is a signal: `createSignal(sig)` returns it
    // unchanged, so it may carry older subscribers, and a cleanup of one of
    // those calling `get(key)` sees the entry still in place and gets the
    // dying signal back rather than a fresh one. That is a stale read in a
    // corner nobody has asked for; it leaks nothing and throws nothing, and
    // buying it off would cost a branch no test can drive.
    const selfRef = this.#selfRef;
    const unsubscribe = on(
      globalDestroySignalQueue,
      signalImpl(signal).id,
      (_id: symbol, params?: {detach?: boolean}) => {
        if (params?.detach) return;
        // Spelled out rather than `selfRef.deref()?.#drop(key)`: TypeScript
        // rejects a private identifier inside an optional chain (TS18030).
        // The `undefined` side is not dead code — a map can be collected
        // while a signal it handed out is still alive, and the destroy of
        // that signal can arrive before the resource finalizer has taken
        // this listener off the queue. `SignalAutoMap.gc.spec.ts` drives
        // exactly that window.
        const self = selfRef.deref();
        if (self !== undefined) {
          self.#drop(key);
        }
      },
    );
    this.#unsubs.set(key, unsubscribe);
    this[$autoMapResources].unsubs.add(unsubscribe);
    return signal;
  }

  // Remove an entry and its subscription, without destroying the signal.
  #drop(key: SignalAutoMapKeyType): void {
    // Invariant: every key in `#signals` has a handle in `#unsubs`. Both are
    // written only in `#create()` and removed only here.
    const unsubscribe = this.#unsubs.get(key);
    unsubscribe();
    this.#unsubs.delete(key);
    this[$autoMapResources].unsubs.delete(unsubscribe);
    this.#signals.delete(key);
  }

  /**
   * Get an iterator over all keys in the map.
   */
  keys(): IterableIterator<SignalAutoMapKeyType> {
    return this.#signals.keys();
  }

  /**
   * Get an iterator over all signals in the map.
   *
   * The map is heterogeneous, so the elements come out as `Signal<unknown>`.
   */
  signals(): IterableIterator<Signal<unknown>> {
    return this.#signals.values();
  }

  /**
   * Get an iterator over [key, signal] pairs.
   *
   * The map is heterogeneous, so the signals come out as `Signal<unknown>`.
   */
  entries(): IterableIterator<[SignalAutoMapKeyType, Signal<unknown>]> {
    return this.#signals.entries();
  }

  /**
   * Destroy all signals and clear the map.
   */
  clear() {
    // Drop every entry (and its hook) first, then destroy the snapshot: the
    // same order `delete()` uses, and it keeps a destroy from firing a hook
    // that is about to be removed anyway.
    const signals = [...this.#signals.values()];
    for (const key of [...this.#signals.keys()]) {
      this.#drop(key);
    }
    for (const sig of signals) {
      sig.destroy();
    }
  }

  /**
   * Destroy the signal stored under `key` and remove its entry.
   *
   * The signal is destroyed, not merely evicted: every effect reading it is
   * notified, and an effect left without a single live dependency destroys
   * itself. Whoever still holds the `Signal` object holds a corpse — reads
   * return the last value, writes notify nobody (see `clear()` and the note
   * on externally destroyed entries).
   *
   * Deleting an unknown key is a no-op — and since MEM-007 that includes a
   * key whose signal was destroyed from the outside: the entry left the map
   * with its signal, so `delete()` reports `false`. `Map.prototype.delete`
   * semantics are unchanged; the precondition is what disappeared.
   *
   * The entry is dropped before the signal is destroyed, so an effect
   * cleanup that runs as part of that destroy (its dependency just died) and
   * calls `get(key)` again gets a fresh, live signal — and that signal stays
   * in the map. `has(key)` is `true` again once `delete()` returns, and the
   * key count is back up by one.
   *
   * @param key - The key to remove
   * @returns `true` if the key was in the map, `false` otherwise — the same
   *   contract as `Map.prototype.delete`
   */
  delete(key: SignalAutoMapKeyType): boolean {
    const signal = this.#signals.get(key);
    if (signal === undefined) return false;
    // Drop the entry *before* destroying it. The destroy emit runs effect
    // cleanups, and one of those may call get(key) again: with the entry
    // already gone that call hands out a fresh, live signal which stays in
    // the map. The other order hands out the corpse and then deletes
    // whatever the re-entrant call had just stored. Since MEM-007 the order
    // is doubly motivated: `#drop()` takes the destroy hook off the queue
    // before the destroy below could make it fire.
    this.#drop(key);
    signal.destroy();
    return true;
  }

  /**
   * Check if a signal exists for the given key.
   * @param key - The key to check
   */
  has(key: SignalAutoMapKeyType): boolean {
    return this.#signals.has(key);
  }

  /**
   * Get or create a signal for the given key.
   * If the signal doesn't exist, it will be automatically created.
   * @param key - The key to get the signal for
   * @returns The signal (existing or newly created)
   */
  get<T = unknown>(key: SignalAutoMapKeyType): Signal<T> {
    if (!this.#signals.has(key)) {
      return this.#create<T>(key);
    }
    return this.#signals.get(key)!;
  }

  /**
   * Update multiple signals from a Map, batching all updates together.
   * Creates signals for keys that don't exist.
   * @param props - Map of key-value pairs to update. Keys are
   *   {@link SignalAutoMapKeyType} — a `Map<number, …>` is rejected, because
   *   `keys()` would afterwards claim `string | symbol` for it (TYPE-005).
   */
  update(props: Map<SignalAutoMapKeyType, unknown>): void {
    if (props.size) {
      batch(() => {
        for (const [key, val] of props.entries()) {
          this.get(key).set(val);
        }
      });
    }
  }

  /**
   * Update multiple signals from an object's properties, batching all updates together.
   * Creates signals for keys that don't exist.
   * @param obj - The source object
   * @param propKeys - Optional array of specific keys to update (defaults to all enumerable keys).
   *   Same restriction as {@link SignalAutoMap.fromProps}: only `string` and
   *   `symbol` keys can be named, and a numeric one collapses to `never`
   *   (TYPE-005).
   */
  updateFromProps<PropsObjType extends object>(
    obj: PropsObjType,
    propKeys?: Extract<keyof PropsObjType, SignalAutoMapKeyType>[],
  ): void {
    const entries: [SignalAutoMapKeyType, unknown][] = propKeys
      ? propKeys.map((key) => [key, obj[key]])
      : Object.entries(obj);
    if (entries.length === 0) {
      return;
    }
    batch(() => {
      for (const [key, value] of entries) {
        this.get(key).set(value);
      }
    });
  }
}
