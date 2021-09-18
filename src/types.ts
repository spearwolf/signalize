import {$signal} from './constants';

export type VoidCallback = () => void;
export type EffectCallback = VoidCallback | (() => VoidCallback);
export type BatchCallback = VoidCallback;

export interface Signal<Type> {
  id: symbol;
  value: Type | undefined;
}

export interface SignalCallback<Type> {
  (value: Type): VoidCallback | void;
}

export interface SignalReader<Type> {
  (callback?: SignalCallback<Type>): Type;
  [$signal]: Signal<Type>;
}

export interface SignalWriter<Type> {
  (value: Type): void;
}
