import {once} from '@spearwolf/eventize';
import {createSignal, getSignalInstance} from './createSignal.js';
import {createEffect} from './effects.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {Group} from './Group.js';
import type {SignalReader} from './types.js';

// TODO add [optional] static dependencies
export interface CreateMemoOptions {
  group?: object | Group;
  name?: string | symbol;
}

export function createMemo<Type>(
  callback: () => Type,
  options?: CreateMemoOptions,
): SignalReader<Type> {
  const sig = createSignal<Type>();

  const group =
    options?.group != null ? Group.findOrCreate(options.group) : undefined;

  if (group != null) {
    if (options?.name) {
      group.setSignal(options.name, sig);
    } else {
      group.addSignal(sig);
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
