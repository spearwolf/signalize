import {createSignal, getSignal} from './createSignal';
import {createEffect} from './effects-api';
import {globalDestroySignalQueue} from './global-queues';
import {SignalReader} from './types';

export function createMemo<Type>(callback: () => Type): SignalReader<Type> {
  const [get, set] = createSignal<Type>();
  const [compute, unsubscribe] = createEffect({autorun: false}, () =>
    set(callback()),
  );
  const signal = getSignal(get);
  signal.beforeReadFn = compute;
  globalDestroySignalQueue.once(signal.id, unsubscribe);
  return get;
}
