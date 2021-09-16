import globalSignals from './globalSignals';

describe('globalSignals', () => {
  it('exists', () => {
    expect(globalSignals).toBeDefined();
  });

  it('on() exists', () => {
    expect(typeof globalSignals.on).toBe('function');
  });

  it('off() exists', () => {
    expect(typeof globalSignals.off).toBe('function');
  });

  it('emit() exists', () => {
    expect(typeof globalSignals.emit).toBe('function');
  });
});
