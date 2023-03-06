import {isEventized} from '@spearwolf/eventize';

import {
  globalBatchQueue,
  globalDestroySignalQueue,
  globalEffectQueue,
  globalSignalQueue,
} from './globalQueues';

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

  it('has eventized batch queue', () => {
    expect(isEventized(globalBatchQueue)).toBeTruthy();
  });
});
