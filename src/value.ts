import {getSignal, isSignal} from './createSignal';
import {queryObjectSignal} from './object-signals-and-effects';
import {SignalReader} from './types';

function value<Type>(source: SignalReader<Type>): Type;
function value<O, K extends keyof O>(source: [O, K]): O[K];
function value(source: any) {
  return isSignal(source)
    ? (getSignal(source)?.value as any)
    : (getSignal(queryObjectSignal(...(source as [any, any])))?.value as any);
}

export {value};
