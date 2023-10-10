import {getSignalInstance, isSignal} from './createSignal.js';
import {queryObjectSignal} from './object-signals-and-effects.js';
import type {SignalReader} from './types.js';

function value<Type>(source: SignalReader<Type>): Type;

function value<O extends object, K extends keyof O>(source: [O, K]): O[K];

function value(source: any) {
  return isSignal(source)
    ? (getSignalInstance(source)?.value as any)
    : (getSignalInstance(queryObjectSignal(...(source as [any, any])))
        ?.value as any);
}

export {value};
