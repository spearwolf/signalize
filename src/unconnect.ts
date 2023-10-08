import {Connection, type ConnectionTargetType} from './Connection';
import {isSignal} from './createSignal';
import {
  queryObjectSignal,
  queryObjectSignals,
} from './object-signals-and-effects';
import type {SignalReader} from './types';

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

// obj
// obj -> sig | fn | obj
//
export function unconnect<Type>(
  source: object,
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
        // --------------------------------------------------
        // unconnect( signal )
        // --------------------------------------------------
        const connectionsBySignal = Connection.findConnectionsBySignal(source);
        if (connectionsBySignal) {
          for (const con of connectionsBySignal) {
            con.destroy();
          }
        }
        destroyConnectionsByTarget(source);
      } else if (isSignal(target)) {
        // --------------------------------------------------
        // unconnect( signal, signal )
        // --------------------------------------------------
        Connection.findConnection(source, target as any)?.destroy();
      } else if (Array.isArray(target)) {
        // --------------------------------------------------
        // unconnect( signal, [object, property] )
        // --------------------------------------------------
        Connection.findConnection(
          source,
          queryObjectSignal(...(target as [object, keyof object])) ??
            (target as any),
        )?.destroy();
      } else {
        // --------------------------------------------------
        // unconnect( signal, object | function )
        // --------------------------------------------------
        const connectionsBySignal = Connection.findConnectionsBySignal(source);
        if (connectionsBySignal) {
          for (const con of connectionsBySignal) {
            if (con.hasTarget(target)) {
              con.destroy();
            }
          }
        }
      }
    } else {
      // --------------------------------------------------
      // unconnect( object[, ...] )
      // --------------------------------------------------
      const objectSignals = queryObjectSignals(source);
      if (objectSignals) {
        for (const sig of objectSignals) {
          unconnect(sig, target);
        }
      }
      // --------------------------------------------------
      // unconnect( object )
      // --------------------------------------------------
      if (target == null) {
        destroyConnectionsByTarget(source);
      }
    }
  } else {
    // source is [object, prop]
    const signal = queryObjectSignal(source[0], source[1]);
    if (signal != null) {
      unconnect(signal, target);
    }
  }
}

function destroyConnectionsByTarget(target: ConnectionTargetType) {
  const connectionsByTarget = Connection.findConnectionsByTarget(target);
  if (connectionsByTarget) {
    for (const con of connectionsByTarget) {
      con.destroy();
    }
  }
}
