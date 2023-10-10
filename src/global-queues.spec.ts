import {isEventized} from '@spearwolf/eventize';

import {
  globalDestroySignalQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './global-queues.js';

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
