import {EffectParams} from './Effect.js';
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

export type SignalReaderDecoratorOptions = {
  name?: string | symbol;
};

export type SignalDecoratorOptions<T> = Omit<SignalParams<T>, 'lazy'> &
  SignalReaderDecoratorOptions & {
    readAsValue?: boolean;
  };

const extractSignalName = (name: string | symbol) => {
  if (typeof name === 'symbol') {
    return name;
  }
  const idx = name.indexOf('$');
  if (idx >= 0) {
    return name.slice(0, idx);
  }
  return name;
};

export function signal<T>(options?: SignalDecoratorOptions<T>) {
  return function <C extends Object>(
    _target: ClassAccessorDecoratorTarget<C, T>,
    context: ClassAccessorDecoratorContext<C, T>,
  ): ClassAccessorDecoratorResult<C, T> {
    const signalName = (options?.name ??
      extractSignalName(context.name)) as keyof C;
    const readAsValue = Boolean(options?.readAsValue ?? false);

    return {
      get(this: C) {
        const signalReader = queryObjectSignal(this, signalName);
        if (signalReader) {
          return (
            readAsValue ? readSignalValue(signalReader) : signalReader()
          ) as T;
        }
        return undefined;
      },

      set(this: C, value: T) {
        getSignalInstance(queryObjectSignal(this, signalName))?.writer(
          value as any,
        );
      },

      init(this: C, value: T): T {
        const [readSignal, writeSignal] = createSignal<T>(
          undefined,
          options as any,
        );
        saveObjectSignal(this, signalName as string | symbol, readSignal);
        writeSignal(value);
        return readSignalValue(readSignal);
      },
    };
  };
}

export function signalReader<T, SR = SignalReader<T>>(
  options?: SignalReaderDecoratorOptions,
) {
  return function <C extends Object>(
    _target: ClassAccessorDecoratorTarget<C, SR>,
    context: ClassAccessorDecoratorContext<C, SR>,
  ): ClassAccessorDecoratorResult<C, SR> {
    const signalName = (options?.name ??
      extractSignalName(context.name)) as keyof C;

    return {
      get(this: C) {
        return queryObjectSignal(this, signalName) as SR;
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

export type HasSignalType = {signal?: string | symbol; autostart?: boolean};
export type HasDepsType = {deps?: (string | symbol)[]; autostart?: boolean};

export type EffectDecoratorOptions = (HasSignalType | HasDepsType) & {
  /**
   * if deactivated, the effect is not executed automatically when the dependencies change.
   * in this case, the effect must be called explicitly in order to be executed (of course only if the dependencies have changed).
   */
  autorun?: boolean;
};

export function effect(options?: EffectDecoratorOptions) {
  const autorun = options?.autorun ?? true;

  const deps: (string | symbol)[] | undefined =
    ((options as HasSignalType)?.signal
      ? [(options as HasSignalType).signal]
      : undefined) ?? (options as HasDepsType)?.deps;

  const hasDeps = deps != null && deps.length > 0;

  const autostart = hasDeps ? options?.autostart ?? true : true;

  return function <T, A extends any[]>(
    target: (this: T, ...args: A) => any,
    {name}: ClassMethodDecoratorContext<T, (this: T, ...args: A) => any>,
  ) {
    return function (this: T, ...args: A): any {
      let effect = queryObjectEffect(this, name);
      if (effect == null) {
        const params: EffectParams = {autorun};
        if (hasDeps) {
          const readers: SignalReader<any>[] = deps
            .map((signalName) => queryObjectSignal(this as any, signalName))
            .filter(Boolean);
          if (readers.length !== deps.length) {
            // eslint-disable-next-line no-console
            console.warn(
              'unknown object signals:',
              deps.filter(
                (signalName) => !queryObjectSignal(this as any, signalName),
              ),
            );
          }
          effect = createEffect(
            () => target.call(this, ...args),
            readers,
            params,
          );
        } else {
          effect = createEffect(() => target.call(this, ...args), params);
        }
        saveObjectEffect(this, name, effect);
      }
      if (autostart) {
        effect[0]();
      }
    };
  };
}
