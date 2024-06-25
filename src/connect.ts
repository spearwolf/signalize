import {Connection} from './Connection.js';
import {queryObjectSignal} from './object-signals-and-effects.js';
import type {SignalLike} from './types.js';

type ObjectProps<Obj, PropType> = {
  [Key in keyof Obj as Obj[Key] extends PropType ? Key : never]: unknown;
};

type ObjectMethods<Obj, MethodFirstArgType> = {
  [Key in keyof Obj as Obj[Key] extends (val?: MethodFirstArgType) => void
    ? Key
    : never]: unknown;
};

export function connect<Type>(
  source: SignalLike<Type>,
  target: SignalLike<Type>,
): Connection<Type>;

export function connect<Type>(
  source: SignalLike<Type>,
  target: (val?: Type) => void,
): Connection<Type>;

export function connect<
  Object extends object,
  Key extends keyof ObjectProps<Object, Type>,
  Type,
>(source: [Object, Key], target: SignalLike<Type>): Connection<Type>;

export function connect<
  Type,
  Object extends object,
  Key extends
    | keyof ObjectProps<Object, Type>
    | keyof ObjectMethods<Object, Type>,
>(source: SignalLike<Type>, target: [Object, Key]): Connection<Type>;

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
  // === Connection :: source ===
  const conSource = Array.isArray(source)
    ? queryObjectSignal(...(source as [any, any]))
    : source;

  const isObjectTarget = Array.isArray(target);

  // === Connection :: target ===
  const conTarget = isObjectTarget
    ? queryObjectSignal(...(target as [any, any])) ?? target
    : target;

  // === Connection :: connectionTarget ===
  const conConnectionTarget = isObjectTarget
    ? (target as [object, any])[0]
    : target;

  return new Connection(conSource, conTarget, conConnectionTarget);
}
