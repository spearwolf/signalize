import type {Signal} from './Signal.js';
import {SignalGroup} from './SignalGroup.js';
import type {$signal} from './constants.js';

export type VoidFunc = () => void;

export type EffectCallback = VoidFunc | (() => VoidFunc);
export type BatchCallback = VoidFunc;

export type CompareFunc<Type> = (a: Type, b: Type) => boolean;
export type BeforeReadFunc = () => void;

export interface SignalLike<Type> {
  [$signal]: ISignalImpl<Type>;
}

export interface ISignalImpl<Type> extends SignalLike<Type> {
  id: symbol;
  value: Type | undefined;
  valueFn: () => Type | undefined;
  lazy: boolean;
  compareFn?: CompareFunc<Type>;
  beforeReadFn?: BeforeReadFunc;
  muted: boolean;
  destroyed: boolean;
  reader: SignalReader<Type>;
  writer: SignalWriter<Type>;
  object: Signal<Type>;
}

//export type AnySignal = SignalLike<any> | Signal<any>;

export interface SignalCallback<Type> {
  (value: Type): VoidFunc | void;
}

export interface SignalReader<Type> extends SignalLike<Type> {
  (callback?: SignalCallback<Type>): Type;
  [$signal]: ISignalImpl<Type>;
}

export interface SignalWriter<Type> {
  (value: Type | (() => Type), params?: SignalWriterParams<Type>): void;
}

export interface SignalParams<Type> {
  lazy?: boolean;
  // TODO rename to compare
  compareFn?: CompareFunc<Type>;
  // TODO rename to beforeRead
  beforeReadFn?: BeforeReadFunc;
  attach?: object | SignalGroup;
}

export interface SignalValueParams {
  touch?: boolean;
}

export interface SignalWriterParams<Type>
  extends SignalParams<Type>,
    SignalValueParams {}

export type SignalFuncs<Type = unknown> = [
  get: SignalReader<Type>,
  set: SignalWriter<Type>,
];
