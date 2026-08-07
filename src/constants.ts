export const $signal = Symbol.for('@spearwolf/signalize/signal');
export const $effect = Symbol.for('@spearwolf/signalize/effect');

export const $destroySignal = Symbol.for('@spearwolf/signalize/destroySignal');
export const $createEffect = Symbol.for('@spearwolf/signalize/createEffect');
export const $destroyEffect = Symbol.for('@spearwolf/signalize/destroyEffect');
export const $effectError = Symbol.for('@spearwolf/signalize/effectError');

// MEM-001: a `SignalLink`'s handles for its own subscriptions on the two
// module-level global queues. Symbol-keyed rather than a `#private` field
// because `src/link.ts` has to hand exactly this array to the
// `FinalizationRegistry` as its held value, and a private field is
// unreachable from another module — while a public named field would be a
// new API surface.
export const $queueUnsubscribes = Symbol.for(
  '@spearwolf/signalize/queueUnsubscribes',
);

export const VALUE = 'value';
export const MUTE = 'mute';
export const UNMUTE = 'unmute';
export const DESTROY = 'destroy';
export const OFF = 'off';

export const RECALL = Symbol.for('@spearwolf/signalize/recall');
