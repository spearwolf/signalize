import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as api from './index.js';

// No counter guards here (API-017): this file creates no signal, effect or
// link — it reads the module source as text and inspects the entry point's
// own namespace object. There is nothing for `assertEffectsCount` /
// `assertSignalsCount` / `assertLinksCount` to watch.
//
// The rule this file holds, not a number: every export of `src/index.ts` is
// named, and a name is only published by two edits acting together — a line
// in `index.ts` *and* an entry in the list below. A name missing from the
// list below is not a bug in the list; it is `index.ts` publishing something
// nobody decided to publish. Reading that as "the test is wrong, update the
// list" defeats the point of writing it down twice.
describe('the entry point publishes a named surface, not a star (API-017)', () => {
  it('carries no `export *`, in either form', () => {
    const indexSource = readFileSync(
      fileURLToPath(new URL('./index.ts', import.meta.url)),
      'utf-8',
    );

    // Biome's `performance/noReExportAll` catches the value form
    // (`export * from …`) but not `export type * from …` — measured, not
    // assumed (see the plan for Paket 5). This regex covers both, which is
    // why the file inspects source text instead of the compiled module.
    expect(indexSource).not.toMatch(/^export\s+(?:type\s+)?\*/m);
  });

  it('exports exactly these 33 values', () => {
    const publishedValues = [
      'Effect',
      'Signal',
      'SignalAutoMap',
      'SignalGroup',
      'batch',
      'beQuiet',
      'createEffect',
      'createMemo',
      'createSignal',
      'destroyObjectSignals',
      'destroySignal',
      'findObjectSignalByName',
      'findObjectSignalNames',
      'findObjectSignals',
      'getEffectsCount',
      'getLinksCount',
      'getMaxEffectDepth',
      'getSignalGroupsCount',
      'getSignalsCount',
      'hibernate',
      'isQuiet',
      'isSignal',
      'link',
      'muteSignal',
      'onCreateEffect',
      'onDestroyEffect',
      'onEffectError',
      'onSignalizeError',
      'setMaxEffectDepth',
      'touch',
      'unlink',
      'unmuteSignal',
      'value',
    ];

    expect(Object.keys(api).sort()).toEqual([...publishedValues].sort());
  });

  // The two type names this package moves off the link/automap stars and
  // onto a by-name line (steps 1 and 2 of the plan). Presence, not rejection
  // — no `@ts-expect-error` here, because what is being asserted is that the
  // name is still reachable through the entry point, not that it is refused.
  const _opts: import('./index.js').LinkOptions = {};
  const _key: import('./index.js').SignalAutoMapKeyType = 'a';

  it('keeps LinkOptions and SignalAutoMapKeyType reachable through the entry point', () => {
    expect(_opts).toEqual({});
    expect(_key).toBe('a');
  });
});
