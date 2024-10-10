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
  return function <C extends Object>(
    _target: ClassAccessorDecoratorTarget<C, T>,
    context: ClassAccessorDecoratorContext<C, T>,
  ): ClassAccessorDecoratorResult<C, T> {
    const signalName = (options?.name || context.name) as keyof C;
    const readAsValue = Boolean(options?.readAsValue ?? false);

    return {
      get(this: C) {
        const sig = findObjectSignalByName(this, signalName);
        if (sig) {
          return (readAsValue ? sig.value : sig.get()) as T;
        }
        return undefined;
      },

      set(this: C, value: T) {
        findObjectSignalByName(this, signalName)?.set(value as any);
      },

      init(this: C, value: T): T {
        const sig = createSignal<T>(value, options as any);
        storeAsObjectSignal(this, signalName as string | symbol, sig);
        SignalGroup.findOrCreate(this).attachSignalByName(
          signalName as string | symbol,
          sig,
        );
        return sig.value;
      },
    };
  };
}

export interface MemoDecoratorOptions {
  name?: string | symbol;
}

export function memo(options?: MemoDecoratorOptions) {
  return function <T extends object, A extends any[], R>(
    target: (this: T, ...args: A) => R,
    context: ClassMethodDecoratorContext<T, (this: T, ...args: A) => R>,
  ) {
    const name = options?.name || context.name;

    return function (this: T, ...args: A): R {
      let group = SignalGroup.get(this);
      let sig = group?.getSignal(name);
      let sigGet = sig?.get;
      if (sigGet == null) {
        group ??= SignalGroup.findOrCreate(this);
        sigGet = createMemo<R>(() => target.call(this, ...args), {
          group,
          name,
        });
        sig = group.getSignal(name);
        storeAsObjectSignal(this, name, sig);
      }
      return sigGet();
    };
  };
}
