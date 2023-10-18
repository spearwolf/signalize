import {createSignal, getSignalInstance} from './createSignal.js';
import {createEffect} from './effects-api.js';
import {globalDestroySignalQueue} from './global-queues.js';
import type {SignalReader} from './types.js';

export function createMemo<Type>(callback: () => Type): SignalReader<Type> {
  const [get, set] = createSignal<Type>();
  const [compute, unsubscribe] = createEffect(() => set(callback()), {
    autorun: false,
  });
  const signal = getSignalInstance(get);
  signal.beforeReadFn = compute;
  globalDestroySignalQueue.once(signal.id, unsubscribe);
  return get;
}
