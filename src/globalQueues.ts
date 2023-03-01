import eventize from '@spearwolf/eventize';

/**
 * The _global_ broadcaster object (or in other words: the main event queue)
 */
export const globalSignalQueue = eventize({});
