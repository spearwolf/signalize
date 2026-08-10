import {isEventized} from '@spearwolf/eventize';

import {
  globalDestroySignalQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './global-queues.js';

// No counter guards here: these three tests only check that the module-level
// queues are eventized. None of them creates a signal, effect or link, so
// there is nothing for `assertEffectsCount`/`assertSignalsCount`/
// `assertLinksCount` to watch.
describe('global queues', () => {
  it('has eventized signal queue', () => {
    expect(isEventized(globalSignalQueue)).toBeTruthy();
  });

  it('has eventized destroy signal queue', () => {
    expect(isEventized(globalDestroySignalQueue)).toBeTruthy();
  });

  it('has eventized effect queue', () => {
    expect(isEventized(globalEffectQueue)).toBeTruthy();
  });
});
