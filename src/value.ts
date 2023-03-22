import {SignalReader} from './types';
import {getSignal} from './createSignal';
import {queryObjectSignal} from './object-signals-and-effects';

// TODO value([obj, propKey])

// export const value = <Type = unknown>(
//   signalReader: SignalReader<Type>,
// ): Type | undefined => getSignal(signalReader)?.value;

export const value = <Type = unknown>(
  ...args: [SignalReader<Type>] | [object, string | symbol]
): Type | undefined =>
  args.length === 1
    ? getSignal(...args)?.value
    : getSignal(queryObjectSignal(...args) as SignalReader<any> | undefined)
        ?.value;
