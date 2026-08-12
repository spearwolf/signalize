// Every export of this file is named, and that is the whole promise: what
// is here is the published surface of the `.` entry point, and a module
// export that is not listed here is not published. No star, in either
// form — `export *` publishes every future export of a module unasked,
// `export type *` does the same for its types. Publishing is meant to be an
// edit to this file, not a side effect of something new landing anywhere in
// `src/` (API-017).
//
// Who holds this: `performance/noReExportAll` (`biome.json`) fails `pnpm
// check` on a value star, `index.public-surface.spec.ts` on both star forms
// and on any drift in the value list. There is no tool for the type half —
// tsc erases types, and no reflection reaches them — so it rests on this
// rule and on the witnesses in `types.public-surface.spec.ts`.
export {batch} from './batch.js';
export {beQuiet, isQuiet} from './be-quiet.js';
export {type CreateMemoOptions, createMemo} from './create-memo.js';
export {createSignal} from './create-signal.js';
export {Effect} from './Effect.js';
export type {
  EffectDeps,
  EffectOptions,
  EffectOptionsWithNameDeps,
  EffectOptionsWithSignalDeps,
  SignalLikeDeps,
} from './EffectImpl.js';
export {
  createEffect,
  getEffectsCount,
  getMaxEffectDepth,
  onCreateEffect,
  onDestroyEffect,
  onEffectError,
  setMaxEffectDepth,
} from './effects.js';
export {hibernate} from './hibernate.js';
export {getLinksCount, type LinkOptions, link, unlink} from './link.js';
export {
  destroyObjectSignals,
  findObjectSignalByName,
  findObjectSignalNames,
  findObjectSignals,
} from './object-signals.js';
export {Signal} from './Signal.js';
export {SignalAutoMap, type SignalAutoMapKeyType} from './SignalAutoMap.js';
export {getSignalGroupsCount, SignalGroup} from './SignalGroup.js';
export type {SignalLink, ValueCallback} from './SignalLink.js';
export {
  destroySignal,
  getSignalsCount,
  isSignal,
  muteSignal,
  unmuteSignal,
} from './signal-core.js';
export {onSignalizeError} from './signalize-error.js';
export {touch} from './touch.js';
// `ISignalImpl` is the implementation layer and stays inside the module
// graph — `LinkSource` is what a consumer gets instead (API-007).
export type {
  AbortSignalLike,
  BeforeReadFunc,
  CompareFunc,
  EffectCallback,
  EffectErrorCallback,
  EffectErrorPayload,
  EffectErrorPhase,
  FailingEffect,
  LinkSource,
  NonThenable,
  SignalizeErrorCallback,
  SignalizeErrorPayload,
  SignalLike,
  SignalParams,
  SignalReader,
  SignalValueParams,
  SignalWriter,
  SignalWriterParams,
  ValueChangedCallback,
  VoidFunc,
} from './types.js';
export {value} from './value.js';
