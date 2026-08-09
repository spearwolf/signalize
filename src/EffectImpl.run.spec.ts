import {getSubscriptionCount} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {beQuiet} from './bequiet.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {globalSignalQueue} from './global-queues.js';
import {destroySignal} from './signal-core.js';

describe('EffectImpl.run() lifecycle', () => {
  beforeEach(() => {
    assertEffectsCount(0, 'beforeEach');
    assertSignalsCount(0, 'beforeEach');
  });

  afterEach(() => {
    assertEffectsCount(0, 'afterEach');
    assertSignalsCount(0, 'afterEach');
  });

  it('a quiet run keeps the dependencies it is not allowed to re-register (BUG-005)', () => {
    const signalSubscriptions = getSubscriptionCount(globalSignalQueue);

    const {get: a, set: setA} = createSignal(0);
    const {get: b, set: setB} = createSignal(100);

    const seen: number[][] = [];
    const effect = createEffect(
      () => {
        seen.push([a(), b()]);
      },
      {autorun: false},
    );

    try {
      effect.run();
      expect(
        getSubscriptionCount(globalSignalQueue),
        'the tracked run subscribed to a and b',
      ).toBe(signalSubscriptions + 2);

      setA(1); // flips shouldRun; autorun: false, so nothing runs yet

      beQuiet(() => {
        effect.run();
      });

      expect(seen, 'the quiet run did execute the callback').toEqual([
        [0, 100],
        [1, 100],
      ]);
      expect(
        getSubscriptionCount(globalSignalQueue),
        'the quiet run left the dependency set alone',
      ).toBe(signalSubscriptions + 2);

      setB(200);
      effect.run();

      expect(
        seen,
        'the effect is still reachable through both signals',
      ).toEqual([
        [0, 100],
        [1, 100],
        [1, 200],
      ]);
    } finally {
      effect.destroy();
      destroySignal(a, b);
    }
  });

  it('a throwing callback still releases the dependency it stopped reading (BUG-006)', () => {
    const signalSubscriptions = getSubscriptionCount(globalSignalQueue);

    const {get: cond, set: setCond} = createSignal(true);
    const {get: x, set: setX} = createSignal(1);
    const {get: y} = createSignal(2);

    let boom = false;
    const seen: string[] = [];

    const effect = createEffect(() => {
      seen.push(cond() ? `x=${x()}` : `y=${y()}`);
      if (boom) throw new Error('boom');
    });

    try {
      expect(getSubscriptionCount(globalSignalQueue), 'cond and x').toBe(
        signalSubscriptions + 2,
      );

      boom = true;
      expect(() => {
        setCond(false);
      }).toThrow('boom');

      expect(
        getSubscriptionCount(globalSignalQueue),
        'x is gone and y took its place, even though the callback threw',
      ).toBe(signalSubscriptions + 2);

      boom = false;
      const runsBefore = seen.length;
      setX(99);

      expect(
        seen.length - runsBefore,
        'a write to the signal it no longer reads does not wake it',
      ).toBe(0);
    } finally {
      effect.destroy();
      destroySignal(cond, x, y);
    }
  });

  it('a callback that throws before its first read keeps every dependency', () => {
    const signalSubscriptions = getSubscriptionCount(globalSignalQueue);

    const {get: a, set: setA} = createSignal(0);
    const {get: b} = createSignal(100);

    let boom = false;
    const seen: number[][] = [];

    const effect = createEffect(() => {
      // The throw happens *before* the first read — a transient failure the
      // run does not survive long enough to record anything with.
      if (boom) throw new Error('boom');
      seen.push([a(), b()]);
    });

    try {
      expect(getSubscriptionCount(globalSignalQueue), 'a and b').toBe(
        signalSubscriptions + 2,
      );

      boom = true;
      expect(() => {
        setA(1);
      }).toThrow('boom');

      expect(
        getSubscriptionCount(globalSignalQueue),
        'a run that never reached a read committed no dependency set',
      ).toBe(signalSubscriptions + 2);

      boom = false;
      const runsBefore = seen.length;
      setA(2);

      expect(
        seen.length - runsBefore,
        'the effect recovered and still wakes on a write',
      ).toBe(1);
    } finally {
      effect.destroy();
      destroySignal(a, b);
    }
  });

  it('a completed run that reads nothing at all still drops every dependency', () => {
    const signalSubscriptions = getSubscriptionCount(globalSignalQueue);

    const {get: flag, set: setFlag} = createSignal(true);
    const {get: a, set: setA} = createSignal(1);

    let readEverything = true;
    const seen: string[] = [];

    const effect = createEffect(() => {
      // Shrinking to *zero* reads is still a legitimate result of dynamic
      // tracking, not a run that fell over before it could read anything.
      if (readEverything) {
        seen.push(`${flag()}/${a()}`);
      } else {
        seen.push('nothing');
      }
    });

    try {
      expect(getSubscriptionCount(globalSignalQueue), 'flag and a').toBe(
        signalSubscriptions + 2,
      );

      readEverything = false;
      setFlag(false);

      expect(
        getSubscriptionCount(globalSignalQueue),
        'a run that read nothing and returned normally unsubscribed everything',
      ).toBe(signalSubscriptions);

      const runsBefore = seen.length;
      setFlag(true);
      setA(2);

      expect(
        seen.length - runsBefore,
        'neither signal can wake the effect anymore',
      ).toBe(0);
    } finally {
      effect.destroy();
      destroySignal(flag, a);
    }
  });

  it('every nested run of a self-writing effect releases its own resource (BUG-007)', () => {
    const held = new Set<string>();
    const {get: n, set: setN} = createSignal(0);

    const effect = createEffect(() => {
      const v = n();
      const res = `res@${v}`;
      held.add(res);
      if (v < 3) setN(v + 1);
      return () => {
        held.delete(res);
      };
    });

    try {
      expect(
        [...held],
        'the superseded runs handed their cleanups over instead of losing them',
      ).toEqual(['res@3']);

      effect.destroy();

      expect([...held], 'destroy() released the last one').toEqual([]);
    } finally {
      effect.destroy();
      destroySignal(n);
    }
  });

  it('a cleanup that re-enters run() does not drop the nested cleanup (BUG-007)', () => {
    const held = new Set<string>();
    const released: string[] = [];
    const {get: n, set: setN} = createSignal(0);

    // Several bounces, not one: with a single bounce the slot is written
    // before or after the displaced cleanup runs with the same result, and
    // the ordering inside acceptCleanupCallback() goes unchecked. From the
    // second bounce on, running the displaced cleanup before the assignment
    // lets the re-entered run find the stale slot and release the same
    // handle twice — which `released` catches.
    let bounces = 3;
    let acquired = 0;

    const effect = createEffect(() => {
      n();
      const res = `handle#${acquired++}`;
      held.add(res);
      return () => {
        held.delete(res);
        released.push(res);
        if (bounces > 0) {
          bounces -= 1;
          setN(100 + bounces);
        }
      };
    });

    try {
      setN(1);

      expect(
        released.length,
        'no cleanup ran twice — the slot is assigned before the displaced one runs',
      ).toBe(new Set(released).size);

      expect(
        [...held],
        'every displaced cleanup ran instead of being overwritten',
      ).toEqual([`handle#${acquired - 1}`]);

      effect.destroy();

      expect([...held], 'destroy() released the last one').toEqual([]);
      expect(released.length, 'every acquired handle was released once').toBe(
        acquired,
      );
    } finally {
      effect.destroy();
      destroySignal(n);
    }
  });
});
