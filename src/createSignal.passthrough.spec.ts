import type {MockInstance} from 'vitest';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {createSignal} from './createSignal.js';
import {SignalGroup} from './SignalGroup.js';
import {destroySignal} from './signal-core.js';
import {onSignalizeError} from './signalize-error.js';
import type {SignalizeErrorPayload, SignalParams} from './types.js';

describe('createSignal(existingSignal, params) passthrough (API-012)', () => {
  let warnSpy: MockInstance;

  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  it('reports the options a passthrough drops, naming each one (API-012)', () => {
    const seen: SignalizeErrorPayload[] = [];
    const unsubscribe = onSignalizeError((payload) => {
      seen.push(payload);
    });

    const existing = createSignal(1);
    try {
      const same = createSignal(existing, {
        compare: () => true,
        beforeRead: () => {},
      });

      expect(same).toBe(existing);

      expect(seen).toHaveLength(1);
      expect(seen[0].source).toBe('ignored-option');
      expect(seen[0].level).toBe('warn');
      expect(seen[0].error).toBeUndefined();
      expect(seen[0].message).toBe(
        '[signalize] createSignal(existingSignal, {compare, beforeRead}) is a passthrough: it returns the signal that was passed in, so nothing in those braces is applied. Only {attach} works on this path. Configure the signal where it is created, or drop the options.',
      );
    } finally {
      unsubscribe();
      destroySignal(existing);
    }
  });

  it('names the dropped options in list order, not call order', () => {
    // PASSTHROUGH_IGNORED_OPTIONS is filtered in its own declared order
    // (lazy, compare, beforeRead), not Object.keys(params) order — so a
    // call that writes beforeRead before compare still reports compare
    // first. This is structural (a fixed list, not the call site), and
    // untested by test 1, whose object literal happens to already agree
    // with the list order.
    const seen: SignalizeErrorPayload[] = [];
    const unsubscribe = onSignalizeError((payload) => {
      seen.push(payload);
    });

    const existing = createSignal(1);
    try {
      createSignal(existing, {beforeRead: () => {}, compare: () => true});

      expect(seen).toHaveLength(1);
      expect(seen[0].message).toBe(
        '[signalize] createSignal(existingSignal, {compare, beforeRead}) is a passthrough: it returns the signal that was passed in, so nothing in those braces is applied. Only {attach} works on this path. Configure the signal where it is created, or drop the options.',
      );
    } finally {
      unsubscribe();
      destroySignal(existing);
    }
  });

  it('reports every such call, not once per process', () => {
    const seen: SignalizeErrorPayload[] = [];
    const unsubscribe = onSignalizeError((payload) => {
      seen.push(payload);
    });

    const existing = createSignal(1);
    try {
      // Three calls, three notices — the same rule createMemo({name}) without
      // {attach} follows: this marks a misspelled call, not a lifecycle event,
      // so no module-level flag silences it after the first one.
      createSignal(existing, {compare: () => true});
      createSignal(existing, {compare: () => true});
      createSignal(existing, {compare: () => true});

      expect(seen).toHaveLength(3);
      expect(seen.map((p) => p.source)).toEqual([
        'ignored-option',
        'ignored-option',
        'ignored-option',
      ]);
    } finally {
      unsubscribe();
      destroySignal(existing);
    }
  });

  it('stays quiet for {attach}, the one option the passthrough honours', () => {
    const seen: SignalizeErrorPayload[] = [];
    const unsubscribe = onSignalizeError((payload) => {
      seen.push(payload);
    });

    const existing = createSignal(1);
    const host = {};

    try {
      const same = createSignal(existing, {attach: host});

      expect(same).toBe(existing);
      expect(seen).toHaveLength(0);
      expect(warnSpy).not.toHaveBeenCalled();

      SignalGroup.delete(host);
      expect(existing.destroyed).toBe(true);
    } finally {
      unsubscribe();
    }
  });

  it('stays quiet without params', () => {
    const seen: SignalizeErrorPayload[] = [];
    const unsubscribe = onSignalizeError((payload) => {
      seen.push(payload);
    });

    const existing = createSignal(1);
    try {
      const same = createSignal(existing);

      expect(same).toBe(existing);
      expect(seen).toHaveLength(0);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
      destroySignal(existing);
    }
  });

  it('sees lazy through a SignalParams variable — the door 4a leaves open', () => {
    // createSignal(existing, {lazy: true}) is TS2769 since package 4a. Without
    // this door — a variable typed SignalParams<T> rather than a literal — the
    // `lazy` entry on PASSTHROUGH_IGNORED_OPTIONS would be a dead branch.
    const seen: SignalizeErrorPayload[] = [];
    const unsubscribe = onSignalizeError((payload) => {
      seen.push(payload);
    });

    const existing = createSignal(1);
    try {
      const params: SignalParams<number> = {lazy: true};
      const same = createSignal(existing, params);

      expect(same).toBe(existing);
      expect(existing.value).toBe(1);

      expect(seen).toHaveLength(1);
      expect(seen[0].source).toBe('ignored-option');
      expect(seen[0].message).toBe(
        '[signalize] createSignal(existingSignal, {lazy}) is a passthrough: it returns the signal that was passed in, so nothing in those braces is applied. Only {attach} works on this path. Configure the signal where it is created, or drop the options.',
      );
    } finally {
      unsubscribe();
      destroySignal(existing);
    }
  });

  it('sees the same passthrough through the reader', () => {
    // A SignalReader<T> is both a SignalLike<T> and a () => T — the factory
    // overload accepts it as the latter, and isSignal() recognises the same
    // object at runtime and routes it into the passthrough.
    const seen: SignalizeErrorPayload[] = [];
    const unsubscribe = onSignalizeError((payload) => {
      seen.push(payload);
    });

    const existing = createSignal(1);
    try {
      const same = createSignal(existing.get, {lazy: true});

      expect(same).toBe(existing);
      expect(existing.value).toBe(1);

      expect(seen).toHaveLength(1);
      expect(seen[0].source).toBe('ignored-option');
      expect(seen[0].message).toBe(
        '[signalize] createSignal(existingSignal, {lazy}) is a passthrough: it returns the signal that was passed in, so nothing in those braces is applied. Only {attach} works on this path. Configure the signal where it is created, or drop the options.',
      );
    } finally {
      unsubscribe();
      destroySignal(existing);
    }
  });

  it('changes nothing about what the passthrough does', () => {
    const unsubscribe = onSignalizeError(() => {});

    let compareCalls = 0;
    let beforeReadCalls = 0;

    const existing = createSignal(1);
    try {
      createSignal(existing, {
        compare: () => {
          compareCalls++;
          return true;
        },
        beforeRead: () => {
          beforeReadCalls++;
        },
      });

      existing.set(2);
      void existing.get();

      existing.set(3);
      void existing.get();

      expect(compareCalls).toBe(0);
      expect(beforeReadCalls).toBe(0);
      expect(existing.value).toBe(3);
    } finally {
      unsubscribe();
      destroySignal(existing);
    }
  });
});
