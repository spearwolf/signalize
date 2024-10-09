import {EffectParams} from './EffectImpl.js';
import {Group} from './Group.js';
import {Signal} from './Signal.js';
import {createMemo} from './createMemo.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects-api.js';
import {
  queryObjectEffect,
  queryObjectSignal,
  saveObjectEffect,
  saveObjectSignal,
} from './object-signals-and-effects.js';
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
        const sig = queryObjectSignal(this, signalName);
        if (sig) {
          return (readAsValue ? sig.value : sig.get()) as T;
        }
        return undefined;
      },

      set(this: C, value: T) {
        queryObjectSignal(this, signalName)?.set(value as any);
      },

      init(this: C, value: T): T {
        const sig = createSignal<T>(value, options as any);
        saveObjectSignal(this, signalName as string | symbol, sig);
        new Group(this).setSignal(signalName as string | symbol, sig);
        return sig.value;
      },
    };
  };
}

// let g_signalReader_deprecatedWarningShown = false;

// export function signalReader<T, SR = SignalReader<T>>(
//   options?: SignalReaderDecoratorOptions,
// ) {
//   return function <C extends Object>(
//     _target: ClassAccessorDecoratorTarget<C, SR>,
//     context: ClassAccessorDecoratorContext<C, SR>,
//   ): ClassAccessorDecoratorResult<C, SR> {
//     const signalName = (options?.name || context.name) as keyof C;

//     if (!g_signalReader_deprecatedWarningShown) {
//       g_signalReader_deprecatedWarningShown = true;
//       // eslint-disable-next-line no-console
//       console.warn(
//         'The usage of the @signalReader() decorator is deprecated, please use the signal object api instead!',
//       );
//     }

//     return {
//       get(this: C) {
//         return queryObjectSignal(this, signalName) as SR;
//       },
//     };
//   };
// }

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
      //let signalReader: SignalReader<R> = queryObjectSignal(
      //  this,
      //  name as any,
      //) as any;
      //if (signalReader == null) {
      //  signalReader = createMemo<R>(() => target.call(this, ...args), {
      //    group: new Group(this),
      //  });
      //  saveObjectSignal(this, context.name, signalReader);
      //  new Group(this).addSignal(signalReader);
      //}
      //return signalReader();
      const sig = Group.get(this)?.getSignal(name);
      let signalReader = sig?.get;
      if (signalReader == null) {
        const group = new Group(this);
        signalReader = createMemo<R>(() => target.call(this, ...args), {
          group,
          name,
        });
        saveObjectSignal(this, name, group.getSignal(name));
      }
      return signalReader();
    };
  };
}

export type HasSignalType = {signal?: string | symbol; autostart?: boolean};
export type HasDepsType = {deps?: (string | symbol)[]; autostart?: boolean};

export type EffectDecoratorOptions = (HasSignalType | HasDepsType) & {
  /**
   * if deactivated, the effect is not executed automatically when the dependencies change.
   * in this case, the effect must be called explicitly in order to be executed (of course only if the dependencies have changed).
   */
  autorun?: boolean;
};

let g_effect_deprecatedWarningShown = false;

// TODO remove @effect decorator

export function effect(options?: EffectDecoratorOptions) {
  const autorun = options?.autorun ?? true;

  const deps: (string | symbol)[] | undefined =
    ((options as HasSignalType)?.signal
      ? [(options as HasSignalType).signal]
      : undefined) ?? (options as HasDepsType)?.deps;

  const hasDeps = deps != null && deps.length > 0;

  const autostart = hasDeps ? (options?.autostart ?? true) : true;

  if (!g_effect_deprecatedWarningShown) {
    g_effect_deprecatedWarningShown = true;
    // eslint-disable-next-line no-console
    console.warn(
      'The usage of the @effect() decorator is deprecated, please create effects in combination with groups instead!',
    );
  }

  return function <T, A extends any[]>(
    target: (this: T, ...args: A) => any,
    {name}: ClassMethodDecoratorContext<T, (this: T, ...args: A) => any>,
  ) {
    return function (this: T, ...args: A): any {
      let effect = queryObjectEffect(this, name);
      if (effect == null) {
        const params: EffectParams = {autorun};
        if (hasDeps) {
          const signals: Signal<any>[] = deps
            .map((signalName) => queryObjectSignal(this as any, signalName))
            .filter(Boolean);
          if (signals.length !== deps.length) {
            // eslint-disable-next-line no-console
            console.warn(
              'unknown signals:',
              deps.filter(
                (signalName) => !queryObjectSignal(this as any, signalName),
              ),
            );
          }
          effect = createEffect(
            () => target.call(this, ...args),
            signals,
            params,
          );
        } else {
          effect = createEffect(() => target.call(this, ...args), params);
        }
        saveObjectEffect(this, name, effect);
      }
      if (autostart) {
        effect.run();
      }
    };
  };
}
