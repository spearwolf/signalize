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
 * `docs/api.md`, "Decorators" → "`@signal(options?)` — accessor decorator"
 */
export type SignalDecoratorOptions<T> = Omit<SignalParams<T>, 'lazy'> &
  SignalReaderDecoratorOptions & {
    readAsValue?: boolean;
  };

/**
 * Turn a class field declared with `accessor` into a per-instance signal.
 *
 * `accessor` is mandatory. The returned decorator is typed as a class
 * accessor decorator, so TypeScript refuses it on a plain field, on a
 * method and on a getter — there is no runtime fallback for those.
 *
 * Each instance gets its own signal, created when the field initializes,
 * and it is registered twice — neither registration is optional. Once
 * under `name` in the object store that `findObjectSignalByName()`,
 * `findObjectSignals()` and `findObjectSignalNames()` read; once under the
 * same `name` in `SignalGroup.findOrCreate(this)`, the group of the
 * instance the field lives on.
 *
 * Reading the property tracks the signal in the surrounding effect
 * (`signal.get()`); with `readAsValue: true` it reads untracked
 * (`signal.value`). Writing the property writes the signal. After
 * `destroyObjectSignals(this)` the store entry is gone and both ends go
 * quiet: the getter returns `undefined`, the setter is a no-op.
 *
 * See {@link SignalReaderDecoratorOptions} for `name`, and
 * {@link SignalDecoratorOptions} for `attach` and every other option.
 *
 * `docs/api.md`, "Decorators" → "`@signal(options?)` — accessor decorator"
 *
 * ```ts
 * class Foo { @signal() accessor bar = 23; }
 * ```
 */
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
        // `SignalParams`, and `SignalDecoratorOptions` carries two
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
