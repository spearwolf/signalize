import {once} from '@spearwolf/eventize';
import {createSignal, signalImpl} from './createSignal.js';
import {createEffect} from './effects.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {SignalGroup} from './SignalGroup.js';
import type {SignalReader} from './types.js';

export interface CreateMemoOptions {
  attach?: object | SignalGroup;
  name?: string | symbol;
  lazy?: boolean;
}

export function createMemo<Type>(
  callback: () => Type,
  options?: CreateMemoOptions,
): SignalReader<Type> {
  const si = createSignal<Type>();

  const group =
    options?.attach != null
      ? SignalGroup.findOrCreate(options.attach)
      : undefined;

  if (group != null) {
    if (options?.name) {
      group.attachSignalByName(options.name, si);
    } else {
      group.attachSignal(si);
    }
  }

  const e = createEffect(() => si.set(callback()), {
    autorun: !(options?.lazy ?? false),
    attach: group,
  });

  const sImpl = signalImpl(si);
  sImpl.beforeRead = e.run;

  once(globalDestroySignalQueue, sImpl.id, e.destroy);

  return si.get;
}
