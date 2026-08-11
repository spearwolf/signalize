# CLAUDE.md

`@spearwolf/signalize` — synchronous signals/effects/memos/links on top of `@spearwolf/eventize`. ESM-only, Node `>=22`, ES2023.

## Where the knowledge lives

| Need | Read |
| --- | --- |
| Architecture, eventize internals, source-file map, full public API, common change patterns | `AGENTS.md` — read before any non-trivial change |
| How to *use* signalize (mental model, pitfalls, patterns) | `skills/using-signalize/` |
| Behaviour details and quirks | `docs/` (`api.md`, `recipes.md`, `architecture.md`, `cheat-sheet.md`) |

Everything below is the short list that is expensive to discover by reading code.

## Commands

Package manager is **pnpm** (`pnpm@11.20.0`) — never `npm install`.

- `pnpm cbt` — clean + compile + bundle + test. The local "done" gate.
- `pnpm world` — the full blocking CI scope: `check`, `compile`, `bundle`, `test:smoke`, `checkPkgTypes`, `test` and `test:gc`. `.github/workflows/ci.yml` additionally runs `bench`, informative and `continue-on-error`.
- `pnpm test <file>` / `pnpm test -t "<name>"` — single spec / by test name. Such a filtered run always exits 1 because the per-file coverage gate fails for every file that did not run; that is not a test failure.
- `pnpm test:gc` — `pnpm test` already runs all `src/**/*.gc.spec.ts` via a dedicated `gc` project in `vitest.config.ts`, on the same default `forks` pool every project uses — there's no cross-file state that project alone would expose. `test:gc` instead runs every file serially (`fileParallelism: false`) with `--expose-gc` applied to the whole suite, not just those GC spec files.
- `pnpm test:smoke` — runs `smoke/dist-smoke.test.ts` on plain Node (`node --test`) against the built `dist/`, type-checked against the `lib/*.d.ts`, not `src/` and not Vitest. It's the only test where **tsc**, not SWC, lowers a `@signal() accessor` application — the one decorator lowering this library ships but never otherwise exercises. `pnpm smoke` builds first (`pnpm dist`) and then runs it.
- `pnpm checkPkgTypes` — `attw --pack --profile esm-only`, checks the `exports` map and shipped `.d.ts` statically across resolution modes. The profile ignores `node10` and `node16 (from CJS)`, which cannot pass for this ESM-only package by design; `node16 (from ESM)` and `bundler` still run in full and block.
- `pnpm fix` — Biome lint+format auto-fix.

Full command table in `AGENTS.md`.

## Things the code won't tell you

- **Imports carry a `.js` extension** in `src/` (NodeNext): `import {x} from './foo.js'` even though the source is `foo.ts`. Always.
- **`strict: true` but `strictNullChecks: false`** is intentional. Null-ish values are passed around freely; don't add defensive `?:` to "fix" errors that aren't errors here.
- **Decorators are TC39 standard** (no `experimentalDecorators`) — `accessor` keyword, standard descriptor signatures.
- **Biome only** (`biome.json`); ESLint and Prettier are gone. The disabled rules (`noUnsafeDeclarationMerging`, `noConstructorReturn`, `noTsIgnore`, `noAsyncPromiseExecutor`, `useArrowFunction`) each match a deliberate pattern in this codebase.
- **TypeScript needs the explicit `types: ["vitest/globals", "node"]`** in `tsconfig.json`; auto-include from `node_modules/@types/*` no longer fires. Removing it breaks `__testing__/assert-helpers.ts`, which calls the global `expect` — including the two-argument message form Vitest supports natively.
- **Vitest transpiles via SWC, not oxc** (`vitest.config.ts` sets `oxc: false` and loads `unplugin-swc`). Vite 8's oxc pass hands TC39 decorators straight through and Node then rejects `@signal() accessor foo`. Don't drop the plugin unless oxc has learned to lower decorators.
- **TypeScript 7 has no JS compiler API** — `transpileModule` and friends are gone, only the `tsc` binary and `typescript/unstable/*` remain. Any tool needing the old API (ts-jest, `@rollup/plugin-typescript`) cannot be used here.
- **No import cycles.** `rollup.config.mjs` throws on `CIRCULAR_DEPENDENCY`, so a cycle fails `pnpm bundle`. `signal-core.ts` is the leaf layer (`signalImpl`, `isSignal`, `writeSignal`, `destroySignal`, the signal counter) and must never import `createSignal.ts`, `Signal.ts`, `SignalGroup.ts` or `effects.ts`. Details in `AGENTS.md` → "Module layering".
- **Edit only `src/`.** `lib/` (tsc) and `dist/` (rollup) are generated — never commit them.
- **A new file in `src/` is invisible to consumers** until re-exported through `src/index.ts` (default entry) or `src/decorators.ts` (`./decorators` subpath).
- Tests are `*.spec.ts` adjacent to the implementation; Vitest is rooted at `src/` only.
- **pnpm 11 ignores the `pnpm` field in `package.json`** — settings live in `pnpm-workspace.yaml` (`allowBuilds` replaces `onlyBuiltDependencies`).
- `sideEffects: false` — keep module top-levels side-effect-free so tree-shaking holds. Exactly two named exceptions exist, both last lines: the ARCH-001 sentinel in `signalize-error.ts` (losing it costs a warning) and `setCreateEffectHook(createEffect)` in `effects.ts` (losing it makes `Signal.onChange()` throw); the full measurement, and what each costs, is in `AGENTS.md` → "No top-level side effects".

## Verifying subscription leaks

For changes touching subscribe/unsubscribe paths, assert that nothing leaks: snapshot `getSubscriptionCount(queue)` (one argument, imported straight from `@spearwolf/eventize` — `src/__testing__/assert-helpers.ts` uses it but does not re-export it) together with `getSignalsCount` / `getEffectsCount` / `getLinksCount` → run the scenario → destroy → assert restored. For the per-event view there is `getSubscribedEventNames(queue)`. `unsubscribeEffect.spec.ts` is the reference.

## When the public API changes

Sync in this order: source JSDoc → `docs/api.md` → `docs/recipes.md` (if a quirk or pattern is involved) → `docs/cheat-sheet.md` → `skills/using-signalize/` (`SKILL.md` for the mental model and the top-six list, `references/` for the detail) → `README.md` "API at a glance" → `CHANGELOG.md`.

Older doc filenames (`introduction.md`, `guide.md`, `full-api.md`) were superseded — don't recreate them.

## CHANGELOG discipline

Every user-visible change (features, fixes, deps, build system, breaking changes) gets an entry under `## Unreleased`. Pure internal refactors with no observable effect can be skipped.

- One line, one fact. If context is needed, link a commit or PR rather than expanding the line.
- **Never modify entries under released headings** (`## v0.x.y`) — past releases are immutable. Corrections become a new `## Unreleased` entry.
- Group under the existing `### Build System` / `### Bug Fixes` / `### Tests` / `### Documentation` / `### Chores` headings; add a new one only when none fits.
