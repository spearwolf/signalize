import {Connection} from './Connection';
import {queryObjectSignal} from './object-signals-and-effects';
import {SignalReader} from './types';

type ObjectProps<Obj, PropType> = {
  [Key in keyof Obj as Obj[Key] extends PropType ? Key : never]: unknown;
};

type ObjectMethods<Obj, MethodFirstArgType> = {
  [Key in keyof Obj as Obj[Key] extends (val?: MethodFirstArgType) => void
    ? Key
    : never]: unknown;
};

export function connect<Type>(
  source: SignalReader<Type>,
  target: SignalReader<Type>,
): Connection<Type>;

export function connect<Type>(
  source: SignalReader<Type>,
  target: (val?: Type) => void,
): Connection<Type>;

export function connect<
  Object extends object,
  Key extends keyof ObjectProps<Object, Type>,
  Type,
>(source: [Object, Key], target: SignalReader<Type>): Connection<Type>;

export function connect<
  Type,
  Object extends object,
  Key extends
    | keyof ObjectProps<Object, Type>
    | keyof ObjectMethods<Object, Type>,
>(source: SignalReader<Type>, target: [Object, Key]): Connection<Type>;

export function connect<
  Type,
  SourceObject extends object,
  TargetObject extends object,
  SourceKey extends keyof ObjectProps<SourceObject, Type>,
  TargetKey extends
    | keyof ObjectProps<TargetObject, Type>
    | ObjectMethods<TargetObject, Type>,
>(
  source: [SourceObject, SourceKey],
  target: [TargetObject, TargetKey],
): Connection<Type>;

export function connect<
  Type,
  SourceObject extends object,
  SourceKey extends keyof ObjectProps<SourceObject, Type>,
>(
  source: [SourceObject, SourceKey],
  target: (val?: Type) => void,
): Connection<Type>;

export function connect(source: any, target: any) {
  const isObjectTarget = Array.isArray(target);
  return new Connection(
    Array.isArray(source)
      ? queryObjectSignal(...(source as [any, any]))
      : source,
    isObjectTarget
      ? queryObjectSignal(...(target as [any, any])) ?? target
      : target,
    isObjectTarget ? (target as [any, any])[0] : target,
  );
}
