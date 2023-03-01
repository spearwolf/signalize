import {globalSignalQueue} from './globalQueues';

describe('globalSignals', () => {
  it('exists', () => {
    expect(globalSignalQueue).toBeDefined();
  });

  it('on() exists', () => {
    expect(typeof globalSignalQueue.on).toBe('function');
  });

  it('off() exists', () => {
    expect(typeof globalSignalQueue.off).toBe('function');
  });

  it('emit() exists', () => {
    expect(typeof globalSignalQueue.emit).toBe('function');
  });
});
