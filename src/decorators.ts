import {createSignal} from './create-signal.js';
import {findObjectSignal, storeAsObjectSignal} from './object-signals.js';
import {SignalGroup} from './SignalGroup.js';
import type {SignalParams} from './types.js';

// https://github.com/tc39/proposal-decorators
// https://github.com/microsoft/TypeScript/pull/50820

export type SignalReaderDecoratorOptions = {
  /**
   * The name the signal is filed under in the instance's group. Defaults to
   * the property name, and an empty string means exactly that default, not
   * an empty name.
   */
  name?: string | symbol;
};

/**
 * Options of the `@signal` accessor decorator.
 *
 * `attach` names an **additional** group, it does not replace anything: the
 * decorated signal is always attached to the group of the instance it lives
 * on, and `attach` puts it into a second group on top of that. Both
 * memberships are real — a `SignalGroup.destroy()` on the additional group
 * destroys the signal. What the instance loses then is the reactivity, not
 * the entry: `findObjectSignalNames()` still lists the name and the property
 * getter still returns the last value.
 */
export type SignalDecoratorOptions<T> = Omit<SignalParams<T>, 'lazy'> &
  SignalReaderDecoratorOptions & {
    readAsValue?: boolean;
  };

export function signal<T>(options?: SignalDecoratorOptions<T>) {
  return function <C extends object>(
    _target: ClassAccessorDecoratorTarget<C, T>,
    context: ClassAccessorDecoratorContext<C, T>,
  ): ClassAccessorDecoratorResult<C, T> {
    const name: string | symbol = options?.name || context.name;
    const readAsValue = Boolean(options?.readAsValue ?? false);

    return {
      get(this: C) {
        const si = findObjectSignal(this, name);
        if (si) {
          return (readAsValue ? si.value : si.get()) as T;
        }
        return undefined;
      },

      set(this: C, value: T) {
        findObjectSignal(this, name)?.set(value);
      },

      init(this: C, value: T): T {
        // The `<T>` is load bearing, not decoration. `createSignal`'s value
        // overload infers its params type and refuses any key beyond
        // `SignalParams` (BUG-014), and `SignalDecoratorOptions` carries two
        // — `name` and `readAsValue`. Naming the type argument makes that
        // params type fall back to its default instead of being inferred,
        // which is the one thing that keeps this call compiling. Drop it and
        // the build fails with `TS2769` on `Record<"name" | "readAsValue",
        // never>`, a message that says nothing about the cause.
        const si = createSignal<T>(value, options);
        storeAsObjectSignal(this, name, si);
        SignalGroup.findOrCreate(this).attachSignalByName(name, si);
        return si.value;
      },
    };
  };
}
