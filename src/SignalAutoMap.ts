import {batch} from './batch.js';
import {createSignal} from './createSignal.js';
import {Signal} from './Signal.js';

export type SignalAutoMapKeyType = string | symbol;

/**
 * A Map-like container that automatically creates signals for keys on first access.
 *
 * Useful for dynamic scenarios where signal keys are not known ahead of time,
 * such as mapping component props to signals.
 */
export class SignalAutoMap {
  /**
   * Create a SignalAutoMap pre-populated with signals from an object's properties.
   * @param obj - The source object
   * @param propKeys - Optional array of specific keys to include (defaults to all enumerable keys)
   * @returns A new SignalAutoMap with signals for each property
   */
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

  /**
   * Get an iterator over all keys in the map.
   */
  keys(): IterableIterator<SignalAutoMapKeyType> {
    return this.#signals.keys();
  }

  /**
   * Get an iterator over all signals in the map.
   */
  signals(): IterableIterator<Signal<any>> {
    return this.#signals.values();
  }

  /**
   * Get an iterator over [key, signal] pairs.
   */
  entries(): IterableIterator<[SignalAutoMapKeyType, Signal<any>]> {
    return this.#signals.entries();
  }

  /**
   * Destroy all signals and clear the map.
   */
  clear() {
    for (const sig of this.#signals.values()) {
      sig.destroy();
    }
    this.#signals.clear();
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
   * Deleting an unknown key is a no-op. Deleting an entry whose signal was
   * already destroyed from the outside still removes the entry and reports
   * `true`; destroying a destroyed signal is a no-op.
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
    // whatever the re-entrant call had just stored.
    this.#signals.delete(key);
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
      const signal = createSignal<T>();
      this.#signals.set(key, signal);
      return signal;
    }
    return this.#signals.get(key)!;
  }

  /**
   * Update multiple signals from a Map, batching all updates together.
   * Creates signals for keys that don't exist.
   * @param props - Map of key-value pairs to update
   */
  update(props: Map<any, unknown>): void {
    if (props.size) {
      batch(() => {
        for (const [key, val] of props.entries()) {
          this.get(key as any).set(val);
        }
      });
    }
  }

  /**
   * Update multiple signals from an object's properties, batching all updates together.
   * Creates signals for keys that don't exist.
   * @param obj - The source object
   * @param propKeys - Optional array of specific keys to update (defaults to all enumerable keys)
   */
  updateFromProps<PropsObjType extends object>(
    obj: PropsObjType,
    propKeys?: (keyof PropsObjType)[],
  ): void {
    const entries = propKeys
      ? propKeys.map((key) => [key, obj[key]])
      : Object.entries(obj);
    if (entries.length === 0) {
      return;
    }
    batch(() => {
      for (const [key, value] of entries) {
        this.get(key as any).set(value);
      }
    });
  }
}
