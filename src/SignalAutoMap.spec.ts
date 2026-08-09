import {getSubscriptionCount} from '@spearwolf/eventize';
import {
  assertEffectsCount,
  assertLinksCount,
  assertSignalsCount,
} from './__testing__/assert-helpers.js';
import {$autoMapResources} from './constants.js';
import {createSignal} from './createSignal.js';
import {createEffect} from './effects.js';
import {globalDestroySignalQueue, globalSignalQueue} from './global-queues.js';
import type {Signal} from './Signal.js';
import {SignalAutoMap} from './SignalAutoMap.js';
import {SignalGroup} from './SignalGroup.js';
import {destroySignal, isSignal} from './signal-core.js';

describe('SignalAutoMap', () => {
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

  it('get(), has() and clear()', () => {
    const sm = new SignalAutoMap();
    expect(sm.has('a')).toBe(false);
    expect(sm.get('a')).not.toBeUndefined();
    expect(sm.has('a')).toBe(true);
    sm.clear();
  });

  it('fromProps()', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3, d: undefined}, [
      'a',
      'b',
      'd',
    ]);
    expect(sm.get('a').value).toBe(1);
    expect(sm.get('b').value).toBe(2);
    expect(sm.has('c')).toBe(false);
    expect(sm.has('d')).toBe(true);
    sm.clear();
  });

  it('fromProps() without explicit keys', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3, d: undefined});
    expect(sm.get('a').value).toBe(1);
    expect(sm.get('b').value).toBe(2);
    expect(sm.has('c')).toBe(true);
    expect(sm.has('d')).toBe(true);
    sm.clear();
  });

  it('update()', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3}, ['a', 'b']);
    sm.update(new Map(Object.entries({a: 4, b: 5, c: 6})));
    expect(sm.get('a').value).toBe(4);
    expect(sm.get('b').value).toBe(5);
    expect(sm.get('c').value).toBe(6);
    sm.clear();
  });

  it('updateFromProps()', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3, d: undefined}, [
      'a',
      'b',
      'd',
    ]);
    sm.updateFromProps({a: 4, b: 5, c: 6, e: undefined, f: 7}, [
      'a',
      'c',
      'e',
      'f',
    ]);
    expect(sm.get('a').value).toBe(4);
    expect(sm.get('b').value).toBe(2);
    expect(sm.get('c').value).toBe(6);
    expect(sm.has('d')).toBeTruthy();
    expect(sm.has('e')).toBeTruthy();
    expect(sm.has('f')).toBeTruthy();
    sm.clear();
  });

  it('updateFromProps() from prototype chain', () => {
    const Base = class {
      a = 1;
      b = 2;
      c = 3;
    };
    const Derived = new (class extends Base {
      d = 4;
    })();
    const sm = SignalAutoMap.fromProps(Derived, ['a', 'd']);
    expect(sm.get('a').value).toBe(1);
    expect(sm.get('d').value).toBe(4);
    sm.clear();
  });

  it('signals() iterator', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3}, ['a', 'b']);
    const signals = Array.from(sm.signals());
    expect(signals.length).toBe(2);
    expect(isSignal(signals[0])).toBeTruthy();
    expect(isSignal(signals[1])).toBeTruthy();
    sm.clear();
  });

  it('keys() iterator', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3}, ['a', 'b', 'c']);
    const keys = Array.from(sm.keys());
    expect(keys.length).toBe(3);
    expect(keys).toContain('a');
    expect(keys).toContain('b');
    expect(keys).toContain('c');
    sm.clear();
  });

  it('entries() iterator', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2});
    const entries = Array.from(sm.entries());
    expect(entries.length).toBe(2);
    const keysFromEntries = entries.map(([key]) => key);
    expect(keysFromEntries).toContain('a');
    expect(keysFromEntries).toContain('b');
    for (const [, signal] of entries) {
      expect(isSignal(signal)).toBeTruthy();
    }
    sm.clear();
  });

  it('symbol keys are supported', () => {
    const sm = new SignalAutoMap();
    const symA = Symbol('a');
    const symB = Symbol('b');

    expect(sm.has(symA)).toBe(false);
    const sigA = sm.get(symA);
    expect(sm.has(symA)).toBe(true);
    expect(isSignal(sigA)).toBeTruthy();

    sigA.value = 'hello';
    expect(sm.get(symA).value).toBe('hello');

    sm.get(symB).value = 42;
    expect(sm.get(symB).value).toBe(42);

    const keys = Array.from(sm.keys());
    expect(keys).toContain(symA);
    expect(keys).toContain(symB);

    sm.clear();
  });

  it('update() with empty Map does nothing', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2});
    sm.update(new Map());
    expect(sm.get('a').value).toBe(1);
    expect(sm.get('b').value).toBe(2);
    sm.clear();
  });

  it('updateFromProps() with empty object does nothing (PERF-004)', () => {
    // NOTE this is not a regression test for the PERF-004 guard itself: an
    // empty `updateFromProps({})` behaved identically before the fix — it
    // opened a `batch()` whose loop body never ran, so there was no write
    // and no rerun either way. The guard's actual effect (skipping the
    // `batch()` call, its `Batch` instance and its two temporary queue
    // subscriptions entirely) is allocation-only and has no observable
    // difference a functional test can catch — see bench/batch.bench.ts for
    // the cost it now skips. This test documents the *outcome* the guard
    // mirrors from update()'s existing `props.size` check, nothing more.
    const sm = SignalAutoMap.fromProps({a: 1, b: 2});

    let effectCallCount = 0;
    const effect = createEffect(() => {
      sm.get<number>('a').get();
      sm.get<number>('b').get();
      effectCallCount++;
    });

    expect(effectCallCount).toBe(1);

    sm.updateFromProps({});

    expect(effectCallCount, 'no write happened, so no rerun').toBe(1);
    expect(sm.get('a').value).toBe(1);
    expect(sm.get('b').value).toBe(2);

    effect.destroy();
    sm.clear();
  });

  it('updateFromProps() without explicit keys', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2});
    sm.updateFromProps({a: 10, b: 20, c: 30});
    expect(sm.get('a').value).toBe(10);
    expect(sm.get('b').value).toBe(20);
    expect(sm.get('c').value).toBe(30);
    sm.clear();
  });

  it('get() returns the same signal for the same key', () => {
    const sm = new SignalAutoMap();
    const sig1 = sm.get('foo');
    const sig2 = sm.get('foo');
    expect(sig1).toBe(sig2);
    sm.clear();
  });

  it('get() creates a new signal with undefined value for new key', () => {
    const sm = new SignalAutoMap();
    const sig = sm.get<number>('newKey');
    expect(isSignal(sig)).toBeTruthy();
    expect(sig.value).toBeUndefined();
    sm.clear();
  });

  it('signals are reactive with effects', () => {
    const sm = SignalAutoMap.fromProps({count: 0});
    let effectCallCount = 0;
    let lastValue: number | undefined;

    const effect = createEffect(() => {
      lastValue = sm.get<number>('count').get();
      effectCallCount++;
    });

    expect(effectCallCount).toBe(1);
    expect(lastValue).toBe(0);

    sm.get<number>('count').set(5);
    expect(effectCallCount).toBe(2);
    expect(lastValue).toBe(5);

    sm.update(new Map([['count', 10]]));
    expect(effectCallCount).toBe(3);
    expect(lastValue).toBe(10);

    effect.destroy();
    sm.clear();
  });

  it('update() batches signal updates', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3});
    let effectCallCount = 0;
    let lastValues: {a?: number; b?: number; c?: number} = {};

    const effect = createEffect(() => {
      lastValues = {
        a: sm.get<number>('a').get(),
        b: sm.get<number>('b').get(),
        c: sm.get<number>('c').get(),
      };
      effectCallCount++;
    });

    expect(effectCallCount).toBe(1);
    expect(lastValues).toEqual({a: 1, b: 2, c: 3});

    sm.update(
      new Map([
        ['a', 10],
        ['b', 20],
        ['c', 30],
      ]),
    );

    expect(effectCallCount).toBe(2);
    expect(lastValues).toEqual({a: 10, b: 20, c: 30});

    effect.destroy();
    sm.clear();
  });

  it('updateFromProps() batches signal updates', () => {
    const sm = SignalAutoMap.fromProps({x: 'a', y: 'b'});
    let effectCallCount = 0;

    const effect = createEffect(() => {
      sm.get<string>('x').get();
      sm.get<string>('y').get();
      effectCallCount++;
    });

    expect(effectCallCount).toBe(1);

    sm.updateFromProps({x: 'hello', y: 'world'});
    expect(effectCallCount).toBe(2);
    expect(sm.get('x').value).toBe('hello');
    expect(sm.get('y').value).toBe('world');

    effect.destroy();
    sm.clear();
  });

  it('churn leaves no dead handles in the held value (MEM-007)', () => {
    // `#drop()` takes the handle out of `[$autoMapResources].unsubs` as well
    // as out of `#unsubs`. Only the second one is load-bearing for the map's
    // own behaviour, which is why the first survives every functional test:
    // the set is the held value of the resource finalizer, so a handle left
    // in it is a closure held strongly for as long as the map lives.
    // Measured without this line: 5000 get/delete cycles leave 5000 dead
    // handles behind, on both churn routes.
    const sm = new SignalAutoMap();
    const resources = sm[$autoMapResources];

    expect(resources.unsubs.size).toBe(0);
    sm.get('warmup');
    expect(resources.unsubs.size, 'the set really is in use').toBe(1);
    sm.delete('warmup');

    // Route 1: the entry is torn down through the map.
    for (let i = 0; i < 50; i += 1) {
      sm.get(`k${i}`);
      expect(sm.delete(`k${i}`)).toBe(true);
    }
    expect(resources.unsubs.size, 'after 50 get()/delete() cycles').toBe(0);

    // Route 2: the entry is evicted by a destroy from the outside.
    for (let i = 0; i < 50; i += 1) {
      destroySignal(sm.get(`x${i}`));
    }
    expect(resources.unsubs.size, 'after 50 external destroys').toBe(0);

    expect([...sm.keys()].length).toBe(0);
    assertSignalsCount(0, 'no entry survived either route');
  });

  it('clear() releases the hook of an entry whose signal is already dead (MEM-007)', () => {
    // Two ways such an entry can exist after MEM-007, and both go through
    // `fromProps()` with a value that already *is* a signal, because
    // `createSignal(sig)` hands that back unchanged instead of creating
    // anything. Either the signal is already a corpse when the map takes it
    // on — then its `destroy()` is a no-op, emits nothing, and the per-entry
    // listener never fires (the case set up below) — or it is alive but
    // carries an older subscriber whose throw aborts the destroy emit before
    // the map's own listener is reached. Same outcome: a dead entry the
    // listener never heard about.
    //
    // Only `clear()` dropping every key before it destroys anything gets
    // that subscription off the queue. Destroying first and clearing the map
    // afterwards leaves it there for the lifetime of the process.
    const destroySubscriptions = getSubscriptionCount(globalDestroySignalQueue);

    const corpse = createSignal(1);
    destroySignal(corpse);
    assertSignalsCount(0, 'the value is a corpse before the map ever sees it');

    const sm = SignalAutoMap.fromProps({a: corpse});
    expect(sm.has('a')).toBe(true);
    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      destroySubscriptions + 1,
    );

    sm.clear();

    expect(sm.has('a')).toBe(false);
    expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
      destroySubscriptions,
    );
  });

  it('clear() keeps an entry a re-entrant get() created during the teardown (MEM-007)', () => {
    // `clear()` drops the keys first and destroys a snapshot afterwards, so
    // a cleanup that runs inside one of those destroys and calls `get(key)`
    // gets a fresh, live signal — and it stays. Emptying `#signals` after
    // the destroys would throw that entry away again.
    const sm = new SignalAutoMap();
    sm.get('a').set(1);

    let reentrant: Signal<unknown> | undefined;
    createEffect(() => {
      sm.get('a').get();
      return () => {
        reentrant = sm.get('a');
      };
    });
    assertEffectsCount(1, 'one effect depending on the entry');

    sm.clear();

    expect(reentrant).not.toBeUndefined();
    expect(sm.has('a')).toBe(true);
    expect(sm.get('a')).toBe(reentrant);
    assertSignalsCount(1, 're-entrant get() left one live signal behind');

    sm.clear();
    assertSignalsCount(0, 'the second clear() takes the fresh entry too');
  });

  it('clear() properly destroys all signals', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3});
    assertSignalsCount(3);

    sm.clear();
    assertSignalsCount(0);

    expect(sm.has('a')).toBe(false);
    expect(sm.has('b')).toBe(false);
    expect(sm.has('c')).toBe(false);
  });

  it('mixed string and symbol keys', () => {
    const sm = new SignalAutoMap();
    const symKey = Symbol('mySymbol');

    sm.get('stringKey').value = 'string value';
    sm.get(symKey).value = 'symbol value';

    expect(sm.get('stringKey').value).toBe('string value');
    expect(sm.get(symKey).value).toBe('symbol value');
    expect(sm.has('stringKey')).toBe(true);
    expect(sm.has(symKey)).toBe(true);

    const keys = Array.from(sm.keys());
    expect(keys.length).toBe(2);

    sm.clear();
  });

  it('fromProps() with empty object', () => {
    const sm = SignalAutoMap.fromProps({});
    const keys = Array.from(sm.keys());
    expect(keys.length).toBe(0);
    sm.clear();
  });

  it('fromProps() with empty keys array', () => {
    const sm = SignalAutoMap.fromProps({a: 1, b: 2}, []);
    const keys = Array.from(sm.keys());
    expect(keys.length).toBe(0);
    sm.clear();
  });

  // MEM-007: a SignalAutoMap subscribes to the destruction of every signal
  // it creates, so an entry whose signal is destroyed from the outside leaves
  // the map in the same synchronous turn. There is no lingering corpse in the
  // map any more — only in the hands of whoever kept the `Signal` object.
  describe('externally destroyed signals', () => {
    it('an externally destroyed signal drops out of the map (MEM-007)', () => {
      const sm = new SignalAutoMap();
      const sig = sm.get<number>('a');
      sig.value = 1;
      assertSignalsCount(1, 'signal created');

      destroySignal(sig);
      assertSignalsCount(0, 'destroyed externally');

      expect(sm.has('a')).toBe(false);

      const fresh = sm.get<number>('a');
      expect(fresh).not.toBe(sig);
      expect(fresh.value).toBeUndefined();
      assertSignalsCount(1, 'get() handed out a fresh, live signal');

      sm.clear();
    });

    it('1000 externally destroyed entries leave no keys behind (MEM-007)', () => {
      const destroySubscriptions = getSubscriptionCount(
        globalDestroySignalQueue,
      );

      const sm = new SignalAutoMap();
      const signals: Signal<number>[] = [];
      for (let i = 0; i < 1000; i += 1) {
        signals.push(sm.get<number>(`k${i}`));
      }
      assertSignalsCount(1000, 'one entry per key');

      for (const sig of signals) {
        destroySignal(sig);
      }

      expect([...sm.keys()].length).toBe(0);
      assertSignalsCount(0, 'every entry destroyed from the outside');
      // The second half is the actual claim: the eviction must not move the
      // leak from the map onto a process-lifetime queue.
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroySubscriptions,
      );
    });

    it('a soft detach does not evict the entry (MEM-007)', () => {
      // The reason the per-entry hook is `on` and not `once`:
      // `SignalGroup#off()` emits on the same queue with `{detach: true}`,
      // and a `once` would be spent on that — leaving nobody to hear the
      // real destruction afterwards.
      const host = {};
      const sm = new SignalAutoMap();
      const sig = sm.get<number>('a');
      sig.value = 3;

      SignalGroup.findOrCreate(host).attachSignal(sig);
      SignalGroup.get(host)!.off();

      expect(sm.has('a')).toBe(true);
      expect(sm.get<number>('a')).toBe(sig);
      expect(sm.get<number>('a').value).toBe(3);

      // …and the real destruction still lands.
      destroySignal(sig);
      expect(sm.has('a')).toBe(false);

      SignalGroup.destroy(host);
      sm.clear();
    });

    it('a re-entrant get() during an external destroy keeps the fresh entry (MEM-007)', () => {
      const sm = new SignalAutoMap();
      const sig = sm.get('a');
      sig.set(1);

      let reentrant: Signal<unknown> | undefined;
      createEffect(() => {
        sm.get('a').get();
        return () => {
          // Runs synchronously inside destroySignal(sig): the destroyed
          // signal was this effect's only dependency, so the destroy takes
          // the effect with it and its cleanup fires re-entrantly here.
          reentrant = sm.get('a');
        };
      });
      assertEffectsCount(1, 'one effect depending on the entry');

      destroySignal(sig);

      // The map's own hook is the first subscriber for this signal id on
      // every path where the map creates the signal itself — the id is
      // created in the same statement — so the entry is already gone when
      // the cleanup runs, and the fresh signal it creates stays. (Not so
      // for `fromProps()` handed a ready-made signal, which may already
      // carry older subscribers; see the note in `#create()`.)
      expect(reentrant).not.toBeUndefined();
      expect(reentrant).not.toBe(sig);
      expect(sm.has('a')).toBe(true);
      expect(sm.get('a')).toBe(reentrant);
      assertSignalsCount(1, 're-entrant get() left one live signal behind');
      assertEffectsCount(
        0,
        'the effect died with its only, now-destroyed dependency',
      );

      sm.clear();
    });

    it('reads from a destroyed signal return the last value, writes are silent', () => {
      const sm = new SignalAutoMap();
      const sig = sm.get<number>('a');
      sig.value = 7;

      let observed: number | undefined;
      const effect = createEffect(() => {
        observed = sm.get<number>('a').get();
      });
      expect(observed).toBe(7);

      sig.destroy();

      // MEM-007: the entry goes with the signal, so the corpse is only
      // reachable through the reference the caller kept — asking the map
      // would hand out a fresh, live signal instead.
      expect(sm.has('a')).toBe(false);

      // Effect does not re-run for a destroyed signal.
      sig.set(99);
      expect(observed).toBe(7);

      // The destroyed signal still mutates its internal value bag, but
      // nothing reactive observes it.
      expect(sig.value).toBe(99);

      effect.destroy();
      sm.clear();
    });
  });

  describe('delete()', () => {
    it('delete() destroys the signal and removes the entry', () => {
      const sm = SignalAutoMap.fromProps({a: 1, b: 2, c: 3});
      assertSignalsCount(3);

      expect(sm.delete('a')).toBe(true);
      assertSignalsCount(2);
      expect(sm.has('a')).toBe(false);
      expect([...sm.keys()]).toEqual(['b', 'c']);

      sm.clear();
    });

    it('a re-entrant get() from a cleanup during delete() gets a live signal that stays in the map', () => {
      const sm = new SignalAutoMap();
      sm.get('a').set(1);

      let reentrant: Signal<unknown> | undefined;
      createEffect(() => {
        sm.get('a').get();
        return () => {
          // Runs synchronously inside sm.delete('a'): the destroyed signal
          // was this effect's only dependency, so destroying it takes the
          // effect with it, and its cleanup fires re-entrantly here.
          reentrant = sm.get('a');
        };
      });
      assertEffectsCount(1, 'one effect depending on the entry');

      expect(sm.delete('a')).toBe(true);

      // The entry must already be gone by the time the cleanup runs, so the
      // re-entrant get() creates a fresh, live signal instead of handing
      // back the corpse — and that fresh entry must survive the delete().
      expect(reentrant).not.toBeUndefined();
      expect(sm.has('a')).toBe(true);
      expect(sm.get('a')).toBe(reentrant);
      assertSignalsCount(1, 're-entrant get() left one live signal behind');
      assertEffectsCount(
        0,
        'the effect died with its only, now-deleted dependency',
      );

      // Not a liveness check — a destroyed signal stores writes and reads them
      // back just the same (pitfall 6). This only shows the fresh entry is
      // usable; that it is alive was settled by assertSignalsCount(1) above.
      reentrant!.value = 42;
      expect(reentrant!.value).toBe(42);

      sm.clear();
    });

    it('delete() on an unknown key returns false and creates nothing', () => {
      const sm = new SignalAutoMap();

      expect(sm.delete('nope')).toBe(false);
      assertSignalsCount(0);
      expect([...sm.keys()].length).toBe(0);
    });

    it('get() after delete() creates a fresh signal', () => {
      const sm = new SignalAutoMap();
      const first = sm.get('a');
      sm.delete('a');

      const second = sm.get('a');
      expect(second).not.toBe(first);
      expect(isSignal(second.get)).toBe(true);
      expect(second.value).toBeUndefined();
      assertSignalsCount(1);

      sm.clear();
    });

    it('delete() on an entry destroyed from the outside reports false (MEM-007)', () => {
      const sm = new SignalAutoMap();
      const sig = sm.get('a');
      destroySignal(sig);
      assertSignalsCount(0);

      // The entry left the map with its signal, so there is nothing for
      // delete() to remove. `Map.prototype.delete` semantics are unchanged —
      // the precondition is what disappeared.
      expect(sm.has('a')).toBe(false);
      expect(sm.delete('a')).toBe(false);
      assertSignalsCount(0);
      expect(sm.has('a')).toBe(false);
    });

    it('delete() releases the hook of an entry whose signal is already dead (MEM-007)', () => {
      // Same entry as the `clear()` case above, reachable by the same two
      // routes (an already-dead signal handed to `fromProps()`, set up here,
      // or a live one whose destroy emit a throwing earlier subscriber cuts
      // short), and the order matters for the same reason: nothing emits on
      // the map's behalf, so `#drop()` is the only thing left that can take
      // the subscription off the queue.
      const destroySubscriptions = getSubscriptionCount(
        globalDestroySignalQueue,
      );

      const corpse = createSignal(1);
      destroySignal(corpse);
      assertSignalsCount(0);

      const sm = SignalAutoMap.fromProps({a: corpse});
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroySubscriptions + 1,
      );

      expect(sm.delete('a')).toBe(true);

      expect(sm.has('a')).toBe(false);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroySubscriptions,
      );
    });

    it('delete() works with symbol keys', () => {
      const sm = new SignalAutoMap();
      const symKey = Symbol('mySymbol');

      sm.get('stringKey').value = 'string value';
      sm.get(symKey).value = 'symbol value';

      expect(sm.delete(symKey)).toBe(true);
      expect(sm.has(symKey)).toBe(false);
      expect(sm.has('stringKey')).toBe(true);

      sm.clear();
    });

    it('delete() leaves nothing behind — signals, effects and subscriptions (MEM-009)', () => {
      const signalSubscriptions = getSubscriptionCount(globalSignalQueue);
      const destroySubscriptions = getSubscriptionCount(
        globalDestroySignalQueue,
      );

      const sm = new SignalAutoMap();
      const keys = ['a', 'b', 'c'];
      let runs = 0;

      for (const key of keys) {
        sm.get(key).set(key);
        // Not attached to anything: the map entry is the only owner.
        createEffect(() => {
          runs += 1;
          sm.get(key).get();
        });
      }

      expect(runs).toBe(3);
      assertSignalsCount(3, 'three entries');
      assertEffectsCount(3, 'one effect per entry');

      for (const key of keys) {
        expect(sm.delete(key)).toBe(true);
      }

      expect([...sm.keys()].length).toBe(0);
      assertSignalsCount(0, 'after delete()');
      assertEffectsCount(
        0,
        'an effect without a single live dependency destroys itself',
      );
      expect(runs, 'destroying a dependency does not re-run the effect').toBe(
        3,
      );
      expect(getSubscriptionCount(globalSignalQueue)).toBe(signalSubscriptions);
      expect(getSubscriptionCount(globalDestroySignalQueue)).toBe(
        destroySubscriptions,
      );
    });
  });
});
