import {destroySignal} from './createSignal.js';
import {Signal} from './Signal.js';

interface ObjectStore {
  signals?: Map<string | symbol, Signal<any>>;
}

const g_objectStores = new WeakMap<object, ObjectStore>();

const getStore = (obj: object): ObjectStore => {
  let store = g_objectStores.get(obj);
  if (!store) {
    store = {};
    g_objectStores.set(obj, store);
  }
  return store;
};

export const queryObjectSignal = <O extends object, K extends keyof O>(
  obj: O,
  name: K,
): Signal<O[K]> | undefined =>
  g_objectStores.get(obj)?.signals?.get(name as any);

export const queryObjectSignals = <O extends object>(
  obj: O,
): Signal<any>[] | undefined => {
  const signals = g_objectStores.get(obj)?.signals;
  if (signals) {
    return Array.from(signals.values());
  }
  return undefined;
};

export const getObjectSignalKeys = <O extends object>(
  obj: O,
): (string | symbol)[] | undefined => {
  const signals = g_objectStores.get(obj)?.signals;
  if (signals) {
    return Array.from(signals.keys());
  }
  return undefined;
};

export const saveObjectSignal = (
  obj: any,
  name: string | symbol,
  signal: Signal<any>,
) => {
  const store = getStore(obj);
  store.signals ??= new Map();
  store.signals.set(name, signal);
};

export function destroySignals(...objects: any[]): void {
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
