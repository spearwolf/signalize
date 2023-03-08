import {destroySignal} from './createSignal';
import {SignalReader} from './types';

export type SignalsObjectMapping = Record<string | symbol, SignalReader<any>>;

const globalObjectSignals = new WeakMap<any, SignalsObjectMapping>();

export const queryObjectSignal = (obj: any, name: string | symbol) =>
  globalObjectSignals.get(obj)?.[name];

export const saveObjectSignal = (
  obj: any,
  name: string | symbol,
  signalReader: SignalReader<any>,
) => {
  const signals = globalObjectSignals.get(obj);
  if (signals) {
    signals[name] = signalReader;
  } else {
    globalObjectSignals.set(obj, {[name]: signalReader});
  }
};

export function destroyObjectSignals(obj: any): void {
  if (globalObjectSignals.has(obj)) {
    const signals = globalObjectSignals.get(obj);
    for (const sig of Object.values(signals)) {
      destroySignal(sig);
    }
    globalObjectSignals.delete(obj);
  }
}
