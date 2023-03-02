import {SignalReader} from './types';
import {createEffect} from './createEffect';
import {createSignal} from './createSignal';

export function createMemo<Type>(callback: () => Type): SignalReader<Type> {
  const [signal, set] = createSignal<Type>();
  createEffect(() => set(callback()));
  // TODO on(destroy signal) => destroy memo effect
  return signal;
}
