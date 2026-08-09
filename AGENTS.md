# AGENTS.md — `@spearwolf/signalize`

Architecture and conventions reference for AI coding agents working **on** this repository. It is the canonical, standalone description of the codebase; `CLAUDE.md` keeps only a resident subset of it. Human contributor docs are in `CONTRIBUTING.md`.

Working **with** signalize as a consumer is a different job — that is the `skills/using-signalize/` skill (mental model, pitfalls, patterns), which also ships in the npm package.

## What it is

Framework-agnostic signal/effect/memo/link library. Synchronous reactivity. Built on `@spearwolf/eventize` for all internal pub/sub.

- Runtime: ESM-only, Node `>=24.13`, targets ES2023, `sideEffects: false`
- TypeScript v7 (the native compiler), `strict: true` **but `strictNullChecks: false`** (intentional — don't "fix" it)
- Peer dep: `@spearwolf/eventize ^5.0.0`
- Two entry points: `.` (`src/index.ts`) and `./decorators` (`src/decorators.ts`)

## Core concepts

| Concept | Created via | Purpose |
| --- | --- | --- |
| Signal | `createSignal()` | Reactive value; reads inside an effect register a dependency |
| Effect | `createEffect()` | Function that auto-reruns when tracked signals change |
| Memo | `createMemo()` | Cached derived signal — internally a signal driven by a high-priority effect |
| Link | `link()` | Explicit one-way data flow between signals (or signal → callback) |
| SignalGroup | `new SignalGroup()` | Lifecycle bundle — destroy group → destroys all attached signals/effects/links |
| Object Signal | `@signal` decorator + `findObjectSignal*()` | Signal stored on a host object, retrievable by property name |

## Architecture

### Eventize pub/sub

`@spearwolf/eventize` is **synchronous** (unlike Node's EventEmitter): `emit()` calls all subscribers inline before returning. All internal communication uses it.

| Function | Use here |
| --- | --- |
| `eventize(obj)` | Make object event-capable (used on global queues, `EffectImpl`, `SignalGroup`) |
| `emit(obj, event, ...args)` | Dispatch — signal value changes, lifecycle events |
| `on(obj, event, [priority,] callback)` | Subscribe; higher priority runs first |
| `once(obj, event, callback)` | One-shot subscription (cleanup hooks) |
| `off(obj, [listener])` | Unsubscribe (used in destroy paths) |

### Global event buses (`src/global-queues.ts`)

| Queue | Carries |
| --- | --- |
| `globalSignalQueue` | Signal value changes: `emit(queue, signalId, newValue)` |
| `globalEffectQueue` | Effect lifecycle: `$createEffect`, `$destroyEffect`, `RECALL` |
| `globalDestroySignalQueue` | Signal destruction (cleanup signal) |
| `globalEffectCalledQueue` | Batch deduplication tracking |

### Key symbols (`src/constants.ts`)

| Symbol | Use |
| --- | --- |
| `$signal` | Get internal `SignalImpl` from `Signal` wrapper |
| `$effect` | Get internal `EffectImpl` from `Effect` wrapper |
| `RECALL` | Event triggering effect re-execution |
| `$createEffect`, `$destroyEffect` | Effect lifecycle events |
| `$effectError` | Rejection of an async effect/cleanup callback (see `onEffectError`) |
| `$destroySignal` | Signal destruction event |

### Priorities

Effects subscribe to signals with a numeric priority — **higher runs first**.

- Memos: `Priority.C` = 1000 (`createMemo.ts:111`)
- Effects: `0` (`EffectImpl.ts:112`, `options.priority ?? 0`)

### Dependency tracking flow

```
1. effect.run()
2. push effect onto globalEffectStack
3. callback executes
4. signal.get() inside callback
5. signal calls getCurrentEffect()?.whenSignalIsRead(signalId)
6. effect subscribes: on(globalSignalQueue, signalId, priority, RECALL, this)
7. ...later, signal value changes:
8. emit(globalSignalQueue, signalId, newValue)
9. RECALL handler fires → step 1
```

Subscribe-on-read happens inside `EffectImpl.whenSignalIsRead` (single subscription per signalId per run); cleanup happens before each rerun and on destroy.

**Static-deps effects take the same route with step 5 disarmed.** They are pushed onto the stack like any other effect — that is what makes effects created in their callback child effects — but `EffectImpl.#suppressAutoTracking` is set for the duration of the callback, and `whenSignalIsRead()` returns early while it is. The declared dependencies are subscribed from `saveSignalsFromDeps()`, called by `createEffect()` on the fresh instance whose flag is still `false` — and again at the top of every `run()`, before the callback, which is what lets a static-deps effect re-subscribe after a `SignalGroup.off()` soft-detach the way a dynamic one does by re-reading (BUG-003). Both calls skip a dependency that is already destroyed. The flag is per instance and saved/restored around the callback, so neither a child effect nor the outer frame of a re-entrant run inherits the suppression.

### Batching

`batch(callback)`:

1. Creates `Batch` instance, sets it as current context
2. `effect.run()` enqueues into a priority-ordered queue instead of running
3. Batch end → drains queue, each effect runs at most once

### Other context modes

| Mode | Function | Effect |
| --- | --- | --- |
| Quiet | `beQuiet(fn)` | Inside `fn`, signal `set()` does **not** notify dependents |
| Hibernate | `hibernate(fn)` | Suspends all reactive context state during `fn` |
| Untracked read | `value(signal)` or `signal.value` | Read without registering as dependency |
| Forced notify | `touch(signal)` | Emit change without value change |

## Source file map

| File | Responsibility |
| --- | --- |
| `index.ts` | Public API exports for `.` |
| `decorators.ts` | `@signal` (TC39 standard decorator) — separate `./decorators` entry |
| `constants.ts` | Symbols (`$signal`, `$effect`, `RECALL`, `$createEffect`, `$destroyEffect`, `$destroySignal`) |
| `types.ts` | Public TypeScript interfaces |
| `Signal.ts` | `Signal<T>` class — thin wrapper around `SignalImpl` |
| `signal-core.ts` | Leaf layer — `isSignal`, `destroySignal`, `muteSignal`, `unmuteSignal`, `getSignalsCount`, internal `signalImpl`, `readSignal`, `writeSignal`, `incSignalsCount`. Imports nothing above itself; every other module reaches signal primitives through here |
| `createSignal.ts` | `SignalImpl`, `createSignal` — the factory layer on top of `signal-core.ts` |
| `Effect.ts` | `Effect` class — wrapper around `EffectImpl` |
| `EffectImpl.ts` | Core dependency tracking + rerun logic; `EffectOptions` interface |
| `effects.ts` | `createEffect`, `getEffectsCount`, `onCreateEffect`, `onDestroyEffect`, `onEffectError` |
| `createMemo.ts` | `createMemo` — wraps signal + high-priority effect |
| `link.ts` | `link`, `unlink`, `getLinksCount` |
| `SignalLink.ts` | `SignalLink` (abstract), `SignalLinkToSignal`, `SignalLinkToCallback`, `ValueCallback` |
| `SignalGroup.ts` | `SignalGroup` lifecycle container |
| `SignalAutoMap.ts` | `SignalAutoMap`, `SignalAutoMapKeyType` — auto-creating signal map |
| `globalEffectStack.ts` | Effect execution context stack (`getCurrentEffect()`) |
| `global-queues.ts` | The four global eventize buses |
| `batch.ts` | `batch()` and `Batch` class |
| `bequiet.ts` | `beQuiet()`, `isQuiet()` |
| `hibernate.ts` | `hibernate()` |
| `touch.ts` | `touch()` |
| `value.ts` | `value()` (untracked read) |
| `object-signals.ts` | `destroyObjectSignals`, `findObjectSignalByName`, `findObjectSignals`, `findObjectSignalNames`; internal `storeAsObjectSignal` (used by `@signal` decorator, **not** re-exported through `index.ts`) |
| `UniqIdGen.ts` | Symbol-based unique ID generator (`Symbol('si1')`, `Symbol('ef1')`) |
| `__testing__/assert-helpers.ts` | **Test-only**: uses `getSubscriptionCount(queue)` (imported from `@spearwolf/eventize`, one argument, not re-exported) for leak assertions; `tsconfig.lib.json` excludes `src/__testing__/**`, so it never compiles into `lib/` |

### Module layering — no import cycles

`rollup.config.mjs` throws on `CIRCULAR_DEPENDENCY`, so a cycle fails `pnpm bundle`. The rule that keeps the graph acyclic:

- `signal-core.ts` is the leaf. It may import only `constants.ts`, `types.ts`, `bequiet.ts`, `global-queues.ts`, `globalEffectStack.ts`. Never `createSignal.ts`, `Signal.ts`, `SignalGroup.ts` or anything effect-related.
- Everything that needs `signalImpl`, `isSignal`, `writeSignal` or `destroySignal` imports them from `signal-core.ts`, not from `createSignal.ts`.
- `createSignal.ts` sits above and may reach up to `Signal.ts`, `SignalGroup.ts` and `effects.ts`.

Also avoid reading an imported binding at module-eval time across module boundaries (`export const x = SomeClass.method`). Delegate through a function instead — `effects.ts:createEffect` is the pattern. An eager read inside a cycle is what previously made `import('./lib/EffectImpl.js')` crash with a TDZ `ReferenceError`.

## Public API (what `index.ts` re-exports)

**Signals**: `createSignal`, `destroySignal`, `isSignal`, `getSignalsCount`, `muteSignal`, `unmuteSignal`, `touch`, `value`
**Effects**: `createEffect`, `getEffectsCount`, `onCreateEffect`, `onDestroyEffect`, `onEffectError`
**Memos**: `createMemo`, `CreateMemoOptions`
**Links**: `link`, `unlink`, `getLinksCount`, `SignalLink` (type), `ValueCallback`
**Object Signals**: `destroyObjectSignals`, `findObjectSignalByName`, `findObjectSignalNames`, `findObjectSignals`
**Groups**: `SignalGroup`, `getSignalGroupsCount`, `SignalAutoMap`, `SignalAutoMapKeyType`
**Utilities**: `batch`, `beQuiet`, `isQuiet`, `hibernate`
**Classes**: `Signal`, `Effect`, `SignalGroup`, `SignalAutoMap`
**Types**: everything from `types.ts`

**Subpath `@spearwolf/signalize/decorators`** (`src/decorators.ts`): `signal`, `SignalDecoratorOptions`, `SignalReaderDecoratorOptions`. There is no memo decorator — class-bound memos are `createMemo(..., {attach: this})`. Decorators are TC39 standard (no `experimentalDecorators`); use the `accessor` keyword.

## Development workflow

### Commands (`package.json`)

| Command | Runs |
| --- | --- |
| `pnpm cbt` | `clean + compile + bundle + test` — local "done" gate |
| `pnpm world` | `clean + check + compile + bundle + test:smoke + checkPkgTypes + test + test:gc` — the full blocking CI scope |
| `pnpm test` | Vitest (SWC transform, v8 coverage); roots = `src/`. Runs two projects — `unit` and `gc` (`--expose-gc`, `fileParallelism: false`) — as a single run with one combined coverage map; per-file thresholds in `vitest.config.ts`, which refuses to start if a threshold glob group matches no file |
| `pnpm test <pattern>` | single spec, e.g. `pnpm test createSignal.spec.ts` |
| `pnpm test -t "<name>"` | filter by test name |
| `pnpm test:watch` | Vitest in watch mode, no coverage gate |
| `pnpm test:gc` | runs every file serially (`fileParallelism: false`, `vitest.gc.config.ts`) with `--expose-gc` applied to the whole suite; not what makes `SignalGroup.gc.spec.ts`/`link.gc.spec.ts` execute — `pnpm test` already does that, via the `gc` project, on the same default `forks` pool |
| `pnpm test:debug` | Vitest under `--inspect-brk`, one file at a time |
| `pnpm test:smoke` | Clears `smoke/build`, compiles `smoke/*.ts` (`tsc --project smoke/tsconfig.json`), then hard-fails if no `smoke/build/*.test.js` matched — a renamed test file or a stale leftover masking that — before `node --test` runs it; exact command in `package.json`. Runs (does not build the shipped artifact) against an already-built `dist/`/`lib/`; plain Node, no Vitest |
| `pnpm smoke` | `pnpm dist` + `pnpm test:smoke` — builds first, then smoke-tests; the single-command entry point for a human or for iterating on `smoke/dist-smoke.test.ts` |
| `pnpm bench` | Vitest Bench over `bench/*.bench.ts`; informative in CI, no regression gate |
| `pnpm compile` | `run-s compile:js compile:types` — two `tsc` passes into `lib/` |
| `pnpm compile:js` | `tsc --project tsconfig.lib.json` → `lib/*.js` + `lib/*.js.map`, for Rollup |
| `pnpm compile:types` | `tsc --project tsconfig.types.json` → `lib/*.d.ts`, with JSDoc kept and `@internal` symbols stripped |
| `pnpm bundle` | rollup → `dist/index.js`, `dist/decorators.js` |
| `pnpm clean` | `rimraf build types tests dist lib coverage smoke/build` |
| `pnpm check` / `pnpm fix` | Biome lint+format check / Biome auto-fix |
| `pnpm lint` | Biome lint only |
| `pnpm format` / `pnpm format:write` | Biome format check / auto-fix |
| `pnpm checkPkgTypes` | `attw --pack --profile esm-only` — package types audit. The profile ignores `node10` and `node16 (from CJS)`, which cannot pass for an ESM-only package with a subpath export (no `exports`-map support / ESM served to a CJS resolver, respectively); `node16 (from ESM)` and `bundler` are still checked in full. Blocks in CI (`pnpm world`, `ci.yml`), not just documented |
| `pnpm dist` | clean + compile + bundle (no test) |

`package.json#files` is an allowlist, not a denylist — there is no `.npmignore`. What ships in the npm tarball (2026-08-09): `dist/`, `lib/**/*.d.ts`, `docs/`, `skills/`, plus `README.md`, `CHANGELOG.md`, `LICENSE` and `package.json` — 45 files, 493.8 kB unpacked, 134.2 kB packed. `npm pack --dry-run` is the way to check this against the current tree.

`pnpm compile` is two `tsc` passes, not one, because `removeComments` does not distinguish `.js` output from `.d.ts` output: turning it off to keep JSDoc in the declarations would also put it back into `lib/*.js`, which Rollup then carries into `dist/` — measured at ~110 kB more in `dist/*.js` for comments nobody reads there. `tsconfig.lib.json` (`compile:js`) stays `removeComments: true` and emits only JS plus its sourcemap; `tsconfig.types.json` (`compile:types`) is `emitDeclarationOnly`, keeps comments, and sets `stripInternal: true`.

**`@internal` is a compiler switch here, not a comment.** Since `pnpm compile:types` sets `stripInternal: true`, any JSDoc-tagged `@internal` symbol is cut from the published `.d.ts` — an `@internal` on a symbol a consumer is meant to see quietly removes it from autocomplete, and neither `attw` nor the test suite notices (2026-08-09, BUILD-011).

Any filtered run (`pnpm test <pattern>`, `pnpm test -t "<name>"`) ends with exit 1: the per-file coverage thresholds are evaluated against the files that did *not* run, so the gate always fails. Read the test result, not the exit code — it is not a test failure.

`.github/workflows/ci.yml` runs `pnpm check`, `pnpm typecheck`, `pnpm dist`, `pnpm test:smoke`, `pnpm checkPkgTypes`, `pnpm test`, `pnpm test:gc` and `pnpm bench` (the last one informative, non-blocking) — in that order, because `pnpm dist` starts with `clean`, which deletes `coverage/`, so every build step must run before `pnpm test` or the final coverage-summary step finds nothing to publish. `pnpm world` covers exactly the blocking steps (`check`, `test:smoke`, `checkPkgTypes`, `test`, `test:gc`); `pnpm bench` is CI's informative step and has no local gate of its own. `pnpm cbt` additionally skips `check`, `test:smoke`, `checkPkgTypes` and `test:gc`. Tooling is **Biome 2.x** (replaced ESLint + Prettier in v0.28) and **Vitest 4** (replaced Jest + ts-jest in v0.31).

`ci.yml` triggers on push (except to `main`), on `pull_request` against `main`, and on `workflow_call`; `main.yml` calls `ci.yml` via `workflow_call`, so the deploy path runs the same steps.

The test transform runs through **SWC**, not Vite's built-in oxc pass: `vitest.config.ts` sets `oxc: false` and registers `unplugin-swc` with `decoratorVersion: '2022-03'`. oxc emits TC39 decorators verbatim, which Node cannot parse — without the plugin every decorator spec dies with `SyntaxError: Invalid or unexpected token`. Note also that TypeScript 7 ships no JS compiler API (`transpileModule` is gone), so ts-jest-style transformers are not an option.

### Deliberately not tested

No browser test run — no Playwright, no `@vitest/browser`, no jsdom/happy-dom, no second CI job. Every job runs on `ubuntu-latest` (`ci.yml:13-17`, `main.yml:18-21`), and `main.yml`'s `test` job is the `ci.yml` workflow itself, called via `workflow_call`; `vitest.config.ts:97` sets `environment: 'node'`. This is a decision, not a gap:

- **Why it holds:** `src/` uses no platform-dependent API. A `grep` across `src/*.ts` (specs excluded) for `node:`, `process.`, `Buffer`, `setTimeout`, `setInterval`, `queueMicrotask`, `structuredClone`, `globalThis` and `require(` turns up nothing but three comment lines, none of them code: `effects.ts:66` and `EffectImpl.ts:84` mention Node's unhandled-rejection behaviour in prose while explaining why an async effect's rejection is routed to `onEffectError()` instead of thrown; `SignalLink.ts:95` mentions "the whole process" while explaining why a link's self-reference goes through a `WeakRef` — a lifetime argument, not a rejection one. The only non-trivial runtime objects in use are `WeakRef` (`SignalLink.ts:116,506`, `SignalGroup.ts:165,262`, `SignalAutoMap.ts:82`) and `FinalizationRegistry` (`link.ts:86`, `SignalGroup.ts:59`, `signal-core.ts:34`, `SignalAutoMap.ts:21`), plus `console.error` and `console.warn` (`link.ts:237` warns once per source at 1000 links, MEM-005) — all plain ECMAScript, identical across engines.
- **Where the environment risk actually sits, and what already covers it:** in *resolution*, not *execution*. `attw --pack --profile esm-only` checks the `exports` map and shipped `.d.ts` in `bundler` mode — the resolution path a browser consumer actually takes — and `smoke/dist-smoke.test.ts` runs the built `dist/` for real. The TC39 decorator lowering that a browser's own bundler would perform is exercised by the smoke test's `tsc` pass, not by an engine.
- **Why a browser run wouldn't add coverage anyway:** the one thing that could behave differently across engines is GC timing around `WeakRef`/`FinalizationRegistry`, and the 20 tests that exercise it depend on `--expose-gc` (`vitest.config.ts:126`), a flag no portable browser harness provides. A browser smoke test would skip exactly the tests whose answer it could change.

What would overturn this: the first line in `src/` that touches a DOM or Node-only API, or a dedicated browser entry point in the `exports` map.

`docs/quickstart.md:10` and `skills/using-signalize/SKILL.md:8` both say the package runs in "a modern browser". That claim stands on the same argument as above and is unaffected by it — it asserts support, not a test run, and the two documents make no testing claim to begin with.

## Repo conventions

- **Edit only `src/`.** `lib/` (tsc) and `dist/` (rollup) are generated artifacts.
- **Imports use `.js` extension** within `src/` (NodeNext resolution): `import {x} from './foo.js'` even when source is `foo.ts`. Required.
- **Test files**: `*.spec.ts` adjacent to implementation. Vitest matches `src/**/*.{spec,test}.ts`. Globals (`describe`, `it`, `expect`, `vi`) are enabled — no imports needed, except `import type {MockInstance} from 'vitest'` when you type a spy.
- **`smoke/`** is the one exception: `smoke/dist-smoke.test.ts` runs on plain Node (`node --test`, via `pnpm test:smoke`), not Vitest, against the built `dist/`/`lib/`, not `src/`. It exists because every other spec is transformed by `unplugin-swc`, and SWC's `decoratorVersion: '2022-03'` is the one decorator lowering this library never ships — this is the only test where **tsc** lowers a `@signal() accessor` application, the way a consumer's own compiler would. It never runs under Vitest and never moves into `src/`.
- **No top-level side effects** — `sideEffects: false` enables tree-shaking; respect it.
- **Public API surface** must be wired through `src/index.ts` (default) or `src/decorators.ts` (subpath). Adding a file in `src/` does nothing for consumers without that wiring.
- **Subscription-leak verification**: tests touching subscribe/unsubscribe paths should snapshot `getSubscriptionCount()` and counters (`getSignalsCount/getEffectsCount/getLinksCount`) → run scenario → assert restored. See `unsubscribeEffect.spec.ts`.
- **Don't add `?:` defensively**: `strictNullChecks: false` is intentional. Existing code passes potentially-null values around freely.

## Common change patterns

| Change | Touch |
| --- | --- |
| New `Signal` method | `types.ts` interface → `SignalImpl` in `createSignal.ts` → `Signal.ts` wrapper → tests in adjacent `*.spec.ts` |
| New effect option | `EffectOptions` in `EffectImpl.ts` → handle in constructor / `createEffect` → tests in `effects.spec.ts` (or new `effects.<feature>.spec.ts`) |
| New utility function | `src/<name>.ts` → re-export in `src/index.ts` → adjacent `<name>.spec.ts` |
| Modifying core reactivity | Read `EffectImpl.ts` (subscribe paths) + `signal-core.ts` (emit paths) + `global-queues.ts`; add subscription-count assertions to tests |

## Documentation surface

| Path | Purpose |
| --- | --- |
| `README.md` | User-facing entry — minimal example + links to `docs/` |
| `docs/quickstart.md` | Install + 5-minute tour |
| `docs/architecture.md` | Concepts, reactivity flow, internals, source map |
| `docs/api.md` | Complete API reference with all options |
| `docs/recipes.md` | Patterns, quirks, gotchas |
| `docs/cheat-sheet.md` | One-page lookup |
| `skills/using-signalize/` | Agent skill for *consumers* — lean `SKILL.md` plus `references/{api,pitfalls,patterns}.md` loaded on demand |
| `CHANGELOG.md` | Version history + migration notes |

When the public API changes, sync in this order: source JSDoc → `docs/api.md` → `docs/recipes.md` (when a quirk/pattern is involved) → `docs/cheat-sheet.md` → `skills/using-signalize/` → `README.md` "API at a glance" → `CHANGELOG.md` "Unreleased".

For the skill, keep `SKILL.md` lean — it carries the mental model, the six silently-wrong behaviours, and the pointer table. New API detail belongs in `references/api.md`, new quirks in `references/pitfalls.md`, new idioms in `references/patterns.md`. A quirk graduates into `SKILL.md` only when it is both common and silent.

Older doc filenames (`introduction.md`, `guide.md`, `full-api.md`) were superseded — do not recreate them.
