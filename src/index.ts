export * from './Connection';
export {batch} from './batch';
export {connect} from './connect';
export * from './createMemo';
export * from './createSignal';
export * from './decorators';
export * from './effects-api';
export {
  destroyEffects,
  destroySignals,
  destroySignalsAndEffects,
  queryObjectEffect,
  queryObjectSignal,
} from './object-signals-and-effects';
export * from './touch';
export * from './types';
export {unconnect} from './unconnect';
export * from './value';

// TODO docs: update README (missing decorators docs, rewrite introduction, add ts@5 / decorators stage-3 notes ...)

// TODO docs: create awesome hero picture for this library

// TODO docs: rename the library to 'signaler-effectus' ?

// TODO docs: create a cheat sheet

// TODO docs: add contribution guide (setup dev env, run tests, etc.)
