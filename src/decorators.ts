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
        Group.findOrCreate(this).setSignal(signalName as string | symbol, sig);
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
      let group = Group.get(this);
      let sig = group?.getSignal(name);
      let sigGet = sig?.get;
      if (sigGet == null) {
        group ??= Group.findOrCreate(this);
        sigGet = createMemo<R>(() => target.call(this, ...args), {
          group,
          name,
        });
        sig = group.getSignal(name);
        saveObjectSignal(this, name, sig);
      }
      return sigGet();
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
