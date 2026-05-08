import type {$signal} from './constants.js';
import type {Signal} from './Signal.js';
import {SignalGroup} from './SignalGroup.js';

export type VoidFunc = () => void;
export type EffectCallback = VoidFunc | (() => VoidFunc);
export type ValueChangedCallback<T> = (value: T) => VoidFunc | void;

export type CompareFunc<Type> = (a: Type, b: Type) => boolean;
export type BeforeReadFunc = () => void;

export interface SignalLike<Type = any> {
  [$signal]: ISignalImpl<Type>;
}

export interface ISignalImpl<Type = any> extends SignalLike<Type> {
  id: symbol;
  value: Type | undefined;
  valueFn: () => Type | undefined;
  lazy: boolean;
  compare?: CompareFunc<Type>;
  beforeRead?: BeforeReadFunc;
  muted: boolean;
  destroyed: boolean;
  reader: SignalReader<Type>;
  writer: SignalWriter<Type>;
  object: Signal<Type>;
}

export interface SignalReader<T> extends SignalLike<T> {
  /**
   * Read the signal value.
   *
   * @param callback - **Deprecated.** Passing a callback creates an internal
   *   effect but returns no handle, so the only way to clean it up is to
   *   destroy the signal itself. Use {@link Signal.onChange} instead, which
   *   returns an unsubscribe function. The callback form will be removed in
   *   a future release.
   */
  (callback?: ValueChangedCallback<T>): T;
}

export type SignalWriter<T> = (
  value: T | (() => T),
  params?: SignalWriterParams<T>,
) => void;

export interface SignalParams<T> {
  lazy?: boolean;
  compare?: CompareFunc<T>;
  beforeRead?: BeforeReadFunc;
  attach?: object | SignalGroup;
}

export interface SignalValueParams {
  touch?: boolean;
}

export interface SignalWriterParams<T>
  extends SignalParams<T>,
    SignalValueParams {}
