import {SignalGroup} from './SignalGroup.js';
import {createMemo} from './createMemo.js';
import {createSignal} from './createSignal.js';
import {findObjectSignalByName, storeAsObjectSignal} from './object-signals.js';
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

export interface MemoDecoratorOptions {
  name?: string | symbol;
}

/**
 * NOTE: A memo created by this decorator is always lazy and never autorun!
 */
export function memo(options?: MemoDecoratorOptions) {
  return function <T extends object, A extends any[], R>(
    target: (this: T, ...args: A) => R,
    context: ClassMethodDecoratorContext<T, (this: T, ...args: A) => R>,
  ) {
    const name = options?.name || context.name;

    return function (this: T, ...args: A): R {
      let group = SignalGroup.get(this);
      let si = group?.signal(name);
      let siGet = si?.get;
      if (siGet == null) {
        group ??= SignalGroup.findOrCreate(this);
        siGet = createMemo<R>(() => target.call(this, ...args), {
          lazy: true,
          attach: group,
          name,
        });
        si = group.signal(name);
        storeAsObjectSignal(this, name, si);
      }
      return siGet();
    };
  };
}
