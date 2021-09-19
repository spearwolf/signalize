import {SignalReader} from './types';

import {createEffect, createSignal} from '.';

export function createMemo<Type>(callback: () => Type): SignalReader<Type> {
  const [signal, set] = createSignal<Type>();
  createEffect(() => set(callback()));
  return signal;
}
