import {once, Priority} from '@spearwolf/eventize';
import {createSignal, signalImpl} from './createSignal.js';
import {createEffect} from './effects.js';
import {globalDestroySignalQueue} from './global-queues.js';
import {SignalGroup} from './SignalGroup.js';
import type {SignalReader} from './types.js';
import {batch} from './batch.js';

/**
 * Options for creating a memo (computed signal).
 */
export interface CreateMemoOptions {
  /** Attach the memo to a SignalGroup for lifecycle management */
  attach?: object | SignalGroup;
  /** Optional name for the memo when attached to a group */
  name?: string | symbol;
  /** If true, the memo won't compute until first read (default: false) */
  lazy?: boolean;
  /** Effect priority for dependency tracking (default: Priority.C = 1000) */
  priority?: number;
}

/**
 * Create a memoized (computed) signal that derives its value from other signals.
 * The memo automatically tracks dependencies and recomputes when they change.
 * Results are cached until dependencies change.
 *
 * @param callback - Function that computes the derived value
 * @param options - Configuration options (attach, name, lazy, priority)
 * @returns A SignalReader function to get the computed value
 */
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

  const e = createEffect(
    () => {
      batch(() => {
        si.set(callback());
      });
    },
    {
      autorun: !(options?.lazy ?? false),
      priority: options?.priority ?? Priority.C,
      attach: group,
    },
  );

  const sImpl = signalImpl(si);
  sImpl.beforeRead = e.run;

  once(globalDestroySignalQueue, sImpl.id, e.destroy);

  return si.get;
}
