# AGENTS.md — `@spearwolf/signalize`

Architecture and conventions reference for AI coding agents. For Claude Code-specific operational guidance see `CLAUDE.md`. For human contributor docs see `CONTRIBUTING.md`.

## What it is

Framework-agnostic signal/effect/memo/link library. Synchronous reactivity. Built on `@spearwolf/eventize` for all internal pub/sub.

- Runtime: ESM-only, Node `>=24.13`, targets ES2023, `sideEffects: false`
- TypeScript v5, `strict: true` **but `strictNullChecks: false`** (intentional — don't "fix" it)
- Peer dep: `@spearwolf/eventize ^4.0.2`
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
| `$destroySignal` | Signal destruction event |

### Priorities

Effects subscribe to signals with a numeric priority — **higher runs first**.

- Memos: `Priority.C` = 1000 (`createMemo.ts:59`)
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
| `decorators.ts` | `@signal`, `@memo` (TC39 standard decorators) — separate `./decorators` entry |
| `constants.ts` | Symbols (`$signal`, `$effect`, `RECALL`, `$createEffect`, `$destroyEffect`, `$destroySignal`) |
| `types.ts` | Public TypeScript interfaces |
| `Signal.ts` | `Signal<T>` class — thin wrapper around `SignalImpl` |
| `createSignal.ts` | `SignalImpl`, `createSignal`, `destroySignal`, `isSignal`, `muteSignal`, `unmuteSignal`, `getSignalsCount`, internal `writeSignal`, `signalImpl` |
| `Effect.ts` | `Effect` class — wrapper around `EffectImpl` |
| `EffectImpl.ts` | Core dependency tracking + rerun logic; `EffectOptions` interface |
| `effects.ts` | `createEffect`, `getEffectsCount`, `onCreateEffect`, `onDestroyEffect` |
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
| `assert-helpers.ts` | **Test-only**: `getSubscriptionCount(queue, event?)` for leak assertions |

## Public API (what `index.ts` re-exports)

**Signals**: `createSignal`, `destroySignal`, `isSignal`, `getSignalsCount`, `muteSignal`, `unmuteSignal`, `touch`, `value`
**Effects**: `createEffect`, `getEffectsCount`, `onCreateEffect`, `onDestroyEffect`
**Memos**: `createMemo`, `CreateMemoOptions`
**Links**: `link`, `unlink`, `getLinksCount`, `SignalLink` (type), `ValueCallback`
**Object Signals**: `destroyObjectSignals`, `findObjectSignalByName`, `findObjectSignalNames`, `findObjectSignals`
**Groups**: `SignalGroup`, `SignalAutoMap`, `SignalAutoMapKeyType`
**Utilities**: `batch`, `beQuiet`, `isQuiet`, `hibernate`
**Classes**: `Signal`, `Effect`, `SignalGroup`, `SignalAutoMap`
**Types**: everything from `types.ts`

**Subpath `@spearwolf/signalize/decorators`** (`src/decorators.ts`): `signal`, `memo`, `SignalDecoratorOptions`, `SignalReaderDecoratorOptions`, `MemoDecoratorOptions`. Decorators are TC39 standard (no `experimentalDecorators`); use the `accessor` keyword.

## Development workflow

### Commands (`package.json`)

| Command | Runs |
| --- | --- |
| `pnpm cbt` | `clean + compile + bundle + test` — local "done" gate |
| `pnpm world` | `clean + lint + prettier:check + compile + bundle + test` — pre-release / matches CI scope |
| `pnpm test` | Jest (ts-jest ESM); roots = `src/` |
| `pnpm test -- <pattern>` | single spec, e.g. `pnpm test -- createSignal.spec.ts` |
| `pnpm test -- -t "<name>"` | filter by test name |
| `pnpm compile` | `tsc --project tsconfig.lib.json` → `lib/` (types + sourcemaps) |
| `pnpm bundle` | rollup → `dist/index.js`, `dist/decorators.js` |
| `pnpm clean` | `rimraf build types tests dist lib` |
| `pnpm lint` / `pnpm fix` | ESLint / lint:fix + prettier:write |
| `pnpm prettier:check` | format check (CI runs this) |
| `pnpm checkPkgTypes` | `attw --pack` package types audit |
| `pnpm dist` | clean + compile + bundle (no test) |

### CI vs local

`.github/workflows/ci.yml` runs `pnpm lint && pnpm prettier:check && pnpm test` — **not** `pnpm cbt`. To match CI locally use `pnpm world`. `pnpm cbt` skips `lint` and `prettier:check`.

## Repo conventions

- **Edit only `src/`.** `lib/` (tsc) and `dist/` (rollup) are generated artifacts.
- **Imports use `.js` extension** within `src/` (NodeNext resolution): `import {x} from './foo.js'` even when source is `foo.ts`. Required.
- **Test files**: `*.spec.ts` adjacent to implementation. Jest config matches `**/?(*.)+(spec|test).[tj]s` rooted at `src/`.
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
| Modifying core reactivity | Read `EffectImpl.ts` (subscribe paths) + `createSignal.ts` (emit paths) + `global-queues.ts`; add subscription-count assertions to tests |

## Documentation surface

| Path | Purpose |
| --- | --- |
| `README.md` | User-facing entry — quick start, API at a glance |
| `docs/introduction.md` | Library overview, design philosophy |
| `docs/quickstart.md` | Install + basic usage |
| `docs/guide.md` | Comprehensive tutorial |
| `docs/full-api.md` | Complete API reference with options |
| `docs/cheat-sheet.md` | Quick reference patterns |
| `CHANGELOG.md` | Version history + migration notes |
| `TODO.md` | Active working backlog (updated frequently) |

When the public API changes, sync in this order: source JSDoc → `docs/full-api.md` → `docs/guide.md` → `README.md` "API at a Glance" → `CHANGELOG.md` "Unreleased". A previous top-level `skills/` folder was removed (commit `f08fb05`); ignore any stale references.
