# AGENTS.md — `@spearwolf/signalize`

Architecture and conventions reference for AI coding agents working **on** this repository. It is the canonical, standalone description of the codebase; `CLAUDE.md` keeps only a resident subset of it. Human contributor docs are in `CONTRIBUTING.md`.

Working **with** signalize as a consumer is a different job — that is the `skills/using-signalize/` skill (mental model, pitfalls, patterns), which also ships in the npm package.

## What it is

Framework-agnostic signal/effect/memo/link library. Synchronous reactivity. Built on `@spearwolf/eventize` for all internal pub/sub.

- Runtime: ESM-only, Node `>=22`, targets ES2023, `sideEffects: false`
- TypeScript v7 (the native compiler), `strict: true` **but `strictNullChecks: false`** (intentional — don't "fix" it)
- Peer dep: `@spearwolf/eventize ^6.0.0`
- Two entry points: `.` (`src/index.ts`) and `./decorators` (`src/decorators.ts`)

## Core concepts

| Concept | Created via | Purpose |
| --- | --- | --- |
| Signal | `createSignal()` | Reactive value; reads inside an effect register a dependency |
| Effect | `createEffect()` | Function that auto-reruns when tracked signals change |
| Memo | `createMemo()` | Cached derived signal — internally a signal driven by a high-priority effect |
| Link | `link()` | Explicit one-way data flow between signals (or signal → callback) |
| SignalGroup | `SignalGroup.findOrCreate(obj)` | Lifecycle bundle — destroy group → destroys all attached signals/effects/links |
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
| `globalEffectCalledQueue` | Batch deduplication tracking — emitted on only while a batch flush is running |

### Key symbols (`src/constants.ts`)

| Symbol | Use |
| --- | --- |
| `$signal` | Get internal `SignalImpl` from `Signal` wrapper |
| `$effect` | Get internal `EffectImpl` from `Effect` wrapper |
| `RECALL` | Event triggering effect re-execution |
| `$createEffect`, `$destroyEffect` | Effect lifecycle events |
| `$effectError` | Rejection of an async effect/cleanup callback (see `onEffectError`) |
| `$signalizeError` | Every diagnostic with no caller to throw at — finalizer failures, deprecation notices, the link threshold, and effect failures nobody took (see `onSignalizeError`) |
| `$destroySignal` | Signal destruction event |

### Priorities

Effects subscribe to signals with a numeric priority — **higher runs first**.

- Memos: `Priority.C` = 1000 (`create-memo.ts`, `options?.priority ?? Priority.C`)
- Effects: `0` (`EffectImpl.ts`, `options?.priority ?? 0`)

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

**Static-deps effects take the same route with step 5 disarmed.** They are pushed onto the stack like any other effect — that is what makes effects created in their callback child effects — but `EffectImpl.#suppressAutoTracking` is set for the duration of the callback, and `whenSignalIsRead()` returns early while it is. The declared dependencies are subscribed from `saveSignalsFromDeps()`, called by `createEffect()` on the fresh instance whose flag is still `false` — and again at the top of every `run()`, before the callback, which is what lets a static-deps effect re-subscribe after a `SignalGroup.off()` soft-detach the way a dynamic one does by re-reading. Both calls skip a dependency that is already destroyed. The flag is per instance and saved/restored around the callback, so neither a child effect nor the outer frame of a re-entrant run inherits the suppression.

### Batching

`batch(callback)`:

1. Creates `Batch` instance, sets it as current context
2. `effect.run()` enqueues into a priority-ordered queue instead of running
3. Batch end → drains queue, each effect runs at most once
4. Two things walk past that gate: a memo's read hook is `EffectImpl.runImmediately` (not `run`), so a read recomputes on the spot and takes its queued entry back via `Batch.unbatch()`; and an explicitly requested `run()` is remembered on the effect, so the flush carries it out even without `autorun`
5. The memo pull is one level deep. `#run()` returns at `!shouldRun` before it ever sees the gate, so a memo that is stale only through *another* memo is not pulled — its upstream's write is what the batch is holding back, and nothing marked it dirty. It catches up at the flush only if that upstream is eager; reading the upstream first, in the same batch, is the way out and works for a lazy one too. And a memo reading *both* a signal written in the batch *and* an upstream memo recomputes twice per batch: the upstream's write re-queues the reader right after it read that value. The two are complementary — a memo is either not reached or computed twice, never both. All pinned by tests in `batch.spec.ts`; closing either needs "maybe dirty" propagation, which this library does not have

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
| `constants.ts` | Symbols (`$signal`, `$effect`, `RECALL`, `$createEffect`, `$destroyEffect`, `$effectError`, `$signalizeError`, `$destroySignal`) |
| `types.ts` | TypeScript interfaces — the published ones *and* the implementation layer (`ISignalImpl`). Being in this file does not make a type public; `index.ts` decides, by name |
| `Signal.ts` | `Signal<T>` class — thin wrapper around `SignalImpl` |
| `signal-core.ts` | Leaf layer — `isSignal`, `destroySignal`, `muteSignal`, `unmuteSignal`, `getSignalsCount`, internal `signalImpl`, `readSignal`, `writeSignal`, `incSignalsCount`. Imports nothing above itself; every other module reaches signal primitives through here |
| `collect-errors.ts` | Leaf below `signal-core.ts` — imports nothing. Teardown error collection (`throwCollectedErrors`, `collect`) plus the isolated-delivery frame `writeSignal()` uses to let every subscribed effect run before re-raising (`beginIsolatedDelivery`, `collectDeliveryError`, `endIsolatedDelivery`) |
| `create-signal.ts` | `SignalImpl`, `createSignal` — the factory layer on top of `signal-core.ts` |
| `Effect.ts` | `Effect` class — wrapper around `EffectImpl` |
| `EffectImpl.ts` | Core dependency tracking + rerun logic; the five options and deps types (`EffectOptions`, `EffectOptionsWithSignalDeps`, `EffectOptionsWithNameDeps`, `EffectDeps`, `SignalLikeDeps`), all re-exported from `index.ts` |
| `effects.ts` | `createEffect`, `getEffectsCount`, `onCreateEffect`, `onDestroyEffect`, `onEffectError`, `setMaxEffectDepth`, `getMaxEffectDepth` |
| `effect-error-handlers.ts` | Leaf — the `@internal` handler counter `onEffectError()` wraps its unsubscribe in (`trackEffectErrorHandler`, `hasEffectErrorHandler`, `getEffectErrorHandlerCount`), read by `EffectImpl.ts`'s `emitEffectError()` in place of a linear `getSubscribedEventNames()` scan; not re-exported from either entry point |
| `effect-hook.ts` | Leaf — holds the `@internal` `createEffect` placeholder (`setCreateEffectHook`, `requireCreateEffect`), written once from the last line of `effects.ts` and read by `Signal.onChange()` and the deprecated `signalReader(callback)`. That indirection is what keeps `effects.ts` out of a signal-only bundle; not re-exported from either entry point |
| `signalize-error.ts` | Leaf layer — `onSignalizeError` plus the `@internal` `reportSignalizeError`. Every diagnostic with no caller to throw at goes through here; the console is its fallback, not its mechanism |
| `instances.ts` | Leaf below the leaf — the `@internal` `registerSignalizeInstance()`, called once from the last line of `signalize-error.ts`. Registers this copy on `globalThis` and reports through the oldest copy when a second one shows up; not re-exported from either entry point |
| `deprecation-warnings.ts` | One layer above `signalize-error.ts` — the `@internal` once-per-process deprecation gate (`warnDeprecatedOnce`, `DeprecationKey`), read by `create-signal.ts` and `SignalGroup.ts`; not re-exported from either entry point |
| `create-memo.ts` | `createMemo` — wraps signal + high-priority effect |
| `link.ts` | `link`, `unlink`, `getLinksCount` |
| `SignalLink.ts` | `SignalLink` (abstract), `SignalLinkToSignal`, `SignalLinkToCallback`, `ValueCallback` |
| `SignalGroup.ts` | `SignalGroup` lifecycle container — nine of its eleven member containers start out as module-level shared empty stand-ins and are only allocated on first write; every read path treats them as ordinary empty collections |
| `SignalAutoMap.ts` | `SignalAutoMap`, `SignalAutoMapKeyType` — auto-creating signal map |
| `global-effect-stack.ts` | Effect execution context stack (`getCurrentEffect()`) |
| `global-queues.ts` | The four global eventize buses |
| `batch.ts` | `batch()` and `Batch` class |
| `be-quiet.ts` | `beQuiet()`, `isQuiet()` |
| `hibernate.ts` | `hibernate()` |
| `touch.ts` | `touch()` |
| `value.ts` | `value()` (untracked read) |
| `object-signals.ts` | `destroyObjectSignals`, `findObjectSignalByName`, `findObjectSignals`, `findObjectSignalNames`; internal `storeAsObjectSignal` (used by `@signal` decorator, **not** re-exported through `index.ts`) |
| `UniqIdGen.ts` | Symbol-based unique ID generator (`Symbol('si1')`, `Symbol('ef1')`) |
| `__testing__/assert-helpers.ts` | **Test-only**: uses `getSubscriptionCount(queue)` (imported from `@spearwolf/eventize`, one argument, not re-exported) for leak assertions; `tsconfig.lib.json` excludes `src/__testing__/**`, so it never compiles into `lib/` |

### Module layering — no import cycles

`rollup.config.mjs` throws on `CIRCULAR_DEPENDENCY`, so a cycle fails `pnpm bundle`. The rule that keeps the graph acyclic:

- `signal-core.ts` is the leaf. It may import only `constants.ts`, `types.ts`, `be-quiet.ts`, `global-queues.ts`, `global-effect-stack.ts`, `collect-errors.ts`. Never `create-signal.ts`, `Signal.ts`, `SignalGroup.ts` or anything effect-related.
- Everything that needs `signalImpl`, `isSignal`, `writeSignal` or `destroySignal` imports them from `signal-core.ts`, not from `create-signal.ts`.
- `create-signal.ts` sits above and may reach up to `Signal.ts`, `SignalGroup.ts` and `effect-hook.ts`. **Not `effects.ts`** — neither it nor `Signal.ts` may import that module again; both go through the hook, and an import edge back would restore the 6 548 bytes that removing it saved.
- `effect-hook.ts` is a leaf of the same kind. It may import, **type-only**, `Effect.ts` and `types.ts` — nothing else, and `effects.ts` or `EffectImpl.ts` least of all: those write the placeholder, so a value import back closes the ring `effects.ts` → `effect-hook.ts` → `effects.ts` and `pnpm bundle` fails. `Signal.ts` and `create-signal.ts` read it, `effects.ts` writes it from its last line.
- `signalize-error.ts` is a leaf too, and has to stay one — every layer reports through it. It may import `@spearwolf/eventize`, `constants.ts`, `global-queues.ts` and, **type-only**, `types.ts`. Never `effects.ts`, `EffectImpl.ts` or `SignalGroup.ts`: `effects.ts` → `EffectImpl.ts` → `SignalGroup.ts` → `signalize-error.ts` is a chain of value imports, so a value import back into `effects.ts` closes the ring. `tsc` says nothing; `pnpm bundle` fails.
- `instances.ts` is the leaf below that leaf — the multi-copy sentinel. It may import `constants.ts` and, **type-only**, `types.ts` — nothing else. Its only caller is `signalize-error.ts`, whose last line registers the copy with `import.meta.url` and `reportSignalizeError`; an import back into `signalize-error.ts` from here closes that two-module ring. The reporter arrives as an argument for exactly that reason.
- `effect-error-handlers.ts` is a leaf. It may import `constants.ts`, `global-queues.ts` and, **type-only**, `types.ts` — nothing else, and `effects.ts` or `EffectImpl.ts` least of all: both read the handler counter it keeps, and `effects.ts` → `EffectImpl.ts` → `SignalGroup.ts` → `signalize-error.ts` is already a chain of value imports, so a value import back into either from here closes a ring. Measured on a prototype that put the counter directly in `effects.ts` instead: `tsc --noEmit` says nothing, `pnpm compile` succeeds, `pnpm bundle` fails with `Circular dependency: lib/effects.js -> lib/EffectImpl.js -> lib/effects.js`.
- `deprecation-warnings.ts` sits one layer **above** `signalize-error.ts`, not below it: it needs `reportSignalizeError`, so it is not a leaf. It imports that module and nothing else; `create-signal.ts` and `SignalGroup.ts` import it. The back edge is the one that must never exist — a value import from `signalize-error.ts` (or from `instances.ts` below it) into this module closes a two-module ring. Measured 2026-08-12 on an isolated copy of the tree: `tsc` stays completely silent (exit 0, no diagnostic), `pnpm bundle` fails with `Circular dependency: lib/deprecation-warnings.js -> lib/signalize-error.js -> lib/deprecation-warnings.js`.
- `Effect.ts`, `EffectImpl.ts`, `global-effect-stack.ts`, `SignalGroup.ts`, `SignalLink.ts` and `types.ts` reference each other in both directions; the back-edge in each pair is type-only and **must** be `import type` (`Effect.ts` ↔ `EffectImpl.ts`, `EffectImpl.ts` ↔ `global-effect-stack.ts`, `EffectImpl.ts` ↔ `SignalGroup.ts`, `SignalGroup.ts` ↔ `SignalLink.ts`, `SignalGroup.ts` ↔ `types.ts`). Measured 2026-08-11: with all thirteen crossing imports marked `import type`, the value-import graph of `src/` is acyclic — before, it held a single 12-module strongly connected component. Turning one of these back-edges into a value use brings the cycle back — verified on `global-effect-stack.ts`'s back-edge to `EffectImpl.ts`: swap its `import type` for a value import and add `export const isEffectImpl = (x: unknown) => x instanceof EffectImpl;`, and `pnpm bundle` fails with `Circular dependency: lib/EffectImpl.js -> lib/global-effect-stack.js -> lib/EffectImpl.js` (`rollup.config.mjs`, the `CIRCULAR_DEPENDENCY` branch); `tsc` stays silent throughout. The `SignalGroup.ts` ↔ `types.ts` pair is the one exception: `SignalGroup.ts`'s back-edge imports only interfaces (`ISignalImpl`, `SignalLike`) with no runtime representation, so no value use of that import can ever exist — that pair cannot re-form a two-module cycle by itself, regardless of import form. Biome's `style/useImportType` rule (`biome.json`) enforces the marking now, so `pnpm check` catches a regression before `pnpm bundle` has to.

Also avoid reading an imported binding at module-eval time across module boundaries (`export const x = SomeClass.method`). Delegate through a function instead — `effects.ts:createEffect` is the pattern. An eager read inside a cycle is what previously made `import('./lib/EffectImpl.js')` crash with a TDZ `ReferenceError`.

## Public API (what `index.ts` re-exports)

**Signals**: `createSignal`, `destroySignal`, `isSignal`, `getSignalsCount`, `muteSignal`, `unmuteSignal`, `touch`, `value`
**Effects**: `createEffect`, `getEffectsCount`, `onCreateEffect`, `onDestroyEffect`, `onEffectError`, `setMaxEffectDepth`, `getMaxEffectDepth`
**Diagnostics**: `onSignalizeError` — the channel for everything with no caller to throw at; `reportSignalizeError` stays `@internal` and is *not* published (`stripInternal` keeps it out of `lib/signalize-error.d.ts`)
**Memos**: `createMemo`, `CreateMemoOptions`
**Links**: `link`, `unlink`, `getLinksCount`, `SignalLink` (type), `ValueCallback`
**Object Signals**: `destroyObjectSignals`, `findObjectSignalByName`, `findObjectSignalNames`, `findObjectSignals`
**Groups**: `SignalGroup`, `getSignalGroupsCount`, `SignalAutoMap`, `SignalAutoMapKeyType`
**Utilities**: `batch`, `beQuiet`, `isQuiet`, `hibernate`
**Classes**: `Signal`, `Effect`, `SignalGroup`, `SignalAutoMap`
**Types**: a **named list** in `index.ts` — twenty names, everything in `types.ts` except `ISignalImpl`, which is the implementation layer and stays inside the module graph. Consumers reach the source of a link through `LinkSource<T>` instead.

> **The list is named on purpose — do not turn it back into a star, in either form.** This holds for every export of `index.ts`, not only the type list: a value star (`export * from …`) republishes every future export of that module unasked, and `export type *` does the same for its types. Nothing in `pnpm world` would report the type form on its own: `compile` emits happily, `attw` reads module shape rather than signatures, and the suite runs against `src/`. Three things hold the line now: `performance/noReExportAll` (`biome.json`) fails `pnpm check` on a value star; `src/index.public-surface.spec.ts` rejects both star forms by reading the source text and additionally pins the exact value-export list; and for the type half, which neither of those two reaches, `src/types.public-surface.spec.ts` holds a `@ts-expect-error` over `import('./index.js').ISignalImpl<number>` — a star makes that directive stop failing and `tsc` reports the unused directive. **Adding a new published type therefore means adding its name to the list**, alphabetically; adding a new published value means the same, in `index.ts`'s export line for that module *and* in the list inside `index.public-surface.spec.ts`. Marking the implementation layer `@internal` and letting `stripInternal` do the work is measured and rejected: it emits a `lib/` whose `types.d.ts` names `ISignalImpl` without declaring it (`TS2304`, plus `TS2305` in `Signal.d.ts`/`SignalLink.d.ts`) and no gate step sees it.

**Subpath `@spearwolf/signalize/decorators`** (`src/decorators.ts`): `signal`, `SignalDecoratorOptions`, `SignalReaderDecoratorOptions`. There is no memo decorator — class-bound memos are `createMemo(..., {attach: this})`. Decorators are TC39 standard (no `experimentalDecorators`); use the `accessor` keyword.

## Development workflow

### Commands (`package.json`)

| Command | Runs |
| --- | --- |
| `pnpm cbt` | `clean + compile + bundle + test` — local "done" gate |
| `pnpm world` | `clean + check + typecheck + compile + bundle + test:smoke + checkPkgTypes + test + test:gc` — the full blocking CI scope |
| `pnpm test` | Vitest (SWC transform, v8 coverage); roots = `src/`. Runs two projects — `unit` and `gc` (`--expose-gc`, `fileParallelism: false`) — as a single run with one combined coverage map; per-file thresholds in `vitest.config.ts`, which refuses to start if a threshold glob group matches no file |
| `pnpm test <pattern>` | single spec, e.g. `pnpm test create-signal.spec.ts` |
| `pnpm test -t "<name>"` | filter by test name |
| `pnpm test:watch` | Vitest in watch mode, no coverage gate |
| `pnpm test:gc` | runs every file serially (`fileParallelism: false`, `vitest.gc.config.ts`) with `--expose-gc` applied to the whole suite; not what makes all `src/**/*.gc.spec.ts` execute — `pnpm test` already does that, via the `gc` project, on the same default `forks` pool |
| `pnpm test:debug` | Vitest under `--inspect-brk`, one file at a time |
| `pnpm test:smoke` | Clears `smoke/build`, compiles `smoke/*.ts` (`tsc --project smoke/tsconfig.json`), then hard-fails if no `smoke/build/*.test.js` matched — a renamed test file or a stale leftover masking that — before `node --test` runs it; exact command in `package.json`. Runs (does not build the shipped artifact) `dist/`, type-checked against the `lib/*.d.ts`; plain Node, no Vitest |
| `pnpm smoke` | `pnpm dist` + `pnpm test:smoke` — builds first, then smoke-tests; the single-command entry point for a human or for iterating on `smoke/dist-smoke.test.ts` |
| `pnpm bench` | Vitest Bench over `bench/*.bench.ts`; informative in CI, no regression gate |
| `pnpm compile` | `run-s compile:js compile:types` — two `tsc` passes into `lib/` |
| `pnpm compile:js` | `tsc --project tsconfig.lib.json` → `lib/*.js` + `lib/*.js.map`, for Rollup |
| `pnpm compile:types` | `tsc --project tsconfig.types.json` → `lib/*.d.ts`, with JSDoc kept and `@internal` symbols stripped |
| `pnpm bundle` | rollup → `dist/index.js`, `dist/decorators.js` |
| `pnpm clean` | `rimraf build types tests dist lib coverage smoke/build` |
| `pnpm check` / `pnpm fix` | Biome lint+format plus the two guard scripts (`check:refs`, `check:banner`) — check only / Biome auto-fix |
| `pnpm lint` | Biome lint only |
| `pnpm format` / `pnpm format:write` | Biome format check / auto-fix |
| `pnpm checkPkgTypes` | `attw --pack --profile esm-only` — package types audit. The profile ignores `node10` and `node16 (from CJS)`, which cannot pass for an ESM-only package with a subpath export (no `exports`-map support / ESM served to a CJS resolver, respectively); `node16 (from ESM)` and `bundler` are still checked in full. Blocks in CI (`pnpm world`, `ci.yml`), not just documented |
| `pnpm dist` | clean + compile + bundle (no test) |

`package.json#files` is an allowlist, not a denylist — there is no `.npmignore`. What ships in the npm tarball: `dist/`, `lib/**/*.d.ts`, `docs/`, `skills/`, plus `README.md`, `CHANGELOG.md`, `LICENSE` and `package.json` — 48 files (2026-08-11). The **file count** is worth keeping here because it only moves when `package.json#files` itself changes; the **kB size** is deliberately not, because `docs/`, `skills/`, `README.md` and `CHANGELOG.md` all ship in the tarball and all get edited by ordinary documentation work — a throwaway ten-line addition to `README.md` alone moved the measured size by ~0.1-0.2 kB, so a number recorded here would already be stale by the next doc package (measured: package 29a's own edits moved it from 618.4/171.1 kB to 621.2/172.1 kB between two `npm pack --dry-run` runs taken hours apart). `npm pack --dry-run` is the way to check both against the current tree.

`pnpm compile` is two `tsc` passes, not one, because `removeComments` does not distinguish `.js` output from `.d.ts` output: turning it off to keep JSDoc in the declarations would also put it back into `lib/*.js`, which Rollup then carries into `dist/` — measured at ~110 kB more in `dist/*.js` for comments nobody reads there. `tsconfig.lib.json` (`compile:js`) stays `removeComments: true` and emits only JS plus its sourcemap; `tsconfig.types.json` (`compile:types`) is `emitDeclarationOnly`, keeps comments, and sets `stripInternal: true`.

**`@internal` is a compiler switch here, not a comment.** Since `pnpm compile:types` sets `stripInternal: true`, any JSDoc-tagged `@internal` symbol is cut from the published `.d.ts` — an `@internal` on a symbol a consumer is meant to see quietly removes it from autocomplete, and neither `attw` nor the test suite notices (measured 2026-08-09).

Any filtered run (`pnpm test <pattern>`, `pnpm test -t "<name>"`) ends with exit 1: the per-file coverage thresholds are evaluated against the files that did *not* run, so the gate always fails. Read the test result, not the exit code — it is not a test failure.

`.github/workflows/ci.yml` runs `pnpm check`, `pnpm typecheck`, `pnpm dist`, `pnpm test:smoke`, `pnpm checkPkgTypes`, `pnpm test`, `pnpm test:gc` and `pnpm bench` (the last one informative, non-blocking) — in that order, because `pnpm dist` starts with `clean`, which deletes `coverage/`, so every build step must run before `pnpm test` or the final coverage-summary step finds nothing to publish. `pnpm world` covers exactly the blocking steps (`check`, `typecheck`, `test:smoke`, `checkPkgTypes`, `test`, `test:gc`); `pnpm bench` is CI's informative step and has no local gate of its own. `pnpm cbt` additionally skips `check`, `typecheck`, `test:smoke`, `checkPkgTypes` and `test:gc`. Tooling is **Biome 2.x** (replaced ESLint + Prettier in v0.28) and **Vitest 4** (replaced Jest + ts-jest in v0.31). `ci.yml` runs the whole job as a matrix over Node 22 and Node 24 — the two ends of the range `engines.node` promises — with `fail-fast: false` so a version-specific failure stays visible; `pnpm bench` runs only on the Node 24 leg.

`ci.yml` triggers on push (except to `main`), on `pull_request` against `main`, and on `workflow_call`; `main.yml` calls `ci.yml` via `workflow_call`, so the deploy path runs the same steps.

The test transform runs through **SWC**, not Vite's built-in oxc pass: `vitest.config.ts` sets `oxc: false` and registers `unplugin-swc` with `decoratorVersion: '2022-03'`. oxc emits TC39 decorators verbatim, which Node cannot parse — without the plugin every decorator spec dies with `SyntaxError: Invalid or unexpected token`. Note also that TypeScript 7 ships no JS compiler API (`transpileModule` is gone), so ts-jest-style transformers are not an option.

### Deliberately not tested

No browser test run — no Playwright, no `@vitest/browser`, no jsdom/happy-dom, no browser job. Every job runs on `runs-on: ubuntu-latest` (`ci.yml`, `main.yml`); `ci.yml`'s `test` job runs as a matrix over two Node versions (`node-version: ['22', '24']`), both still Node, not a browser engine. `main.yml`'s `test` job is the `ci.yml` workflow itself, called via `workflow_call`; `vitest.config.ts` sets `environment: 'node'`. This is a decision, not a gap:

- **Why it holds:** `src/` uses no platform-dependent API. A `grep` across `src/*.ts` (specs excluded) for `node:`, `process.`, `Buffer`, `setTimeout`, `setInterval`, `queueMicrotask`, `structuredClone`, `globalThis` and `require(` turns up exactly one line of code: the multi-copy register `globalThis[$signalizeInstances]` in `src/instances.ts`. The `import.meta.url` beside it is not in the pattern list at all; both are plain ECMAScript with the same meaning in every engine. Everything else the expression finds is prose — among it `effects.ts` and `EffectImpl.ts` mention Node's unhandled-rejection behaviour in prose while explaining why an async effect's rejection is routed to `onEffectError()` instead of thrown; `SignalLink.ts` mentions "the whole process" while explaining why a link's self-reference goes through a `WeakRef` — a lifetime argument, not a rejection one. The only non-trivial runtime objects in use are `WeakRef` — in `SignalLink.ts` (`selfRef`), `SignalGroup.ts` (`allGroups`, `#storeKey`, `selfRef`, `siRef`), `SignalAutoMap.ts` (`#selfRef`) — and `FinalizationRegistry` — `gLinkFinalizer` in `link.ts`, `groupResourceFinalizer` and `groupFinalizationRegistry` in `SignalGroup.ts`, `signalFinalizer` in `signal-core.ts`, `autoMapResourceFinalizer` in `SignalAutoMap.ts` — plus `console.error` and `console.warn`, which live in one place: `signalize-error.ts` writes them as the fallback of `onSignalizeError()`, and `EffectImpl.ts` keeps one direct `console.error` for a handler that threw (reporting that on a handler channel would recurse) — all plain ECMAScript, identical across engines. Those two files are now the named exceptions of `suspicious/noConsole` in `biome.json`, so a third one cannot join them without failing `pnpm check`; the alias form the rule does not see (`const {warn} = console`) is caught by `src/message-prefix.spec.ts` instead.
- **Where the environment risk actually sits, and what already covers it:** in *resolution*, not *execution*. `attw --pack --profile esm-only` checks the `exports` map and shipped `.d.ts` in `bundler` mode — the resolution path a browser consumer actually takes — and `smoke/dist-smoke.test.ts` runs the built `dist/` for real. The TC39 decorator lowering that a browser's own bundler would perform is exercised by the smoke test's `tsc` pass, not by an engine.
- **Why a browser run wouldn't add coverage anyway:** the one thing that could behave differently across engines is GC timing around `WeakRef`/`FinalizationRegistry`, and all `src/**/*.gc.spec.ts` that exercise it depend on the `gc` project's `execArgv: ['--expose-gc']` in `vitest.config.ts`, a flag no portable browser harness provides. A browser smoke test would skip exactly the tests whose answer it could change.

What would overturn this: the first line in `src/` that touches a DOM or Node-only API, or a dedicated browser entry point in the `exports` map.

`docs/quickstart.md` and `skills/using-signalize/SKILL.md` both say the package runs in "a modern browser". That claim stands on the same argument as above and is unaffected by it — it asserts support, not a test run, and the two documents make no testing claim to begin with.

## Repo conventions

The canonical, short form of these rules — plus the ones on comments, error
messages and documentation that are not repeated here — is
[`docs/conventions.md`](./docs/conventions.md). That is the file to point a
contributor at. What follows is the same set with the measurements and the
edge cases attached.

- **Edit only `src/`.** `lib/` (tsc) and `dist/` (rollup) are generated artifacts.
- **Imports use `.js` extension** within `src/` (NodeNext resolution): `import {x} from './foo.js'` even when source is `foo.ts`. Required.
- **Test files**: `*.spec.ts` adjacent to implementation. Vitest matches `src/**/*.{spec,test}.ts`. Globals (`describe`, `it`, `expect`, `vi`) are enabled — no imports needed, except `import type {MockInstance} from 'vitest'` when you type a spy.
- **Filenames in `src/` are kebab-case; the class module is the exception.** A module whose carrying export is a class is named after that class, so PascalCase (`SignalGroup.ts`, `EffectImpl.ts`, `UniqIdGen.ts`). Everything else — functions, infrastructure, types, constants — is kebab-case (`create-signal.ts`, `global-effect-stack.ts`, `signal-core.ts`). The filename is not a transliteration of the export: `be-quiet.ts` exports `beQuiet()`, the hyphen sits where the camel hump was.
- **A spec file inherits its module's name** (`create-signal.spec.ts`, `SignalGroup.spec.ts`). The segments after the first dot name a symbol or a behaviour and keep that symbol's casing (`create-signal.beforeRead.spec.ts`, `effects.noAutorun.spec.ts`) — they are not module names. A spec with no module of its own is kebab-case throughout its head segment (`nested-effects-isolation.spec.ts`).
- **The rule applies to `src/`.** `rollup/` and `scripts/` sit outside it; their names are a separate decision and are not pulled in here.
- **`smoke/`** is the one exception: `smoke/dist-smoke.test.ts` runs on plain Node (`node --test`, via `pnpm test:smoke`), not Vitest, against the built `dist/`, type-checked against the `lib/*.d.ts`, not `src/`. It exists because every other spec is transformed by `unplugin-swc`, and SWC's `decoratorVersion: '2022-03'` is the one decorator lowering this library never ships — this is the only test where **tsc** lowers a `@signal() accessor` application, the way a consumer's own compiler would. It never runs under Vitest and never moves into `src/`.
- **No top-level side effects — with exactly two exceptions, and `sideEffects: false` is untrue because of them.** They differ in severity, so they are not interchangeable. The second one first, because it is the load-bearing one: the last line of `effects.ts`, `setCreateEffectHook(createEffect)`. Lose it and `Signal.onChange()` and the deprecated `signalReader(callback)` **throw** — the sentinel below only loses a warning. Measured 2026-08-11, freshly built, against `dist/index.js` with `treeshake: 'smallest'` and external eventize: a consumer bundle re-exporting only `createSignal` falls from 17 087 to 10 539 B minified (5 790 → 3 868 gzip), and `EffectImpl` is gone from it. **In `dist/` the line cannot be lost silently, and that is provable rather than hoped for:** the hook is the only edge between the two halves, so a bundler that drops the assignment has proven that nothing reads the variable — that `onChange()` is already gone. Executed, not weighed: a consumer bundle over `dist/index.js` that calls `onChange()` carries `EffectImpl` again and prints `[2,3]`, byte-identical in behaviour to the state before the change. **In the multi-module `lib/*.js` form the self-healing fails outright**, measured the same day, and it fails in the case that is supposed to be safe: bundle `lib/index.js` with `treeshake: 'smallest'` in a consumer that **calls** `onChange()`, and `effects.js` is still eliminated as a whole, the assignment with it — the call then throws `[signalize] effect subsystem not registered` at runtime. The bundler drops the registration without having proven that nobody reads it, because across module boundaries it eliminates `effects.js` for its unused *exports* and never sees that its last line is what makes the surviving call work. A plain `node` run against a deep `lib/create-signal.js` import throws too. That is folgenlos only because `lib/*.js` is never shipped: `exports` maps both subpaths to `dist/`, and `files` carries `lib/**/*.d.ts` alone. **So it is an obligation, not a note: point `exports` at `lib/` or add `lib/*.js` to `files`, and `Signal.onChange()` breaks in tree-shaken consumer bundles.** The repo's own `pnpm bundle` is the one tool that bundles `lib/*.js`, and it is safe for a different reason — its entry `lib/index.js` publishes `createEffect`, so `effects.js` is always retained. The first exception is the last line of `signalize-error.ts`, the multi-copy sentinel (`registerSignalizeInstance(import.meta.url, reportSignalizeError)`). Measured 2026-08-11, before adding a second one: Rollup keeps that call even under `treeshake: 'smallest'`, whose preset is `moduleSideEffects: () => false` — precisely what the flag grants a bundler — because an assignment to a `globalThis` member is an effect it never elides; a consumer bundle importing only `createSignal` goes from 43 214 to 44 191 B and carries the message text. Vite behaves the same. Measured the other way too: with `globalThis` made non-extensible up front — the SES `lockdown()` case — the `import` survives, every primitive works, and no register is created. What the sentinel actually hangs on: some used export has to reach `reportSignalizeError`, which `createSignal`, `createEffect`, `createMemo`, `link`, `SignalGroup` and `onSignalizeError` do. A consumer that uses none of them loses `signalize-error.js` and the sentinel with it — measured under the same `treeshake: 'smallest'` (and identically under a plain `moduleSideEffects: false`), that is **19 of the 33 public exports**, among them `isSignal`, `destroySignal`, `getSignalsCount`, `muteSignal`, `unmuteSignal`, `hibernate`, `onEffectError`, `onCreateEffect`, `onDestroyEffect`, `Effect`, the four `*ObjectSignal*` names, `batch`, `beQuiet`, `touch` and `value`. The cost in those bundles is a warning that will not appear — never a false alarm. So the flag stays as it is; changing it is a packaging decision with a wider radius than this line. The second top-level effect re-ran that measurement rather than inheriting its answer — that is the hook block above, and a third one owes the same.
- **Public API surface** must be wired through `src/index.ts` (default) or `src/decorators.ts` (subpath). Adding a file in `src/` does nothing for consumers without that wiring.
- **Subscription-leak verification**: tests touching subscribe/unsubscribe paths should snapshot `getSubscriptionCount()` and counters (`getSignalsCount/getEffectsCount/getLinksCount`) → run scenario → assert restored. See `unsubscribe-effect.spec.ts`.
- **Per-test teardown belongs in a `finally`**: in a file whose `beforeEach`/`afterEach` carry counter guards, every test tears its resources down in a `finally`, not behind the assertions — otherwise one real regression reaches the rest of the file through those guards and the finding drowns in collateral damage. Three rules make it work: arrange *before* the `try`, so every resource has a handle the `finally` can reach; a `destroy()` with an assertion after it is Act and stays in the `try`, where the `finally` only adds the idempotent belt; and a teardown that can throw goes into a `try { … } catch { /* ignore */ }` **inside** the `finally`, or it replaces the error message with its own. Template: `src/link.spec.ts`. Known property of the pattern: if a test fails while a `nextValue()` or iterator promise is still open, the teardown discards it and Vitest reports an unhandled rejection on top — that is a consequence of the teardown, not a second failure.
- **Counter guards cover all three resource kinds, by default**: a new spec file's `beforeEach`/`afterEach` carries `assertEffectsCount(0, …)`, `assertSignalsCount(0, …)` and `assertLinksCount(0, …)` together, in that order, not just the subset the first test happens to leak. A guard is owed to a resource kind the file can create *and* deterministically bring back to zero at test end — both, not one. Leave one out only with a comment saying why, at the `describe(` head or as the first block inside it: the file's whole subject is a GC-timed counter no `finally` can pin down (`src/signal-core.gc.spec.ts`, `src/SignalAutoMap.gc.spec.ts`), its object is a resource that must be *left* dangling to prove something (`src/link.gc.spec.ts`, dropped source signals), it creates nothing a counter could see (`src/global-queues.spec.ts`), or it tests the guards themselves and wiring one in would be circular (`src/__testing__/assert-helpers.spec.ts`).
- **Don't add `?:` defensively**: `strictNullChecks: false` is intentional. Existing code passes potentially-null values around freely.

## Common change patterns

| Change | Touch |
| --- | --- |
| New `Signal` method | `types.ts` interface → `SignalImpl` in `create-signal.ts` → `Signal.ts` wrapper → tests in adjacent `*.spec.ts` |
| New published type | `types.ts` → **add the name to the type-export list in `index.ts`** (it is a list, not a star — see "Public API") → a `@ts-expect-error` witness in `types.public-surface.spec.ts` if the type carries a promise no other test would catch |
| New published value | `src/<module>.ts` → **add the name to that module's export line in `index.ts`** (it is a list, not a star — see "Public API") → add the name to the list in `index.public-surface.spec.ts` |
| New effect option | `EffectOptions` in `EffectImpl.ts` → handle in constructor / `createEffect` → export the type from `src/index.ts` → document it in the Types table of `docs/api.md` → tests in `effects.spec.ts` (or new `effects.<feature>.spec.ts`) |
| New utility function | `src/<name>.ts` → re-export in `src/index.ts` → adjacent `<name>.spec.ts` |
| Modifying core reactivity | Read `EffectImpl.ts` (subscribe paths) + `signal-core.ts` (emit paths) + `global-queues.ts`; add subscription-count assertions to tests |

## Documentation surface

| Path | Purpose |
| --- | --- |
| `README.md` | User-facing entry — minimal example + links to `docs/` |
| `CONTRIBUTING.md` | Contributor process — setup, commands, pull requests, releasing |
| `docs/conventions.md` | The rules code has to follow — naming, imports, comments, tests, public surface. Canonical for contributors and coding agents |
| `docs/quickstart.md` | Install + 5-minute tour |
| `docs/architecture.md` | Concepts, reactivity flow, internals, source map, and the decision register |
| `docs/api.md` | Complete API reference with all options |
| `docs/recipes.md` | Patterns, quirks, gotchas |
| `docs/cheat-sheet.md` | One-page lookup |
| `skills/using-signalize/` | Agent skill for *consumers* — lean `SKILL.md` plus `references/{api,pitfalls,patterns}.md` loaded on demand |
| `CHANGELOG.md` | Version history + migration notes |

When the public API changes, sync in this order: source JSDoc → `docs/api.md` → `docs/recipes.md` (when a quirk/pattern is involved) → `docs/cheat-sheet.md` → `skills/using-signalize/` → `README.md` "API at a glance" → `CHANGELOG.md` "Unreleased".

For the skill, keep `SKILL.md` lean — it carries the mental model, the six silently-wrong behaviours, and the pointer table. New API detail belongs in `references/api.md`, new quirks in `references/pitfalls.md`, new idioms in `references/patterns.md`. A quirk graduates into `SKILL.md` only when it is both common and silent.

Older doc filenames (`introduction.md`, `guide.md`, `full-api.md`) were superseded — do not recreate them.
