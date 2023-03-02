import eventize from '@spearwolf/eventize';

export const globalSignalQueue = eventize({});

export const $runAgain = Symbol('runAgain');

// TODO remove globalDestroySignalQueue, use signal.on(destroy) instead

export const globalDestroySignalQueue = eventize({});

export const $destroySignal = Symbol('destroySignal');

export const globalEffectQueue = eventize({});

export const $createEffect = Symbol('createEffect');

export const globalBatchQueue = eventize({});

export const $batch = Symbol('batch');
