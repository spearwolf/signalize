import {Signal} from './Signal.js';
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

export const findObjectSignals = <O extends object>(
  obj: O,
): Signal<unknown>[] | undefined => {
  const signals = g_objectStores.get(obj)?.signals;
  if (signals) {
    return Array.from(signals.values());
  }
  return undefined;
};

export const findObjectSignalNames = <O extends object>(
  obj: O,
): (string | symbol)[] | undefined => {
  const signals = g_objectStores.get(obj)?.signals;
  if (signals) {
    return Array.from(signals.keys());
  }
  return undefined;
};

export const storeAsObjectSignal = (
  obj: any,
  name: string | symbol,
  signal: Signal<any>,
) => {
  const store = getObjStore(obj);
  store.signals ??= new Map();
  store.signals.set(name, signal);
};

export function destroyObjectSignals(...objects: object[]): void {
  for (const obj of objects) {
    if (g_objectStores.has(obj)) {
      const store = g_objectStores.get(obj);
      if (store.signals) {
        for (const sig of store.signals.values()) {
          destroySignal(sig);
        }
        store.signals.clear();
        store.signals = undefined;
      }
    }
  }
}
