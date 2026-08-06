import {createSignal} from './createSignal.js';
import {findObjectSignalByName, storeAsObjectSignal} from './object-signals.js';
import {SignalGroup} from './SignalGroup.js';
import type {SignalParams} from './types.js';

// https://github.com/tc39/proposal-decorators
// https://github.com/microsoft/TypeScript/pull/50820

export type SignalReaderDecoratorOptions = {
  name?: string | symbol;
};

export type SignalDecoratorOptions<T> = Omit<SignalParams<T>, 'lazy'> &
  SignalReaderDecoratorOptions & {
    readAsValue?: boolean;
  };

export function signal<T>(options?: SignalDecoratorOptions<T>) {
  return function <C extends object>(
    _target: ClassAccessorDecoratorTarget<C, T>,
    context: ClassAccessorDecoratorContext<C, T>,
  ): ClassAccessorDecoratorResult<C, T> {
    const name = (options?.name || context.name) as keyof C;
    const readAsValue = Boolean(options?.readAsValue ?? false);

    return {
      get(this: C) {
        const si = findObjectSignalByName(this, name);
        if (si) {
          return (readAsValue ? si.value : si.get()) as T;
        }
        return undefined;
      },

      set(this: C, value: T) {
        findObjectSignalByName(this, name)?.set(value as any);
      },

      init(this: C, value: T): T {
        const si = createSignal<T>(value, options as any);
        storeAsObjectSignal(this, name as string | symbol, si);
        SignalGroup.findOrCreate(this).attachSignalByName(
          name as string | symbol,
          si,
        );
        return si.value;
      },
    };
  };
}
