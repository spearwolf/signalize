import type {MockInstance} from 'vitest';
import {$signalizeInstances} from './constants.js';
import {
  registerSignalizeInstance,
  type SignalizeInstanceRecord,
} from './instances.js';
import type {SignalizeErrorPayload} from './types.js';

const register = (): SignalizeInstanceRecord[] =>
  (globalThis as Record<symbol, unknown>)[
    $signalizeInstances
  ] as SignalizeInstanceRecord[];

const clearRegister = (): void => {
  delete (globalThis as Record<symbol, unknown>)[$signalizeInstances];
};

describe('registerSignalizeInstance', () => {
  // The register lives on `globalThis`, which the fork keeps for the whole
  // file — without this every test would see its predecessors' records.
  beforeEach(clearRegister);
  afterEach(clearRegister);

  it('stays quiet for one copy and reports the second through the first', () => {
    const seen: SignalizeErrorPayload[] = [];

    expect(
      registerSignalizeInstance('file:///first/index.js', (payload) => {
        seen.push(payload);
      }),
    ).toBe(1);
    expect(seen).toHaveLength(0);

    expect(
      registerSignalizeInstance('file:///second/index.js', () => {
        throw new Error('the newcomer must not be asked');
      }),
    ).toBe(2);

    expect(seen).toHaveLength(1);
    expect(seen[0].level).toBe('error');
    expect(seen[0].source).toBe('multiple-instances');
    expect(seen[0].message).toContain('file:///first/index.js');
    expect(seen[0].message).toContain('file:///second/index.js');
    expect(seen[0].error).toBeUndefined();
  });

  it('falls back to its own reporter when the foreign record has none', () => {
    // A record from another version — its shape is not this version's promise.
    (globalThis as Record<symbol, unknown>)[$signalizeInstances] = [
      {url: 'file:///older-version/index.js'},
    ];

    const seen: SignalizeErrorPayload[] = [];

    expect(
      registerSignalizeInstance('file:///new/index.js', (payload) => {
        seen.push(payload);
      }),
    ).toBe(2);

    expect(seen).toHaveLength(1);
    expect(seen[0].source).toBe('multiple-instances');
    expect(seen[0].message).toContain('file:///older-version/index.js');
  });

  it('does not let a throwing foreign reporter escape', () => {
    (globalThis as Record<symbol, unknown>)[$signalizeInstances] = [
      {
        url: 'file:///older-version/index.js',
        report: () => {
          throw new Error('boom');
        },
      },
    ];

    const seen: SignalizeErrorPayload[] = [];

    expect(() =>
      registerSignalizeInstance('file:///new/index.js', (payload) => {
        seen.push(payload);
      }),
    ).not.toThrow();

    expect(seen).toHaveLength(1);
    expect(seen[0].source).toBe('multiple-instances');
  });

  // The register is a container this copy does not own. All three states
  // below made `import '@spearwolf/signalize'` fail outright before the outer
  // `try` went in — the worst outcome this module could produce, since the
  // whole point of it is a message instead of a throw.
  it('survives a register that is not an array', () => {
    (globalThis as Record<symbol, unknown>)[$signalizeInstances] =
      'a squatter on the symbol';

    // `0` says: not registered. A throw here would take the import with it.
    expect(registerSignalizeInstance('file:///new/index.js', () => {})).toBe(0);
  });

  it('survives a frozen register', () => {
    const seen: SignalizeErrorPayload[] = [];
    (globalThis as Record<symbol, unknown>)[$signalizeInstances] =
      Object.freeze([
        {url: 'file:///older-version/index.js', report: () => {}},
      ]);

    expect(
      registerSignalizeInstance('file:///new/index.js', (payload) => {
        seen.push(payload);
      }),
    ).toBe(0);
    // The record never went in, so there is nothing to report either.
    expect(seen).toHaveLength(0);
  });

  it('survives a globalThis that refuses the assignment', () => {
    // Stands in for the frozen `globalThis` of an SES `lockdown()`: the
    // assignment is refused at the same statement, with the same `TypeError`.
    // Freezing the real `globalThis` cannot be undone inside the process.
    Object.defineProperty(globalThis, $signalizeInstances, {
      value: undefined,
      writable: false,
      configurable: true,
    });

    expect(registerSignalizeInstance('file:///new/index.js', () => {})).toBe(0);
  });

  it('notices a real second copy of the library', async () => {
    // How two copies are made at all: `vi.resetModules()` plus a dynamic
    // import. `import('./index.js?v=2')` does **not** work — Node hands back
    // the very same module. Outside Vitest only a second file path does.
    const errorSpy: MockInstance = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    try {
      const A = await import('./index.js');
      expect(register()).toHaveLength(1);
      expect(errorSpy).not.toHaveBeenCalled();

      vi.resetModules();
      const B = await import('./index.js');

      expect(A.createSignal).not.toBe(B.createSignal);
      expect(register()).toHaveLength(2);

      // Nobody listens on the older copy's queue, so the message lands on the
      // console — once.
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(String(errorSpy.mock.calls[0][0])).toContain(
        '2 copies of @spearwolf/signalize are loaded in this process',
      );

      // And the trap the sentinel names, in the same test: the foreign signal is
      // accepted and then never heard from again.
      const sigA = A.createSignal(1);
      try {
        expect(B.isSignal(sigA)).toBe(true);

        let runs = 0;
        const effect = B.createEffect(() => {
          sigA.get();
          runs += 1;
        });
        expect(runs).toBe(1);

        sigA.set(2);
        expect(runs).toBe(1);

        effect.destroy();
      } finally {
        A.destroySignal(sigA);
      }
    } finally {
      errorSpy.mockRestore();
    }
  });
});
