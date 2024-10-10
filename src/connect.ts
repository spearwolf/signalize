import {Connection} from './Connection.js';
import {findObjectSignalByName} from './object-signals.js';
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
  Type,
  SourceObject extends object,
  SourceKey extends keyof ObjectProps<SourceObject, Type>,
>(
  source: [SourceObject, SourceKey],
  target: SignalLike<Type>,
): Connection<Type>;

export function connect<
  Type,
  TargetObject extends object,
  TargetKey extends
    | keyof ObjectProps<TargetObject, Type>
    | keyof ObjectMethods<TargetObject, Type>,
>(
  source: SignalLike<Type>,
  target: [TargetObject, TargetKey],
): Connection<Type>;

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
    ? findObjectSignalByName(...(source as [any, any]))
    : source;

  const isObjectTarget = Array.isArray(target);

  // === Connection :: target ===
  const conTarget = isObjectTarget
    ? (findObjectSignalByName(...(target as [any, any])) ?? target)
    : target;

  // === Connection :: connectionTarget ===
  const conConnectionTarget = isObjectTarget
    ? (target as [object, any])[0]
    : target;

  return new Connection(conSource, conTarget, conConnectionTarget);
}
