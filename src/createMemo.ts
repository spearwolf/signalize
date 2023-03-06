import {SignalReader} from './types';
import {createEffect} from './effects-api';
import {createSignal, getSignal} from './createSignal';
import {globalDestroySignalQueue} from './global-queues';

export function createMemo<Type>(callback: () => Type): SignalReader<Type> {
  const [signal, set] = createSignal<Type>();
  const [, unsubscribe] = createEffect(() => set(callback()));
  globalDestroySignalQueue.once(getSignal(signal).id, unsubscribe);
  return signal;
}
