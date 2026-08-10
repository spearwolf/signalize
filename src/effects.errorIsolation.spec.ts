import {emit, getSubscriptionCount, on} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {batch} from './batch.js';
import {$effect, RECALL} from './constants.js';
import {createSignal} from './createSignal.js';
import {createEffect, getEffectsCount} from './effects.js';
import {globalEffectQueue, globalSignalQueue} from './global-queues.js';
import {link} from './link.js';
import {destroySignal, getSignalsCount} from './signal-core.js';

const effectIdOf = (effect: {[$effect]?: {id: symbol}}): symbol =>
  effect[$effect]!.id;

describe('a throwing effect callback does not silence its siblings (BUG-004)', () => {
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

  it('delivers to every effect and throws the failure afterwards', () => {
    const sig = createSignal(0);
    const order: string[] = [];
    const seen: number[] = [];
    const boom = new Error('effect A failed');
    let armed = false;

    const a = createEffect(
      () => {
        seen.push(sig.get());
        order.push('a');
        if (armed) throw boom;
      },
      {priority: 10},
    );
    const b = createEffect(
      () => {
        seen.push(sig.get());
        order.push('b');
      },
      {priority: 5},
    );
    const c = createEffect(
      () => {
        seen.push(sig.get());
        order.push('c');
      },
      {priority: 1},
    );

    try {
      order.length = 0;
      seen.length = 0;
      armed = true;

      let thrown: unknown;
      try {
        sig.set(1);
      } catch (err) {
        thrown = err;
      }

      expect(order, 'every effect ran, in priority order').toEqual([
        'a',
        'b',
        'c',
      ]);
      expect(seen, 'the siblings saw the value that was written').toEqual([
        1, 1, 1,
      ]);
      expect(thrown, 'a single failure arrives unchanged').toBe(boom);
    } finally {
      a.destroy();
      b.destroy();
      c.destroy();
      destroySignal(sig);
    }
  });

  it('bundles several failures of one write into an AggregateError', () => {
    const sig = createSignal(0);
    const first = new Error('boom1');
    const second = new Error('boom2');
    const order: string[] = [];
    let armed = false;

    const a = createEffect(
      () => {
        sig.get();
        order.push('a');
        if (armed) throw first;
      },
      {priority: 10},
    );
    const b = createEffect(
      () => {
        sig.get();
        order.push('b');
        if (armed) throw second;
      },
      {priority: 5},
    );
    const c = createEffect(
      () => {
        sig.get();
        order.push('c');
      },
      {priority: 1},
    );

    try {
      order.length = 0;
      armed = true;

      let thrown: any;
      try {
        sig.set(1);
      } catch (err) {
        thrown = err;
      }

      expect(order).toEqual(['a', 'b', 'c']);
      expect(thrown).toBeInstanceOf(AggregateError);
      expect(thrown.errors, 'in delivery order').toEqual([first, second]);
      expect(thrown.message).toBe(
        '[signalize] 2 errors while notifying the effects of a signal write',
      );
    } finally {
      a.destroy();
      b.destroy();
      c.destroy();
      destroySignal(sig);
    }
  });

  it('gives a nested write its own error pot', () => {
    const outerSig = createSignal(0);
    const innerSig = createSignal(0);
    const innerBoom = new Error('inner boom');
    const outerBoom = new Error('outer boom');
    let armed = false;
    let caughtInside: unknown;
    let lowRuns = 0;

    const writer = createEffect(
      () => {
        outerSig.get();
        try {
          innerSig.set(innerSig.value + 1);
        } catch (err) {
          caughtInside = err;
        }
      },
      {priority: 10},
    );
    const innerEffect = createEffect(
      () => {
        innerSig.get();
        if (armed) throw innerBoom;
      },
      {priority: 3},
    );
    const failing = createEffect(
      () => {
        outerSig.get();
        if (armed) throw outerBoom;
      },
      {priority: 5},
    );
    const low = createEffect(
      () => {
        outerSig.get();
        lowRuns++;
      },
      {priority: 1},
    );

    try {
      lowRuns = 0;
      armed = true;

      let thrown: unknown;
      try {
        outerSig.set(1);
      } catch (err) {
        thrown = err;
      }

      expect(caughtInside, 'the inner write threw at its own call site').toBe(
        innerBoom,
      );
      expect(lowRuns, 'the outer delivery went on').toBe(1);
      expect(thrown, 'the inner pot was not merged into the outer one').toBe(
        outerBoom,
      );
    } finally {
      writer.destroy();
      innerEffect.destroy();
      failing.destroy();
      low.destroy();
      destroySignal(outerSig, innerSig);
    }
  });

  it('lets an uncaught nested failure become the failure of the writing effect', () => {
    const outerSig = createSignal(0);
    const innerSig = createSignal(0);
    const innerBoom = new Error('inner boom');
    const outerBoom = new Error('outer boom');
    let armed = false;
    let lowRuns = 0;

    const writer = createEffect(
      () => {
        outerSig.get();
        innerSig.set(innerSig.value + 1);
      },
      {priority: 10},
    );
    const innerEffect = createEffect(
      () => {
        innerSig.get();
        if (armed) throw innerBoom;
      },
      {priority: 3},
    );
    const failing = createEffect(
      () => {
        outerSig.get();
        if (armed) throw outerBoom;
      },
      {priority: 5},
    );
    const low = createEffect(
      () => {
        outerSig.get();
        lowRuns++;
      },
      {priority: 1},
    );

    try {
      lowRuns = 0;
      armed = true;

      let thrown: any;
      try {
        outerSig.set(1);
      } catch (err) {
        thrown = err;
      }

      expect(lowRuns).toBe(1);
      expect(thrown).toBeInstanceOf(AggregateError);
      expect(
        thrown.errors,
        'one entry per failing effect of this write',
      ).toEqual([innerBoom, outerBoom]);
    } finally {
      writer.destroy();
      innerEffect.destroy();
      failing.destroy();
      low.destroy();
      destroySignal(outerSig, innerSig);
    }
  });

  it('keeps a failure already parked out of a nested write pot', () => {
    const outerSig = createSignal(0);
    const innerSig = createSignal(0);
    const firstBoom = new Error('first boom');
    const innerBoom = new Error('inner boom');
    let armed = false;
    let caughtInside: unknown;
    let lowRuns = 0;

    // Priority 20 — ahead of the writer, so the outer pot is *not* empty by
    // the time the nested frame opens. That is the one state the save-and-
    // restore in beginIsolatedDelivery()/endIsolatedDelivery() exists for:
    // with the writer running first, both halves are no-ops and a broken
    // implementation passes unnoticed.
    const first = createEffect(
      () => {
        outerSig.get();
        if (armed) throw firstBoom;
      },
      {priority: 20},
    );
    const writer = createEffect(
      () => {
        outerSig.get();
        try {
          innerSig.set(innerSig.value + 1);
        } catch (err) {
          caughtInside = err;
        }
      },
      {priority: 10},
    );
    const innerEffect = createEffect(
      () => {
        innerSig.get();
        if (armed) throw innerBoom;
      },
      {priority: 3},
    );
    const low = createEffect(
      () => {
        outerSig.get();
        lowRuns++;
      },
      {priority: 1},
    );

    try {
      lowRuns = 0;
      armed = true;

      let thrown: unknown;
      try {
        outerSig.set(1);
      } catch (err) {
        thrown = err;
      }

      expect(
        caughtInside,
        'the nested write saw its own failure only, not the parked one',
      ).toBe(innerBoom);
      expect(lowRuns, 'the outer delivery went on').toBe(1);
      expect(
        thrown,
        'the outer pot came back from the nested frame intact and alone',
      ).toBe(firstBoom);
    } finally {
      first.destroy();
      writer.destroy();
      innerEffect.destroy();
      low.destroy();
      destroySignal(outerSig, innerSig);
    }
  });

  it('runs every delayed effect of a batch before the flush throws', () => {
    const sig = createSignal(0);
    const boom = new Error('batch boom');
    let armed = false;
    let lowRuns = 0;

    const failing = createEffect(
      () => {
        sig.get();
        if (armed) throw boom;
      },
      {priority: 10},
    );
    const low = createEffect(
      () => {
        sig.get();
        lowRuns++;
      },
      {priority: 1},
    );

    try {
      lowRuns = 0;
      armed = true;

      let thrown: unknown;
      try {
        batch(() => {
          sig.set(1);
        });
      } catch (err) {
        thrown = err;
      }

      expect(lowRuns, 'the flush reached the lower priority').toBe(1);
      expect(thrown, 'and threw at the batch() caller afterwards').toBe(boom);
    } finally {
      failing.destroy();
      low.destroy();
      destroySignal(sig);
    }
  });

  it('keeps the failures already collected when a link callback aborts the delivery', () => {
    const sig = createSignal(0);
    const effectBoom = new Error('effect boom');
    const linkBoom = new Error('link boom');
    let armed = false;
    let lowRuns = 0;

    const failing = createEffect(
      () => {
        sig.get();
        if (armed) throw effectBoom;
      },
      {priority: 10},
    );
    const theLink = link(sig, () => {
      if (armed) throw linkBoom;
    });
    const low = createEffect(
      () => {
        sig.get();
        lowRuns++;
      },
      {priority: -5},
    );

    try {
      lowRuns = 0;
      armed = true;

      let thrown: any;
      try {
        sig.set(1);
      } catch (err) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(AggregateError);
      expect(
        thrown.errors,
        'the effect failure was not lost behind the link failure',
      ).toEqual([effectBoom, linkBoom]);
      expect(
        lowRuns,
        'a throwing link callback is not isolated and does end the delivery',
      ).toBe(0);
    } finally {
      theLink.destroy();
      failing.destroy();
      low.destroy();
      destroySignal(sig);
    }
  });

  it('does not let a foreign listener on the effect queue stop a flush', () => {
    const sig = createSignal(0);
    const boom = new Error('foreign queue boom');
    let lowRuns = 0;

    const high = createEffect(
      () => {
        sig.get();
      },
      {priority: 10},
    );
    const low = createEffect(
      () => {
        sig.get();
        lowRuns++;
      },
      {priority: 1},
    );

    const unsubscribe = on(globalEffectQueue, effectIdOf(high), () => {
      throw boom;
    });

    try {
      lowRuns = 0;

      let thrown: unknown;
      try {
        batch(() => {
          sig.set(1);
        });
      } catch (err) {
        thrown = err;
      }

      expect(lowRuns).toBe(1);
      expect(thrown).toBe(boom);
    } finally {
      unsubscribe();
      high.destroy();
      low.destroy();
      destroySignal(sig);
    }
  });

  // Documentation test, no isolation path involved: `Effect.run()` calls
  // `EffectImpl.run()` directly and never passes through `[RECALL]`, so this
  // cannot fail on a broken frame — the unframed-RECALL test below is what
  // guards that. It is here because `docs/api.md` names `effect.run()` among
  // the callers a synchronous throw reaches, and that promise deserves a test.
  it('documents that a direct run() throws at its caller', () => {
    const sig = createSignal(0);
    const boom = new Error('direct boom');
    let armed = false;

    const effect = createEffect(() => {
      sig.get();
      if (armed) throw boom;
    });

    try {
      armed = true;

      expect(() => {
        effect[$effect]!.shouldRun = true;
        effect.run();
      }).toThrow('direct boom');
    } finally {
      effect.destroy();
      destroySignal(sig);
    }
  });

  it('throws at the emitter of a RECALL outside any delivery', () => {
    const sig = createSignal(0);
    const boom = new Error('unframed boom');
    let armed = false;

    const effect = createEffect(() => {
      sig.get();
      if (armed) throw boom;
    });

    try {
      armed = true;
      const id = effectIdOf(effect);

      expect(() => {
        emit(globalEffectQueue, id, id, RECALL);
      }).toThrow('unframed boom');
    } finally {
      effect.destroy();
      destroySignal(sig);
    }
  });

  it('leaves nothing behind after a run of failing writes', () => {
    const signalSubscriptions = getSubscriptionCount(globalSignalQueue);
    const effectSubscriptions = getSubscriptionCount(globalEffectQueue);
    const effects = getEffectsCount();
    const signals = getSignalsCount();

    const sig = createSignal(0);
    let armed = false;
    const failing = createEffect(() => {
      sig.get();
      if (armed) throw new Error('boom');
    });
    const sibling = createEffect(() => sig.get(), {priority: -1});

    try {
      armed = true;
      for (let i = 1; i <= 3; i++) {
        expect(() => sig.set(i)).toThrow('boom');
      }

      // No delivery frame stayed open either: an unframed RECALL still finds
      // `collectDeliveryError()` refusing the error and throws at its emitter.
      // A frame leaked by one of the three writes above would swallow it here.
      const failingId = effectIdOf(failing);
      expect(() =>
        emit(globalEffectQueue, failingId, failingId, RECALL),
      ).toThrow('boom');

      failing.destroy();
      sibling.destroy();
      destroySignal(sig);

      expect(getSubscriptionCount(globalSignalQueue)).toBe(signalSubscriptions);
      expect(getSubscriptionCount(globalEffectQueue)).toBe(effectSubscriptions);
      expect(getEffectsCount()).toBe(effects);
      expect(getSignalsCount()).toBe(signals);
    } finally {
      failing.destroy();
      sibling.destroy();
      destroySignal(sig);
    }
  });
});
