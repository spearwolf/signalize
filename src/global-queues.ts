import {eventize} from '@spearwolf/eventize';

// TODO rename to gSignalQueue
export const globalSignalQueue = eventize();
export const globalDestroySignalQueue = eventize();
export const globalEffectQueue = eventize();
