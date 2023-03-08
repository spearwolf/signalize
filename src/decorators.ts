import {createSignal, value as signalValue} from './createSignal';
import {saveObjectSignal} from './object-signals';

// TODO decorators: @signal, @effect, @memo, ...

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
