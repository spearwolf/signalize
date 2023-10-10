export * from './Connection.js';
export {batch} from './batch.js';
export {connect} from './connect.js';
export * from './createMemo.js';
export * from './createSignal.js';
export * from './effects-api.js';
export {
  destroyEffects,
  destroySignals,
  destroySignalsAndEffects,
  queryObjectEffect,
  queryObjectSignal,
} from './object-signals-and-effects.js';
export * from './touch.js';
export type * from './types.js';
export {unconnect} from './unconnect.js';
export * from './value.js';

// TODO docs: update README (missing decorators docs, rewrite introduction, add ts@5 / decorators stage-3 notes ...)

// TODO docs: create awesome hero picture for this library

// TODO docs: rename the library to 'signaler-effectus' ?

// TODO docs: create a cheat sheet

// TODO docs: add contribution guide (setup dev env, run tests, etc.)
