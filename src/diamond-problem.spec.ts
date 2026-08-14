import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  destroySignal,
} from './index.js';

describe('the diamond problem', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
    assertLinksCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
    assertLinksCount(0, 'afterEach');
  });

  describe('the equality check', () => {
    it('does not recompute a memo whose source memo returns an unchanged value', () => {
      let bCalls = 0;
      let cCalls = 0;
      let dCalls = 0;

      const a = createSignal(1);
      const b = createMemo(() => {
        ++bCalls;
        return a.get() * 0;
      });
      const c = createMemo(() => {
        ++cCalls;
        return b() + 1;
      });
      const d = createEffect(() => {
        ++dCalls;
        b();
        c();
      });

      try {
        expect([bCalls, cCalls, dCalls]).toEqual([1, 1, 1]);

        a.set(2);
        a.set(3);

        expect(bCalls).toBe(3);
        expect([cCalls, dCalls]).toEqual([1, 1]);
      } finally {
        d.destroy();
        destroySignal(c, b, a);
      }
    });

    it('does not rerun an effect whose source signal is rewritten with an unchanged value', () => {
      let bCalls = 0;
      let cCalls = 0;
      let dCalls = 0;

      const a = createSignal(1);
      const b = createSignal(0);
      const c = createSignal(0);

      const effB = createEffect(() => {
        ++bCalls;
        b.set(a.get() * 0);
      });
      const effC = createEffect(() => {
        ++cCalls;
        c.set(b.get() + 1);
      });
      const effD = createEffect(() => {
        ++dCalls;
        b.get();
        c.get();
      });

      try {
        expect([bCalls, cCalls, dCalls]).toEqual([1, 1, 1]);

        a.set(2);
        a.set(3);

        expect(bCalls).toBe(3);
        expect([cCalls, dCalls]).toEqual([1, 1]);
      } finally {
        effD.destroy();
        effC.destroy();
        effB.destroy();
        destroySignal(c, b, a);
      }
    });
  });

  describe('two paths converging on one effect', () => {
    it('runs the converging effect once per path, the first run on a half-updated graph', () => {
      const seen: Array<[number, number]> = [];

      const a = createSignal(1);
      const b = createMemo(() => a.get() * 2);
      const c = createMemo(() => a.get() + 1);
      const d = createEffect(() => {
        seen.push([b(), c()]);
      });

      try {
        expect(seen).toEqual([[2, 2]]);
        seen.length = 0;

        a.set(2);

        expect(seen).toEqual([
          [4, 2], // b updated, c still on the old value
          [4, 3],
        ]);
      } finally {
        d.destroy();
        destroySignal(c, b, a);
      }
    });

    it('settles every source before the converging effect runs inside batch()', () => {
      const seen: Array<[number, number]> = [];

      const a = createSignal(1);
      const b = createMemo(() => a.get() * 2);
      const c = createMemo(() => a.get() + 1);
      const d = createEffect(() => {
        seen.push([b(), c()]);
      });

      try {
        seen.length = 0;

        batch(() => {
          a.set(2);
        });

        expect(seen).toEqual([
          [4, 3],
          [4, 3],
        ]);
      } finally {
        d.destroy();
        destroySignal(c, b, a);
      }
    });

    it('runs the converging effect once when both paths share one memo', () => {
      const seen: Array<{b: number; c: number}> = [];

      const a = createSignal(1);
      const bc = createMemo(() => ({b: a.get() * 2, c: a.get() + 1}));
      const d = createEffect(() => {
        seen.push(bc());
      });

      try {
        seen.length = 0;

        a.set(2);

        expect(seen).toEqual([{b: 4, c: 3}]);
      } finally {
        d.destroy();
        destroySignal(bc, a);
      }
    });
  });
});
