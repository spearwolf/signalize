import {$signal} from './constants';

export type VoidCallback = () => void;
export type EffectCallback = VoidCallback | (() => VoidCallback);
export type BatchCallback = VoidCallback;
export type RunEffectCallback = VoidCallback;
export type DestroyEffectCallback = VoidCallback;

export interface Signal<Type> {
  id: symbol;
  value: Type | undefined;
  valueFn: () => Type | undefined;
  lazy: boolean;
  muted: boolean;
  destroyed: boolean;
  reader: SignalReader<Type>;
  writer: SignalWriter<Type>;
}

export interface SignalCallback<Type> {
  (value: Type): VoidCallback | void;
}

export interface SignalReader<Type> {
  (callback?: SignalCallback<Type>): Type;
  [$signal]: Signal<Type>;
}

export interface SignalWriter<Type> {
  (value: Type | (() => Type), params?: SignalParams): void;
}

export interface SignalParams {
  lazy: boolean;
}
