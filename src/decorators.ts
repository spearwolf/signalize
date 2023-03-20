import {createMemo} from './createMemo';
import {createSignal, value as signalValue} from './createSignal';
import {createEffect} from './effects-api';
import {
  queryObjectEffect,
  queryObjectSignal,
  saveObjectEffect,
  saveObjectSignal,
} from './object-signals-and-effects';
import {SignalParams} from './types';

// https://github.com/tc39/proposal-decorators
// https://github.com/microsoft/TypeScript/pull/50820

export type SignalDecoratorOptions<T> = Omit<SignalParams<T>, 'lazy'>;

export function signal<T>(options?: SignalDecoratorOptions<T>) {
  return function <C>(
    _target: ClassAccessorDecoratorTarget<C, T>,
    context: ClassAccessorDecoratorContext<C, T>,
  ): ClassAccessorDecoratorResult<C, T> {
    const [getSignal, setSignal] = createSignal<T>(undefined, options as any);

    return {
      get(this: C) {
        return getSignal();
      },

      set(this: C, value: T) {
        setSignal(value);
      },

      init(this: C, value: T): T {
        saveObjectSignal(this, context.name, getSignal);
        setSignal(value);
        return signalValue(getSignal);
      },
    };
  };
}

export function memo() {
  return function <T, A extends any[], R>(
    target: (this: T, ...args: A) => R,
    context: ClassMethodDecoratorContext<T, (this: T, ...args: A) => R>,
  ) {
    return function (this: T, ...args: A): R {
      let signalReader = queryObjectSignal<R>(this, context.name);
      if (signalReader == null) {
        signalReader = createMemo<R>(() => target.call(this, ...args));
        saveObjectSignal(this, context.name, signalReader);
      }
      return signalReader();
    };
  };
}

export interface EffectDecoratorOptions {
  autorun?: boolean;
}

export function effect(options?: EffectDecoratorOptions) {
  const autorun = options?.autorun ?? true;

  return function <T, A extends any[]>(
    target: (this: T, ...args: A) => void,
    {name}: ClassMethodDecoratorContext<T, (this: T, ...args: A) => void>,
  ) {
    return function (this: T, ...args: A): void {
      let effect = queryObjectEffect(this, name);
      if (effect == null) {
        effect = createEffect({autorun}, () => target.call(this, ...args));
        saveObjectEffect(this, name, effect);
      }
      return effect[0]();
    };
  };
}
