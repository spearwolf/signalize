import {bench, describe} from 'vitest';
import {SignalGroup} from '../src/index.js';

/*
 * Hot path #4 — `SignalGroup.findOrCreate`.
 *
 * Two distinct paths: a fresh object takes the full-allocation path, an
 * object that already has a group takes the WeakMap lookup-and-return
 * path. Both are common in real usage (mounting a new component vs.
 * re-entering `findOrCreate` on one already attached), so both get their
 * own bench rather than only measuring the cheaper lookup.
 *
 * What "full allocation" means here is less than the field list suggests.
 * Eagerly initialized, those fields would build eleven containers — six
 * Sets, three Maps, a WeakMap and a WeakSet — plus the `[$groupResources]`
 * wrapper object, plus WeakRef, FinalizationRegistry.register and
 * eventize(this) in the constructor body. Nine of the eleven instead start
 * out pointing at a module-level shared empty stand-in and only allocate on
 * their first write, so a fresh group builds three objects: `#signals`,
 * `#effects` and the wrapper.
 *
 * The cache-hit check: `findOrCreate()` used to reach the lookup path
 * only *after* paying the fresh-object allocation cost — `new
 * SignalGroup(object)` ran unconditionally, and the constructor's own
 * `store.has()` check discarded the freshly built instance on a hit.
 * `findOrCreate()` now checks `store.get(object)` itself before
 * constructing anything; the constructor's `store.has()` check stays as
 * the safety net for direct/re-entrant construction, it just no longer
 * carries the common case.
 */

describe('SignalGroup.findOrCreate', () => {
  bench('create new group (fresh object)', () => {
    SignalGroup.findOrCreate({});
  });

  const existing = {};
  SignalGroup.findOrCreate(existing);

  bench('lookup existing group', () => {
    SignalGroup.findOrCreate(existing);
  });
});

/*
 * Baseline history, single run, one dev laptop each time — not a gate.
 *
 * Before the cache-hit check (commit 5cb75f4 — `findOrCreate()` always called `new
 * SignalGroup(object)`, even on a cache hit):
 *   create new group (fresh object)   ~582,887 hz
 *   lookup existing group             ~7,682,950 hz  (~13x faster)
 *
 * Same machine, same session, immediately before/after that change
 * (`findOrCreate()` now checks `store.get(object)` first and
 * only constructs on a miss):
 *   before: lookup existing group   6,327,903 hz
 *   after:  lookup existing group   18,859,414 hz  (~2.98x faster)
 *   (create new group (fresh object) is unaffected by this change — its
 *   allocation cost is unchanged: ~517,877 hz before, ~535,765 hz after)
 *
 * 2026-08-11, lazy containers (nine of the eleven start
 * out as shared empty stand-ins and allocate on first write). Method: this
 * file run three times against an unmodified copy of the tree and three
 * times against the rebuilt one, alternating, same machine and session,
 * Node v25.9.0; median of the three, `hz` and `p75`:
 *   create new group (fresh object)  343,946 → 399,578 hz  (+16.2 %)
 *                                    p75 0.0019 → 0.0017 ms
 *   lookup existing group         21,113,707 → 20,502,306 hz  (−2.9 %)
 *                                    p75 0.0001 → 0.0001 ms
 * `lookup existing group` is the control: it touches no field initializer,
 * so its −2.9 % is the noise floor of the machine, not the change. Note
 * the ±25 % rme on `create new group` — GC lands inside the samples, and
 * that is exactly what this change is about.
 *
 * The retained-size numbers below cannot be reproduced from this file.
 * They come from a scratchpad harness outside the repo: the compiled
 * `lib/` copied next to a `node_modules` symlink, 100,000 (resp. 50,000)
 * retained instances, 8x `gc()` with a 12 ms settle before and after,
 * `heapUsed` delta over N, three repetitions with zero spread.
 *   empty SignalGroup + host `{}`             2513 → 1081 B  (−57.0 %)
 *   host with one `@signal accessor` field  4413.8 → 3822 B  (−13.4 %)
 *   host with `createEffect(fn, {attach})`  7222.1 → 5790.2 B (−19.8 %)
 * The decorator host gains least on purpose: a single `@signal` field
 * already fills five of the nine lazy containers on the way in.
 */
