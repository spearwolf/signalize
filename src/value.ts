import {SignalReader} from './types';
import {getSignal} from './createSignal';

// TODO value([obj, propKey])

export const value = <Type = unknown>(
  signalReader: SignalReader<Type>,
): Type | undefined => getSignal(signalReader)?.value;
