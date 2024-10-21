export {batch} from './batch.js';
export {beQuiet, isQuiet} from './bequiet.js';
export {connect} from './connect.legacy.js';
export * from './Connection.legacy.js';
export {createMemo, type CreateMemoOptions} from './createMemo.js';
export {
  createSignal,
  destroySignal,
  getSignalsCount,
  isSignal,
  muteSignal,
  unmuteSignal,
} from './createSignal.js';
export {Effect} from './Effect.js';
export {createEffect, getEffectsCount} from './effects.js';
export * from './link.js';
export {
  destroyObjectSignals,
  findObjectSignalByName,
  findObjectSignalKeys,
  findObjectSignals,
} from './object-signals.js';
export {Signal} from './Signal.js';
export {SignalGroup} from './SignalGroup.js';
export type {SignalLink, ValueCallback} from './SignalLink.js';
export {touch} from './touch.js';
export type * from './types.js';
export {unconnect} from './unconnect.legacy.js';
export {value} from './value.js';

// TODO docs: update README (missing decorators docs, rewrite introduction, add ts@5 / decorators stage-3 notes ...)

// TODO docs: create a cheat sheet

// TODO docs: add contribution guide (setup dev env, run tests, etc.)

// TODO build: prepend banner to index.js and decorators.js output fragments

// TODO remove legacy connect* features
