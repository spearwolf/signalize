import {createSignal} from './createSignal';

// TODO decorators: @signal, @effect, @memo, ...

// https://github.com/microsoft/TypeScript/pull/50820

export function signal<C, T>(
  _target: undefined,
  context: ClassFieldDecoratorContext<C, T>,
) {
  const [signal, setSignal] = createSignal<T>();

  context.access.get = (_obj: C) => signal();
  context.access.set = (_obj: C, value: T) => setSignal(value);

  return function (this: C, value: T) {
    setSignal(value);
    return value;
  };
}
