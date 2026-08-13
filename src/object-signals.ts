import {collect, throwCollectedErrors} from './collect-errors.js';
import type {Signal} from './Signal.js';
import {destroySignal} from './signal-core.js';

interface ObjectStore {
  signals?: Map<string | symbol, Signal<any>>;
}

const g_objectStores = new WeakMap<object, ObjectStore>();

const getObjStore = (obj: object): ObjectStore => {
  let store = g_objectStores.get(obj);
  if (!store) {
    store = {};
    g_objectStores.set(obj, store);
  }
  return store;
};

/**
 * The signal registered on `obj` under `name`, or `undefined`.
 *
 * `undefined` covers both misses and does not tell them apart: an object
 * that never had a signal store, and a name that is not in the one it has.
 * `docs/api.md`, "Object signals".
 */
export const findObjectSignalByName = <O extends object, K extends keyof O>(
  obj: O,
  name: K,
): Signal<O[K]> | undefined =>
  g_objectStores.get(obj)?.signals?.get(name as any);

/**
 * The non-generic lookup the `@signal` decorator uses.
 *
 * `findObjectSignalByName` is keyed on `K extends keyof O`, which forces a
 * caller holding a plain `string | symbol` to lie about it. This one takes
 * the key as what it is and hands back a signal whose value type it cannot
 * know.
 *
 * @internal
 */
export const findObjectSignal = (
  obj: object,
  name: string | symbol,
): Signal<unknown> | undefined => g_objectStores.get(obj)?.signals?.get(name);

/**
 * Every signal registered on `obj`, or `undefined` when there are none.
 *
 * `undefined`, never an empty array. Use `findObjectSignalByName` when the
 * value type matters.
 */
export const findObjectSignals = <O extends object>(
  obj: O,
): Signal<unknown>[] | undefined => {
  const signals = g_objectStores.get(obj)?.signals;
  if (signals) {
    return Array.from(signals.values());
  }
  return undefined;
};

/**
 * The names every signal on `obj` is registered under, or `undefined` when
 * there are none — same `undefined`-instead-of-empty rule as
 * {@link findObjectSignals}. Insertion order, which is the order the
 * decorated fields were first written.
 */
export const findObjectSignalNames = <O extends object>(
  obj: O,
): (string | symbol)[] | undefined => {
  const signals = g_objectStores.get(obj)?.signals;
  if (signals) {
    return Array.from(signals.keys());
  }
  return undefined;
};

/**
 * Register `signal` on `obj` under `name`, creating the store on demand.
 *
 * The write side of {@link findObjectSignal}; the only caller is the
 * `@signal` decorator. An entry already sitting under the same name is
 * replaced, not destroyed.
 *
 * @internal
 */
export const storeAsObjectSignal = (
  obj: any,
  name: string | symbol,
  signal: Signal<any>,
) => {
  const store = getObjStore(obj);
  store.signals ??= new Map();
  store.signals.set(name, signal);
};

/**
 * Destroy every signal registered on each of `objects` and drop their
 * stores.
 *
 * An unknown object is skipped silently, so a second call is a no-op. This
 * reaches the signals only — `SignalGroup.delete(obj)` is the one that
 * takes the object's group, and any effect or link in it, too.
 *
 * @throws A lone failing effect cleanup unchanged, several as an
 *   `AggregateError` in teardown order. `docs/api.md`, "Object signals",
 *   `destroyObjectSignals(...objs)`.
 */
export function destroyObjectSignals(...objects: object[]): void {
  const errors: unknown[] = [];
  for (const obj of objects) {
    if (g_objectStores.has(obj)) {
      const store = g_objectStores.get(obj);
      if (store.signals) {
        for (const sig of store.signals.values()) {
          collect(errors, () => destroySignal(sig));
        }
        store.signals.clear();
        store.signals = undefined;
      }
    }
  }
  // Outside the object loop: the contract holds across all `...objects`, not
  // per object.
  throwCollectedErrors(errors, 'destroying the signals of an object');
}
