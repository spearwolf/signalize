import {createMemo} from './createMemo.js';
import {createSignal, getSignalInstance} from './createSignal.js';
import {createEffect} from './effects-api.js';
import {
  queryObjectEffect,
  queryObjectSignal,
  saveObjectEffect,
  saveObjectSignal,
} from './object-signals-and-effects.js';
import type {SignalParams, SignalReader} from './types.js';
import {value as readSignalValue} from './value.js';

// https://github.com/tc39/proposal-decorators
// https://github.com/microsoft/TypeScript/pull/50820

export type SignalDecoratorOptions<T> = Omit<SignalParams<T>, 'lazy'>;

export function signal<T>(options?: SignalDecoratorOptions<T>) {
  return function <C extends Object>(
    _target: ClassAccessorDecoratorTarget<C, T>,
    context: ClassAccessorDecoratorContext<C, T>,
  ): ClassAccessorDecoratorResult<C, T> {
    return {
      get(this: C) {
        return queryObjectSignal(this, context.name as keyof C)?.() as T;
      },

      set(this: C, value: T) {
        getSignalInstance(
          queryObjectSignal(this, context.name as keyof C),
        )?.writer(value as any);
      },

      init(this: C, value: T): T {
        const [getSignal, setSignal] = createSignal<T>(
          undefined,
          options as any,
        );
        saveObjectSignal(this, context.name, getSignal);
        setSignal(value);
        return readSignalValue(getSignal);
      },
    };
  };
}

export function memo() {
  return function <T extends object, A extends any[], R>(
    target: (this: T, ...args: A) => R,
    context: ClassMethodDecoratorContext<T, (this: T, ...args: A) => R>,
  ) {
    return function (this: T, ...args: A): R {
      let signalReader: SignalReader<R> = queryObjectSignal(
        this,
        context.name as any,
      ) as any;
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
        effect = createEffect(() => target.call(this, ...args), {
          autorun,
        });
        saveObjectEffect(this, name, effect);
      }
      return effect[0]();
    };
  };
}

// TODO create a slot() class method decorator!
// - slots are regulary methods that emit an event (signal value) to the eventize(object-instance) when called
// - slots should be able to be used as connection target
