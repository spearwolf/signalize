import {Connection} from './Connection';
import {isSignal} from './createSignal';
import {SignalReader} from './types';

// TODO unconnect(sourceObject)
// TODO unconnect(sourceObject, targetObject)
// TODO unconnect([sourceObject, 'sourceProp'], [targetObject, 'targetProp'])

type ObjectProps<Obj, PropType> = {
  [Key in keyof Obj as Obj[Key] extends PropType ? Key : never]: unknown;
};

type ObjectMethods<Obj, MethodFirstArgType> = {
  [Key in keyof Obj as Obj[Key] extends (val?: MethodFirstArgType) => void
    ? Key
    : never]: unknown;
};

// sig
// sig -> sig | fn | obj
//
export function unconnect<Type>(
  source: SignalReader<Type>,
  target?: SignalReader<Type> | ((val?: Type) => void) | object,
): void;

// sig -> obj.prop
//
export function unconnect<
  Type,
  Object extends object,
  Key extends
    | keyof ObjectProps<Object, Type>
    | keyof ObjectMethods<Object, Type>,
>(source: SignalReader<Type>, target: [Object, Key]): void;

// obj.prop
// obj.prop -> sig | fn | obj
//
export function unconnect<
  Object extends object,
  Key extends keyof ObjectProps<Object, Type>,
  Type,
>(
  source: [Object, Key],
  target?: SignalReader<Type> | ((val?: Type) => void) | object,
): void;

// obj.prop -> obj.prop
//
export function unconnect<
  Type,
  SourceObject extends object,
  TargetObject extends object,
  SourceKey extends keyof ObjectProps<SourceObject, Type>,
  TargetKey extends
    | keyof ObjectProps<TargetObject, Type>
    | ObjectMethods<TargetObject, Type>,
>(source: [SourceObject, SourceKey], target: [TargetObject, TargetKey]): void;

export function unconnect(source: any, target?: any): void {
  // tbd

  if (!Array.isArray(source)) {
    if (isSignal(source)) {
      if (target == null) {
        const connectionsBySignal = Connection.findConnectionsBySignal(source);
        if (connectionsBySignal) {
          for (const con of connectionsBySignal) {
            con.destroy();
          }
        }
      } else if (Array.isArray(target) || isSignal(target)) {
        Connection.findConnection(source, target as any)?.destroy();
      } else {
        const connectionsBySignal = Connection.findConnectionsBySignal(source);
        if (connectionsBySignal) {
          for (const con of connectionsBySignal) {
            if (con.hasTarget(target)) {
              con.destroy();
            }
          }
        }
      }
    }
    // else: source is object
    // --> recursive solution..
  }
  // else source is [object, prop]
  // --> if object.prop is signal then recursive solution
}
