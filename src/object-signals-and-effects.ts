import {destroySignal} from './createSignal.js';
import {Effect} from './Effect.js';
import {Signal} from './Signal.js';

interface ObjectStore {
  signals?: Map<string | symbol, Signal<any>>;
  // TODO remove effects from ObjectStore
  effects?: Map<string | symbol, Effect>;
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

// TODO remove from public API
export const saveObjectSignal = (
  obj: any,
  name: string | symbol,
  signal: Signal<any>,
) => {
  const store = getStore(obj);
  store.signals ??= new Map();
  store.signals.set(name, signal);
};

// TODO remove from public API
export const queryObjectEffect = (obj: any, name: string | symbol) =>
  g_objectStores.get(obj)?.effects?.get(name);

// TODO remove from public API
export const saveObjectEffect = (
  obj: any,
  name: string | symbol,
  effect: Effect,
) => {
  const store = getStore(obj);
  store.effects ??= new Map();
  store.effects.set(name, effect);
};

// TODO support signal-readers as well
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

export function destroyEffects(...objects: any[]): void {
  for (const obj of objects) {
    if (g_objectStores.has(obj)) {
      const store = g_objectStores.get(obj);
      if (store.effects) {
        for (const effect of store.effects.values()) {
          effect.destroy();
        }
        store.effects.clear();
        store.effects = undefined;
      }
    }
  }
}

// TODO support signal-readers as well
export function destroySignalsAndEffects(...objects: any[]): void {
  for (const obj of objects) {
    if (g_objectStores.has(obj)) {
      destroySignals(obj);
      destroyEffects(obj);
      g_objectStores.delete(obj);
    }
  }
}
