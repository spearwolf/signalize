import {destroySignal} from './createSignal.js';
import type {
  DestroyEffectCallback,
  RunEffectCallback,
  SignalReader,
} from './types.js';

interface SignalsAndEffects {
  signals: Record<string | symbol, SignalReader<any>>;
  effects: Record<
    string | symbol,
    [run: RunEffectCallback, destroy: DestroyEffectCallback]
  >;
}

const globalObjectSignalsAndEffects = new WeakMap<any, SignalsAndEffects>();

export const queryObjectSignal = <O extends object, K extends keyof O>(
  obj: O,
  name: K,
): SignalReader<O[K]> | undefined =>
  globalObjectSignalsAndEffects.get(obj)?.signals[name as any];

export const queryObjectSignals = <O extends object>(
  obj: O,
): SignalReader<any>[] | undefined => {
  const signals = globalObjectSignalsAndEffects.get(obj)?.signals;
  if (signals) {
    return Object.values(signals);
  }
  return undefined;
};

export const getObjectSignalKeys = <O extends object>(
  obj: O,
): (string | symbol)[] | undefined => {
  const signals = globalObjectSignalsAndEffects.get(obj)?.signals;
  if (signals) {
    return Object.keys(signals);
  }
  return undefined;
};

export const saveObjectSignal = (
  obj: any,
  name: string | symbol,
  signalReader: SignalReader<any>,
) => {
  const signals = globalObjectSignalsAndEffects.get(obj);
  if (signals) {
    signals.signals[name] = signalReader;
  } else {
    globalObjectSignalsAndEffects.set(obj, {
      signals: {[name]: signalReader},
      effects: {},
    });
  }
};

export const queryObjectEffect = (obj: any, name: string | symbol) =>
  globalObjectSignalsAndEffects.get(obj)?.effects[name];

export const saveObjectEffect = (
  obj: any,
  name: string | symbol,
  effect: [RunEffectCallback, DestroyEffectCallback],
) => {
  const effects = globalObjectSignalsAndEffects.get(obj);
  if (effects) {
    effects.effects[name] = effect;
  } else {
    globalObjectSignalsAndEffects.set(obj, {
      effects: {[name]: effect},
      signals: {},
    });
  }
};

export function destroySignals(...objects: any[]): void {
  for (const obj of objects) {
    if (globalObjectSignalsAndEffects.has(obj)) {
      const signalsAndEffects = globalObjectSignalsAndEffects.get(obj);
      for (const sig of Object.values(signalsAndEffects.signals)) {
        destroySignal(sig);
      }
      signalsAndEffects.signals = {};
    }
  }
}

export function destroyEffects(...objects: any[]): void {
  for (const obj of objects) {
    if (globalObjectSignalsAndEffects.has(obj)) {
      const signalsAndEffects = globalObjectSignalsAndEffects.get(obj);
      for (const [, destroyEffect] of Object.values(
        signalsAndEffects.effects,
      )) {
        destroyEffect();
      }
      signalsAndEffects.effects = {};
    }
  }
}

export function destroySignalsAndEffects(...objects: any[]): void {
  for (const obj of objects) {
    if (globalObjectSignalsAndEffects.has(obj)) {
      const {signals, effects} = globalObjectSignalsAndEffects.get(obj);
      for (const sig of Object.values(signals)) {
        destroySignal(sig);
      }
      for (const [, destroyEffect] of Object.values(effects)) {
        destroyEffect();
      }
      globalObjectSignalsAndEffects.delete(obj);
    }
  }
}
