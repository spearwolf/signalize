import type {SignalObject} from './SignalObject.js';
import type {$signal} from './constants.js';

export type VoidCallback = () => void;
export type EffectCallback = VoidCallback | (() => VoidCallback);
export type BatchCallback = VoidCallback;
export type RunEffectCallback = VoidCallback;
export type DestroyEffectCallback = VoidCallback;
export type CompareFunc<Type> = (a: Type, b: Type) => boolean;
export type BeforeReadFunc = () => void;

export interface SignalLike<Type> {
  [$signal]: Signal<Type>;
}

export interface Signal<Type> {
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
  object: SignalObject<Type>;
}

export interface SignalCallback<Type> {
  (value: Type): VoidCallback | void;
}

export interface SignalReader<Type> {
  (callback?: SignalCallback<Type>): Type;
  [$signal]: Signal<Type>;
}

export interface SignalWriter<Type> {
  (value: Type | (() => Type), params?: SignalWriterParams<Type>): void;
}

export interface SignalParams<Type> {
  lazy?: boolean;
  compareFn?: CompareFunc<Type>;
  beforeReadFn?: BeforeReadFunc;
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
