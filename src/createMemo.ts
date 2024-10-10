import {once} from '@spearwolf/eventize';
import {createSignal, getSignalInstance} from './createSignal.js';
import {createEffect} from './effects.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {SignalGroup} from './SignalGroup.js';
import type {SignalReader} from './types.js';

// TODO add [optional] static dependencies
export interface CreateMemoOptions {
  group?: object | SignalGroup;
  name?: string | symbol;
}

export function createMemo<Type>(
  callback: () => Type,
  options?: CreateMemoOptions,
): SignalReader<Type> {
  const sig = createSignal<Type>();

  const group =
    options?.group != null
      ? SignalGroup.findOrCreate(options.group)
      : undefined;

  if (group != null) {
    if (options?.name) {
      group.attachSignalByName(options.name, sig);
    } else {
      group.attachSignal(sig);
    }
  }

  const e = createEffect(() => sig.set(callback()), {
    autorun: false,
    group,
  });

  const sig_ = getSignalInstance(sig);
  // TODO beQuiet ?
  sig_.beforeReadFn = e.run;

  once(globalDestroySignalQueue, sig_.id, e.destroy);

  return sig.get;
}
