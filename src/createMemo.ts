import {once} from '@spearwolf/eventize';
import {createSignal, getSignalInstance} from './createSignal.js';
import {createEffect} from './effects-api.js';
import {globalDestroySignalQueue} from './global-queues.js';
import type {SignalReader} from './types.js';
import {Group} from './Group.js';

// TODO add [optional] static dependencies
export interface MemoParams {
  group?: Group;
  name?: string | symbol;
}

export function createMemo<Type>(
  callback: () => Type,
  params?: MemoParams,
): SignalReader<Type> {
  const sig = createSignal<Type>();

  if (params?.group != null) {
    if (params?.name != null) {
      params.group.setSignal(params.name, sig);
    } else {
      params.group.addSignal(sig);
    }
  }

  const eff = createEffect(() => sig.set(callback()), {
    autorun: false,
    group: params?.group,
  });

  const signal = getSignalInstance(sig);
  // TODO create Signal#beforeRead= wrapper

  // TODO beQuiet ?
  signal.beforeReadFn = eff.run;

  once(globalDestroySignalQueue, signal.id, eff.destroy);

  return sig.get;
}
