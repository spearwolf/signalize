import type {Signal} from './Signal.js';
import {SignalGroup} from './SignalGroup.js';
import type {$signal} from './constants.js';

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
  (callback?: ValueChangedCallback<T>): T;
}

export interface SignalWriter<T> {
  (value: T | (() => T), params?: SignalWriterParams<T>): void;
}

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

export type SignalFuncs<T = unknown> = [
  get: SignalReader<T>,
  set: SignalWriter<T>,
];
