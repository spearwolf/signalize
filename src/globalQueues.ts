import eventize from '@spearwolf/eventize';

/**
 * The _global_ event queue for signals
 */
export const globalSignalQueue = eventize({});

export const $runAgain = Symbol('runAgain');

/**
 * The _global_ event queue for effects
 */
export const globalEffectQueue = eventize({});

export const $createEffect = Symbol('createEffect');

/**
 * The _global_ event queue for batches
 */
export const globalBatchQueue = eventize({});

export const $batch = Symbol('batch');
