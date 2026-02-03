# Project Context: @spearwolf/signalize

This document provides a comprehensive overview of the `@spearwolf/signalize` project for AI-assisted development.

## Overview

`@spearwolf/signalize` is a lightweight, standalone JavaScript/TypeScript library for signal-based reactivity.

- **Framework agnostic** - no dependencies on React, Vue, Angular, etc.
- **TypeScript-first** - written in TypeScript v5, targets ES2023
- **Peer dependency** - requires `@spearwolf/eventize ^4.0.2` for event-driven internals

## Core Concepts

| Concept          | Description                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| **Signals**      | Reactive values that notify dependents when changed. Created via `createSignal()`.                         |
| **Effects**      | Functions that auto-run when their signal dependencies change. Created via `createEffect()`.               |
| **Memos**        | Computed signals - cached derived values that update when dependencies change. Created via `createMemo()`. |
| **Links**        | Explicit one-way data flow connections between signals. Created via `link()`.                              |
| **SignalGroups** | Lifecycle management for collections of signals, effects, and links.                                       |

## Architecture Overview

### Event-Driven Communication (`@spearwolf/eventize`)

Signalize uses `@spearwolf/eventize` for all internal pub/sub communication. Unlike Node.js events, eventize is **synchronous** - subscribers are called immediately when events are emitted.

**Key eventize functions used in signalize:**

| Function                               | Usage                                                                |
| -------------------------------------- | -------------------------------------------------------------------- |
| `eventize(obj)`                        | Create event-enabled object (global queues, EffectImpl, SignalGroup) |
| `emit(obj, event, ...args)`            | Dispatch events (signal value changes, effect lifecycle)             |
| `on(obj, event, [priority,] callback)` | Subscribe to events with optional priority (higher = runs first)     |
| `once(obj, event, callback)`           | Subscribe to next event only (used for cleanup subscriptions)        |
| `off(obj, [listener])`                 | Unsubscribe from events (used in destroy methods)                    |

**Global Event Queues** (defined in `global-queues.ts`):

| Queue                      | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `globalSignalQueue`        | Signal value changes: `emit(queue, signalId, newValue)`       |
| `globalEffectQueue`        | Effect lifecycle: `$createEffect`, `$destroyEffect`, `RECALL` |
| `globalDestroySignalQueue` | Signal destruction events for cleanup                         |
| `globalEffectCalledQueue`  | Batch deduplication tracking                                  |

**Priority-based execution:**
Effects subscribe to signals with a priority number. Higher priority effects execute first.

- Memos default priority: `1000` (via `Priority.C` from eventize)
- Effects default priority: `0`

**Example - How an effect subscribes to a signal** (from `EffectImpl.ts`):

```typescript
// Effect subscribes to signal changes with priority
on(globalSignalQueue, signalId, this.priority, RECALL, this);
// Effect subscribes to signal destruction (once, for cleanup)
once(globalDestroySignalQueue, signalId, $destroySignal, this);
```

**Example - How a signal notifies effects** (from `createSignal.ts`):

```typescript
// When signal value changes
emit(globalSignalQueue, this.id, newValue);
```

### Key Symbols (from `constants.ts`)

| Symbol           | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| `$signal`        | Access internal `SignalImpl` from `Signal` wrapper |
| `$effect`        | Access internal `EffectImpl` from `Effect` wrapper |
| `RECALL`         | Event name to trigger effect re-execution          |
| `$createEffect`  | Lifecycle event when effect is created             |
| `$destroyEffect` | Lifecycle event when effect is destroyed           |
| `$destroySignal` | Event when signal is destroyed (for cleanup)       |

### Dependency Tracking Flow

```
1. Effect calls run()
2. Effect pushes itself onto globalEffectStack
3. Effect executes its callback function
4. Signal.get() is called inside callback
5. Signal calls getCurrentEffect()?.whenSignalIsRead(signalId)
6. Effect subscribes: on(globalSignalQueue, signalId, priority, RECALL, this)
7. Later: Signal value changes
8. Signal emits: emit(globalSignalQueue, signalId, newValue)
9. Effect's RECALL handler is triggered
10. Effect re-runs (goto step 1)
```

### Batch Processing

The `batch()` function defers effect execution until the batch completes:

1. `batch(callback)` creates a `Batch` instance as current context
2. During batch, `effect.run()` stores effect in priority-ordered queue instead of executing
3. When batch ends, all queued effects run once (duplicates skipped)

## Source File Map

| File                   | Responsibility                                                            |
| ---------------------- | ------------------------------------------------------------------------- |
| `index.ts`             | Public API exports                                                        |
| `constants.ts`         | Symbols (`$signal`, `$effect`, `RECALL`, etc.)                            |
| `types.ts`             | TypeScript interfaces and type definitions                                |
| `Signal.ts`            | `Signal` class - public wrapper around SignalImpl                         |
| `createSignal.ts`      | `SignalImpl` class, `createSignal()`, `destroySignal()`, `isSignal()`     |
| `Effect.ts`            | `Effect` class - public wrapper around EffectImpl                         |
| `EffectImpl.ts`        | Core effect implementation with dependency tracking                       |
| `effects.ts`           | `createEffect()`, `onCreateEffect()`, `onDestroyEffect()`                 |
| `createMemo.ts`        | `createMemo()` - combines signal + effect                                 |
| `link.ts`              | `link()`, `unlink()`, `getLinksCount()`                                   |
| `SignalLink.ts`        | `SignalLink` abstract class, `SignalLinkToSignal`, `SignalLinkToCallback` |
| `SignalGroup.ts`       | `SignalGroup` class for lifecycle management                              |
| `SignalAutoMap.ts`     | `SignalAutoMap` class - auto-creating signal map                          |
| `globalEffectStack.ts` | Effect execution context stack                                            |
| `global-queues.ts`     | Four global event buses                                                   |
| `batch.ts`             | `batch()` function and `Batch` class                                      |
| `bequiet.ts`           | `beQuiet()`, `isQuiet()` - suppress effect triggering                     |
| `hibernate.ts`         | `hibernate()` - suspend all context states                                |
| `touch.ts`             | `touch()` - force signal update notification                              |
| `value.ts`             | `value()` - non-tracking signal read                                      |
| `object-signals.ts`    | Object-attached signal storage utilities                                  |
| `decorators.ts`        | `@signal`, `@memo` TC39 decorators                                        |
| `UniqIdGen.ts`         | Unique ID generator (creates `Symbol('si1')`, `Symbol('ef1')`, etc.)      |

## Public API Quick Reference

**Signals:**
`createSignal`, `destroySignal`, `isSignal`, `getSignalsCount`, `muteSignal`, `unmuteSignal`, `touch`, `value`

**Effects:**
`createEffect`, `getEffectsCount`, `onCreateEffect`, `onDestroyEffect`

**Memos:**
`createMemo`

**Links:**
`link`, `unlink`, `getLinksCount`

**Groups:**
`SignalGroup`, `SignalAutoMap`

**Utilities:**
`batch`, `beQuiet`, `isQuiet`, `hibernate`

**Decorators** (import from `@spearwolf/signalize/decorators`):
`@signal`, `@memo`

**Classes:**
`Signal`, `Effect`, `SignalGroup`, `SignalAutoMap`

## Development Workflow

| Command        | Description                                  |
| -------------- | -------------------------------------------- |
| `pnpm cbt`     | **Primary command** - clean + compile + test |
| `pnpm test`    | Run tests only (Jest via ts-jest)            |
| `pnpm lint`    | Run ESLint                                   |
| `pnpm compile` | TypeScript compilation only                  |
| `pnpm clean`   | Remove build artifacts                       |

Always run `pnpm cbt` after making changes to ensure build, linting, and tests pass.

## Common Development Patterns

### Adding a new Signal method

1. Add method signature to `types.ts` (if interface-based)
2. Implement in `SignalImpl` class in `createSignal.ts`
3. Expose via `Signal` class in `Signal.ts`
4. Export from `index.ts` if standalone function
5. Add tests in `createSignal.spec.ts`

### Adding a new Effect option

1. Update `EffectOptions` interface in `EffectImpl.ts`
2. Handle option in `EffectImpl.constructor()` or `createEffect()`
3. Implement logic in `EffectImpl` class
4. Add tests in `effects.spec.ts`

### Adding a new utility function

1. Create new file `src/myutil.ts`
2. Export from `src/index.ts`
3. Create `src/myutil.spec.ts` with tests
4. Run `pnpm cbt`

### Modifying event-based communication

1. Understand the four global queues in `global-queues.ts`
2. Check how `EffectImpl.ts` subscribes/unsubscribes
3. Check how `createSignal.ts` emits value changes
4. Use `getSubscriptionCount()` from eventize in tests to verify cleanup

## Testing Conventions

- **Test files:** `*.spec.ts` adjacent to implementation files
- **Framework:** Jest (via ts-jest)
- **Helper:** `assert-helpers.ts` provides `getSubscriptionCount()` for subscription leak detection
- **Pattern:** Each public function should have corresponding tests
- **Run:** `pnpm test` or `pnpm cbt`

## Contribution Guidelines

- **Coding Style:** Follow existing patterns; ESLint enforces rules
- **Testing:** Every new feature or bug fix MUST have tests
- **Documentation:** Update `README.md` for API changes, `CHANGELOG.md` for notable changes
- **Commits:** Clear, concise messages explaining the "why"

## Documentation Structure

The documentation is organized in multiple locations that must be kept in sync when making changes to the source code or public API.

### Documentation Locations

| Location          | Purpose                                                 | Update When                                     |
| ----------------- | ------------------------------------------------------- | ----------------------------------------------- |
| `README.md`       | Brief introduction, quick start, links to detailed docs | Major API changes, new core concepts            |
| `docs/`           | Comprehensive user documentation                        | Any API changes, new features, behavior changes |
| `skills/`         | AI agent quick-reference guides                         | API signature changes, new functions/classes    |
| `src/*.ts`        | JSDoc comments in source code                           | Any code changes to public API                  |
| `CHANGELOG.md`    | Version history and migration guides                    | Every release, breaking changes                 |
| `CONTRIBUTING.md` | Developer setup and contribution guidelines             | Build process or workflow changes               |

### docs/ Folder Structure

| File              | Content                                            |
| ----------------- | -------------------------------------------------- |
| `introduction.md` | Library overview, core concepts, design philosophy |
| `quickstart.md`   | Installation, basic usage examples                 |
| `guide.md`        | Comprehensive tutorial with all features           |
| `full-api.md`     | Complete API reference with all options            |
| `cheat-sheet.md`  | Quick reference for common patterns                |

### skills/ Folder Structure

Agent skills provide focused, quick-reference documentation for AI assistants:

| Skill                   | Covers                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `signalize-signals/`    | `createSignal`, `destroySignal`, `isSignal`, `muteSignal`, `unmuteSignal`, `Signal` class |
| `signalize-effects/`    | `createEffect`, `getEffectsCount`, `onCreateEffect`, `onDestroyEffect`, `Effect` class    |
| `signalize-memos/`      | `createMemo` and computed signals                                                         |
| `signalize-links/`      | `link`, `unlink`, `getLinksCount`, `SignalLink` class                                     |
| `signalize-groups/`     | `SignalGroup`, `SignalAutoMap` classes                                                    |
| `signalize-utilities/`  | `batch`, `beQuiet`, `isQuiet`, `hibernate`, `touch`, `value`                              |
| `signalize-decorators/` | `@signal`, `@memo` decorators (EXPERIMENTAL)                                              |
| `signalize-testing/`    | Testing patterns, `getSignalsCount`, `getEffectsCount`, `getLinksCount`                   |

### Documentation Update Checklist

When modifying the public API, update documentation in this order:

1. **Source Code JSDoc** (`src/*.ts`)
   - Add/update JSDoc comments for all public functions, classes, and interfaces
   - Include `@param` and `@returns` tags

2. **Full API Reference** (`docs/full-api.md`)
   - Document all parameters, options, and return types
   - Include code examples for new features

3. **Guide** (`docs/guide.md`)
   - Add usage examples for new features
   - Update existing examples if behavior changes

4. **Skills** (`skills/*/SKILL.md`)
   - Update relevant skill files with new API signatures
   - Keep examples concise and focused

5. **README.md**
   - Update "API at a Glance" section if new exports are added
   - Update quick start if core usage patterns change

6. **CHANGELOG.md**
   - Document all changes for the next release
   - Include migration guides for breaking changes

### Documentation Style Guidelines

- **Code examples:** Use TypeScript, keep examples minimal and focused
- **Consistency:** Match existing terminology and formatting
- **Accuracy:** All code examples must be runnable and correct
- **Completeness:** Document all public API options and parameters
- **Cross-references:** Link between related documentation sections

## Agent Instructions

1. **Context:** Read `README.md` to understand the library's purpose and public API
2. **Navigation:** Start from `src/index.ts` to see exports, then explore specific files
3. **Eventize:** Understand the `@spearwolf/eventize` pub/sub pattern before modifying core reactivity
4. **Modification:** Only modify files in `src/`. Never modify `lib/` or `node_modules/`
5. **Verification:** Always run `pnpm cbt` after changes
6. **Testing:** Write tests for any new functionality
