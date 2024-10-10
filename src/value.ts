import {getSignalInstance, isSignal} from './createSignal.js';
import {findObjectSignalByName} from './object-signals.js';
import type {SignalLike} from './types.js';

function value<Type>(source: SignalLike<Type>): Type;

function value<O extends object, K extends keyof O>(source: [O, K]): O[K];

function value(source: any) {
  return isSignal(source)
    ? (getSignalInstance(source)?.value as any)
    : (getSignalInstance(findObjectSignalByName(...(source as [any, any])))
        ?.value as any);
}

export {value};
