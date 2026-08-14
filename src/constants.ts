export const $signal = Symbol.for('@spearwolf/signalize/signal');
export const $effect = Symbol.for('@spearwolf/signalize/effect');

export const $destroySignal = Symbol.for('@spearwolf/signalize/destroySignal');
export const $createEffect = Symbol.for('@spearwolf/signalize/createEffect');
export const $destroyEffect = Symbol.for('@spearwolf/signalize/destroyEffect');
export const $effectError = Symbol.for('@spearwolf/signalize/effectError');
export const $signalizeError = Symbol.for(
  '@spearwolf/signalize/signalizeError',
);

// A `SignalLink`'s handles for its own subscriptions on the two
// module-level global queues. Symbol-keyed rather than a `#private` field
// because `src/link.ts` has to hand exactly this array to the
// `FinalizationRegistry` as its held value, and a private field is
// unreachable from another module — while a public named field would be a
// new API surface.
/** @internal */
export const $queueUnsubscribes = Symbol.for(
  '@spearwolf/signalize/queueUnsubscribes',
);

// A `SignalAutoMap`'s handles for the per-entry subscriptions it
// holds on `globalDestroySignalQueue`. Symbol-keyed for the same reason as
// `$queueUnsubscribes` above — `src/SignalAutoMap.ts` has to hand exactly
// this object to a `FinalizationRegistry` as its held value, a `#private`
// field is unreachable from a test, and a public named field would be new
// API surface. Placed here next to `$queueUnsubscribes`, the symbol with
// the same job, rather than in `SignalAutoMap.ts` — a preference, not a
// constraint: `src/index.ts` names every export, so neither file would
// publish it, and `SignalGroup.ts` keeps its own `$groupResources` in
// place.
/** @internal */
export const $autoMapResources = Symbol.for(
  '@spearwolf/signalize/autoMapResources',
);

// The register in which two copies of this library find each other.
// It carries no major version on purpose — a versioned key would never meet
// the other copy, which is the whole point of looking.
export const $signalizeInstances = Symbol.for('@spearwolf/signalize/instances');

export const VALUE = 'value';
export const MUTE = 'mute';
export const UNMUTE = 'unmute';
export const DESTROY = 'destroy';
export const OFF = 'off';

export const RECALL = Symbol.for('@spearwolf/signalize/recall');
