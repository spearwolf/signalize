import {getSubscriptionCount} from '@spearwolf/eventize';
import type {MockInstance} from 'vitest';
import {globalEffectQueue} from './global-queues.js';
import {onSignalizeError, reportSignalizeError} from './signalize-error.js';
import type {SignalizeErrorPayload} from './types.js';

describe('onSignalizeError', () => {
  let warnSpy: MockInstance;
  let errorSpy: MockInstance;
  let subsBefore: number;

  beforeEach(() => {
    subsBefore = getSubscriptionCount(globalEffectQueue);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    expect(getSubscriptionCount(globalEffectQueue)).toBe(subsBefore);
  });

  it('falls back to the console when nobody listens', () => {
    reportSignalizeError({
      level: 'warn',
      source: 'deprecation',
      message: 'a notice',
    });
    reportSignalizeError({
      level: 'error',
      source: 'group-finalizer',
      message: 'a failure',
      error: new Error('boom'),
    });
    expect(warnSpy).toHaveBeenCalledWith('a notice');
    expect(errorSpy).toHaveBeenCalledWith('a failure', expect.any(Error));
  });

  it('routes to a handler and stays off the console', () => {
    const seen: SignalizeErrorPayload[] = [];
    const unsubscribe = onSignalizeError((p) => seen.push(p));
    try {
      reportSignalizeError({
        level: 'error',
        source: 'link-finalizer',
        message: 'a failure',
        error: new Error('boom'),
      });
      expect(seen).toHaveLength(1);
      expect(seen[0].source).toBe('link-finalizer');
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it('honours the priority argument', () => {
    const order: string[] = [];
    const unsubLow = onSignalizeError(() => order.push('low'), -10);
    const unsubHigh = onSignalizeError(() => order.push('high'), 10);
    try {
      reportSignalizeError({
        level: 'warn',
        source: 'link-count',
        message: 'a notice',
      });
      expect(order).toEqual(['high', 'low']);
    } finally {
      unsubLow();
      unsubHigh();
    }
  });

  it('reports a throwing handler instead of letting it escape', () => {
    const original = new Error('boom');
    const unsubscribe = onSignalizeError(() => {
      throw new Error('handler boom');
    });
    try {
      expect(() =>
        reportSignalizeError({
          level: 'error',
          source: 'automap-finalizer',
          message: 'a failure',
          error: original,
        }),
      ).not.toThrow();
      expect(errorSpy).toHaveBeenCalledTimes(2);
      expect((errorSpy.mock.calls[0][1] as Error).message).toBe('handler boom');
      expect(errorSpy.mock.calls[1]).toEqual(['a failure', original]);
    } finally {
      unsubscribe();
    }
  });

  it('falls back to the console again once the last handler is gone', () => {
    const unsubscribe = onSignalizeError(() => {});
    unsubscribe();
    reportSignalizeError({
      level: 'warn',
      source: 'deprecation',
      message: 'a notice',
    });
    expect(warnSpy).toHaveBeenCalledWith('a notice');
  });

  it('the drift witness: a triple unsubscribe must not silence a still-registered sibling', () => {
    const seen: SignalizeErrorPayload[] = [];
    const unsubStaying = onSignalizeError((p) => seen.push(p));
    const unsubGoing = onSignalizeError(() => {});

    // eventize's own unsubscribe is idempotent — a naive counter without a
    // `released` guard would decrement three times for one subscription and
    // silence `unsubStaying`, which is still registered.
    unsubGoing();
    unsubGoing();
    unsubGoing();

    try {
      reportSignalizeError({
        level: 'error',
        source: 'automap-finalizer',
        message: 'a failure',
        error: new Error('boom'),
      });
      expect(seen).toHaveLength(1);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      unsubStaying();
    }
  });

  it('the same callback registered twice needs two unsubscribes to go quiet', () => {
    const seen: SignalizeErrorPayload[] = [];
    const callback = (p: SignalizeErrorPayload) => seen.push(p);
    const unsubFirst = onSignalizeError(callback);
    const unsubSecond = onSignalizeError(callback);

    reportSignalizeError({
      level: 'warn',
      source: 'deprecation',
      message: 'first',
    });
    expect(seen).toHaveLength(2); // one delivery per subscription
    seen.length = 0;

    unsubFirst();
    reportSignalizeError({
      level: 'warn',
      source: 'deprecation',
      message: 'second',
    });
    expect(seen).toHaveLength(1);
    expect(warnSpy).not.toHaveBeenCalled();
    seen.length = 0;

    unsubSecond();
    reportSignalizeError({
      level: 'warn',
      source: 'deprecation',
      message: 'third',
    });
    expect(seen).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith('third');
  });
});
