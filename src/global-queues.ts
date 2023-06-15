import {eventize} from '@spearwolf/eventize';

export const globalSignalQueue = eventize({});
export const globalDestroySignalQueue = eventize({});
export const globalEffectQueue = eventize({});
