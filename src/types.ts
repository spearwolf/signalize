import {$signal} from './constants';

export type EffectCallback = () => void;

export interface Signal<Type> {
  id: symbol;
  value: Type | undefined;
}

export interface SignalReader<Type> {
  (): Type;
  [$signal]: Signal<Type>;
}

export interface SignalWriter<Type> {
  (value: Type): void;
}
