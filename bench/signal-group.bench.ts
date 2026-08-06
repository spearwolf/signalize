import {bench, describe} from 'vitest';
import {SignalGroup} from '../src/index.js';

/*
 * Hot path #4 — `SignalGroup.findOrCreate`.
 *
 * Two distinct paths inside the private constructor: a fresh object takes
 * the full-allocation path (WeakRef, FinalizationRegistry.register,
 * eventize(this)); an object that already has a group takes the WeakMap
 * lookup-and-return path. Both are common in real usage (mounting a new
 * component vs. re-entering `findOrCreate` on one already attached), so
 * both get their own bench rather than only measuring the cheaper lookup.
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
 * Baseline (reference point for package 12), measured on commit 5cb75f4,
 * single run, one dev laptop — not a gate:
 *
 *   create new group (fresh object)   ~582,887 hz
 *   lookup existing group             ~7,682,950 hz  (~13x faster)
 */
