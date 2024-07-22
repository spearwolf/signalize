import {once} from '@spearwolf/eventize';
import {createSignal, getSignalInstance} from './createSignal.js';
import {createEffect} from './effects-api.js';
import {globalDestroySignalQueue} from './global-queues.js';
import type {SignalReader} from './types.js';

// TODO add [optional] static dependencies
export function createMemo<Type>(callback: () => Type): SignalReader<Type> {
  const [get, set] = createSignal<Type>();
  const [compute, unsubscribe] = createEffect(() => set(callback()), {
    autorun: false,
  });
  const signal = getSignalInstance(get);
  // TODO beQuiet ?
  signal.beforeReadFn = compute;
  once(globalDestroySignalQueue, signal.id, unsubscribe);
  return get;
}
