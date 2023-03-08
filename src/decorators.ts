import {createMemo} from './createMemo';
import {createSignal, value as signalValue} from './createSignal';
import {queryObjectSignal, saveObjectSignal} from './object-signals';

// TODO add class method decorator: @effect
// TODO add destroyObjectEffects(foo)

// https://github.com/microsoft/TypeScript/pull/50820

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
