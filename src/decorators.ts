import {createMemo} from './createMemo';
import {createSignal, value as signalValue} from './createSignal';
import {createEffect} from './effects-api';
import {
  queryObjectEffect,
  queryObjectSignal,
  saveObjectEffect,
  saveObjectSignal,
} from './object-signals-and-effects';

// https://github.com/tc39/proposal-decorators
// https://github.com/microsoft/TypeScript/pull/50820

// TODO add support for @signal({compare: (a, b) => boolean}) decorator option

export function signal<C, T>(
  _target: ClassAccessorDecoratorTarget<C, T>,
  context: ClassAccessorDecoratorContext<C, T>,
): ClassAccessorDecoratorResult<C, T> {
  const [signal, setSignal] = createSignal<T>();

  return {
    get(this: C) {
      return signal();
    },

    set(this: C, value: T) {
      setSignal(value);
    },

    init(this: C, value: T): T {
      saveObjectSignal(this, context.name, signal);
      setSignal(value);
      return signalValue(signal);
    },
  };
}

// TODO change syntax to @memo() to be more consistent with @signal() and @effect() decorators

export function memo<T, A extends any[], R>(
  target: (this: T, ...args: A) => R,
  context: ClassMethodDecoratorContext<T, (this: T, ...args: A) => R>,
) {
  return function (this: T, ...args: A): R {
    let signalReader = queryObjectSignal(this, context.name);
    if (signalReader == null) {
      signalReader = createMemo<R>(() => target.call(this, ...args));
      saveObjectSignal(this, context.name, signalReader);
    }
    return signalReader();
  };
}

interface MakeEffectOptions {
  autorun?: boolean;
}

function makeEffect(options?: MakeEffectOptions) {
  return function <T, A extends any[]>(
    target: (this: T, ...args: A) => void,
    {name}: ClassMethodDecoratorContext<T, (this: T, ...args: A) => void>,
  ) {
    return function (this: T, ...args: A): void {
      let effect = queryObjectEffect(this, name);
      if (effect == null) {
        effect = createEffect({autorun: options?.autorun ?? true}, () =>
          target.call(this, ...args),
        );
        saveObjectEffect(this, name, effect);
      }
      return effect[0]();
    };
  };
}

// TODO add support for @effect({autorun: true}) decorator option

export const effect = makeEffect({autorun: true});

// TODO remove support for @asyncEffect, use @effect({autorun: false}) instead

export const asyncEffect = makeEffect({autorun: false});
