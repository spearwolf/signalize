import {bench, describe} from 'vitest';
import {SignalGroup} from '../src/index.js';

/*
 * Hot path #4 — `SignalGroup.findOrCreate`.
 *
 * Two distinct paths: a fresh object takes the full-allocation path (four
 * Sets, two Maps, a WeakMap from the field initializers, then WeakRef,
 * FinalizationRegistry.register, eventize(this) in the constructor body);
 * an object that already has a group takes the WeakMap lookup-and-return
 * path. Both are common in real usage (mounting a new component vs.
 * re-entering `findOrCreate` on one already attached), so both get their
 * own bench rather than only measuring the cheaper lookup.
 *
 * PERF-002 (package 12): `findOrCreate()` used to reach the lookup path
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
 * Before PERF-002 (commit 5cb75f4 — `findOrCreate()` always called `new
 * SignalGroup(object)`, even on a cache hit):
 *   create new group (fresh object)   ~582,887 hz
 *   lookup existing group             ~7,682,950 hz  (~13x faster)
 *
 * Same machine, same session, immediately before/after the PERF-002 change
 * (package 12 — `findOrCreate()` now checks `store.get(object)` first and
 * only constructs on a miss):
 *   before: lookup existing group   6,327,903 hz
 *   after:  lookup existing group   18,859,414 hz  (~2.98x faster)
 *   (create new group (fresh object) is unaffected by this change — its
 *   allocation cost is unchanged: ~517,877 hz before, ~535,765 hz after)
 */
