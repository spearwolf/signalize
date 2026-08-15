# CHANGELOG

Which of these changes you may rely on depends on the version they ship in —
see [Versioning & stability](./README.md#versioning--stability). Entries under
`## Unreleased` have not shipped in any version yet.

## Unreleased

The `1.0.0` release — the first to carry a compatibility promise. Upgrading from `0.x`:
the repair for every breaking change below, with the reasoning, is in
`skills/using-signalize/references/migration-v1.md`.

### Breaking Changes

- Internal `Symbol.for` keys moved into a `@spearwolf/signalize/` namespace. A process holding one pre-`1.0` and one `1.0` copy shares nothing — upgrade every copy together
- Removed the `@memo` decorator and `MemoDecoratorOptions`; a class-bound memo is a field, `foo = createMemo(() => …, {attach: this})`. `createMemo()` itself is unchanged
- `package.json` no longer carries `main`, `module` or `types` — the `exports` map is the package's sole entry-point declaration, so a resolver without `exports` support no longer finds the package at all
- `ISignalImpl` is no longer exported, and `SignalLink#source` is a read-only `LinkSource<T>`: a link is a one-way read connection, not a second way to drive its source
- Every error message this library authors begins with `[signalize] `, and the recursion guard's message names `setMaxEffectDepth(n)`
- Teardown and delivery run to the end and collect what fails: from two failures on, an `AggregateError` in delivery or teardown order instead of the first error alone. Covers signal writes, `destroySignal()`, `Effect.destroy()`, `unlink()`, `SignalGroup#clear()`/`#off()` and the static `SignalGroup.clear()`, `SignalAutoMap#clear()`, `destroyObjectSignals()`, `batch()`, `hibernate()`, and a failed creation whose rollback fails on top. A single failure is unchanged
- `batch()`, `beQuiet()` and `hibernate()` refuse an `async`/thenable-returning callback — a `tsc` error, and a `TypeError` at runtime for an untyped caller. Such a callback left the frame at its first `await` and every write after it ran unbatched, tracked and loud
- `createMemo()` no longer wraps its recompute write in `batch()`. Only matters when the callback writes to *other* signals: pass `{batchWrites: true}` to restore the grouping
- `SignalGroup.attachSignalByName()` gives the name ownership of the signal — rebinding the name, or passing `undefined`, destroys the signal it displaces. `clear()` no longer destroys the pile such a name used to accumulate
- `SignalGroup#attachEffect()` throws on an already-destroyed effect, the rule `attachSignal()` and `attachLink()` already applied; it takes the `Effect` that `createEffect()` returns and hands the argument back with its own type, and an attached effect leaves its group on `destroy()` instead of at the next `clear()`
- The callbacks of `onCreateEffect()`/`onDestroyEffect()` are typed `(effect: FailingEffect) => void`; the eventize-native subscribe forms are no longer part of the contract, and priority is the second argument
- That `FailingEffect` carries prototype methods instead of bound ones — `const {destroy} = effect; destroy()` throws — and `childEffects` is private. The `Effect` from `createEffect()` is untouched
- `getSignalsCount()` counts reachable signals instead of created ones, corrected by the garbage collector at a moment that cannot be observed or forced. A leak assertion reading it once can see a stale, too-high number
- `asyncValues()` waits for the next propagation instead of settling on the retained value, and gives the link's `'value'` retain policy back when the last iterator stops — taking a caller's own `retain()` with it. `nextValue()` on its own is unchanged
- `touch()`, `value()` and `unlink()` throw on a non-signal argument instead of answering silently; all three already refused it at `tsc` time, so only untyped JavaScript reaches this
- Types only, no runtime change: type-parameter defaults are `unknown` instead of `any`, and the group and automap lookups hand out `Signal<unknown>`; `{lazy: true}` is required for a factory and refused for a value, on both `createSignal()` and `set()`, whose params types are named exactly now; `createSignal<T>()` without an initial value is `Signal<T | undefined>`; `link()` is an overload pair, so its callback parameter infers; `Signal#onChange()` takes a `ValueChangedCallback<T>` and refuses an `async` callback; `SignalAutoMap`'s key types drop `any`

### Features

- New `onSignalizeError(cb, priority?)`: one channel for every diagnostic with no caller to throw at — finalizer errors, deprecation notices, the 1000-links threshold, a second copy of the library, an option that does nothing in the combination it was passed. The handler receives `{level, source, message, error?}`; give a `switch` over `source` a `default`, new members may appear in a minor release. Without a handler the messages stay verbatim on `console.warn`/`console.error`; with one, the handler owns them
- New `onEffectError(cb, priority?)`: rejections of `async` effect and cleanup callbacks, which cannot be thrown at a caller. The handler receives `{error, effect, effectId, phase}`
- New `setMaxEffectDepth(n)` / `getMaxEffectDepth()` make the recursion cap reachable for the first time — the `EffectImpl.maxDepth` six documentation sites recommended never was
- New `Signal#destroyed` and `Effect#destroyed` getters; `SignalLink` keeps its `isDestroyed` spelling
- New `SignalAutoMap#delete(key)` destroys that key's signal and removes the entry; previously only `clear()` could tear anything down
- New `createMemo(fn, {batchWrites})` (default `false`) restores the batching of the recompute write, see the Breaking Changes entry
- `SignalLink#nextValue()` and `#asyncValues()` take an optional `{signal}` (`AbortSignal`)
- `link()` warns once per source signal as soon as 1000 links hang off it, naming the four teardown routes and `getLinksCount(source)`. Nothing is thrown and no link is refused
- The five options and deps types of `createEffect()` are importable — `docs/api.md` listed `EffectOptions` as exported while `import type` failed with `TS2305`
- `attachSignal()`, `detachSignal()`, `attachSignalByName()`, `attachLink()` and `detachLink()` return the argument's own type instead of flattening it, so `group.attachSignal(createSignal(1)).value` stays `number`

### Bug Fixes

#### Effects and memos

- A rejecting `async` effect or cleanup callback no longer becomes an unhandled rejection, which has ended the process by default since Node 15. It goes to `onEffectError()`, or to `console.error` while no handler is registered
- The cleanup an `async` callback resolves to is never lost: a superseded or destroyed run's cleanup runs as soon as its promise settles, rather than being stored where nothing would call it
- Effects created inside another effect's callback are child effects of it — under static `dependencies` too, and including the effects behind `Signal#onChange()` and `createMemo()`. Every parent rerun used to orphan another live effect on the global queue
- `createMemo()` in an effect body no longer leaves a signal behind on every rerun — named or unnamed, attached or not. It now dies with the effect that created it
- A failed creation is taken back: `createEffect()` or `createMemo()` whose first run throws, or whose `onCreateEffect()` handler throws, no longer leaves a counted, subscribed effect nobody can reach — nor, for a memo, an unreachable signal. An effect with `{attach}` is exempt, the group holds it
- Effect teardown is complete and isolated: `destroy()` unsubscribes before the cleanup runs, marks the effect destroyed before it notifies, is a no-op on re-entry, and finishes all four steps even when a cleanup, a `DESTROY` listener or an `onDestroyEffect()` handler throws. A child's failing cleanup no longer leaves its siblings alive as zombies
- An effect no longer destroys itself mid-run while its dependencies are being rebuilt — the "nothing can trigger me anymore" verdict is postponed to the end of the outermost run. An effect whose only dependencies are memos it creates itself keeps firing; one whose dependencies really are all gone still dies, one run later
- An effect that destroys itself inside its own callback subscribes to nothing afterwards and keeps the cleanup that callback returns. Those late subscriptions used to be unremovable, pinning the effect and its closure on the global queues forever
- An effect that becomes untriggerable is destroyed regardless of the order its dependencies stopped tracking it, and a destroyed dependency is skipped whenever the declared set is subscribed
- Dependency handling: an unresolvable string/symbol dependency throws naming it instead of an opaque `TypeError`; a callback that throws before its first read keeps its dependency set instead of committing the empty one it never built; one that throws after reading still unsubscribes what it stopped reading; and a static-deps effect that survived a `SignalGroup.off()` hears the detached signal again from its next run
- A throwing effect callback no longer ends the delivery of a signal write or of `destroySignal()`. Every subscribed effect runs, in priority order; only effects are isolated this way
- An effect that writes a signal it depends on runs the cleanup of **every** nested run instead of storing only the oldest, and a superseded cleanup that throws goes to `onEffectError()` with `phase: 'cleanup'`
- An effect run inside `beQuiet()` keeps its dependencies instead of going permanently deaf. This hit the `{autorun: false}` pattern, where the owner wraps its own `run()` in a quiet frame
- An effect created inside another effect's callback whose own first run throws is destroyed with that failed creation, instead of surviving as a child and rerunning on the next write
- `createEffect(callback, dependencies, options)` no longer writes `dependencies` into the caller's `options` object, so a reused options object no longer leaks the previous call's deps
- An effect callback returning something other than a function no longer throws `TypeError: cleanupCallback is not a function` on the next run — the value counts as "no cleanup"
- A memo's internal effect unsubscribes from the global destroy queue when it dies before its signal does, instead of holding the dead effect and its closure for the remaining process lifetime
- Options that do nothing are reported through `onSignalizeError()` with `source: 'ignored-option'` instead of being dropped in silence: `createMemo(fn, {name})` without `{attach}` — a name is a slot inside a `SignalGroup` — and `createSignal(existingSignal, params)`, where the passthrough creates no signal for `params` to configure

#### Links

- `link()` refuses a non-signal source before touching its registry. It used to insert an entry keyed by `undefined` and then fail with an opaque `TypeError`, leaving that entry behind
- `link(source, target, {attach})` for a pair that already has a link attaches the existing link to the new group too, instead of dropping `attach`; attaching the same group twice is idempotent and no longer grows the link's listener count without bound
- Links are held weakly throughout: the registry keys on the source via `WeakMap`, the subscriptions on the global queues go through `WeakRef`, and a link that becomes unreachable together with its source is reclaimed *and* releases those subscriptions. Measured before the fix: 10 000 dropped pairs left 10 000 entries on each queue and ~2.2 KB of heap per pair while `getLinksCount()` reported 0
- `SignalLink.destroy()` releases every subscription it took — they used to dangle on the permanent module-level queues — finishes the teardown even when one of its steps throws, and hits its own guard on a re-entrant call from a `'destroy'` listener instead of recursing until the stack overflows
- A link callback that destroys its own link mid-propagation no longer throws `TypeError: Cannot assign to read only property 'lastValue'` out of the `set()` that started the delivery, and the remaining links on that source are still served
- A propagation overtaken by a feedback write no longer appends its stale value afterwards, so a `nextValue()`/`asyncValues()` consumer never sees a regression to an older value
- `asyncValues()`: a `for await` without a `stopAction` terminates — it used to spin as a microtask hot loop that starved every timer in the process (measured: 500 000 iterations of one value, not a single macrotask getting through). Iterators no longer see the same value twice, several can run over one link at once, `.return()`/`.throw()` settle while a read is pending, and `{signal}` throws the abort reason out of the loop while a `destroy()` still ends it quietly
- `nextValue()` on an already-destroyed link rejects with `Error('[signalize] SignalLink destroyed before the next value arrived')` instead of hanging forever, and it rejects with that same error — rather than with `undefined` — when the link is destroyed while the call is pending. With `{signal}` it no longer leaks the caller's abort listener on the retained-replay path, where every call after the first used to leak one more, unbounded
- `unlink(source)` tears down every link even when an earlier one's `DESTROY` listener throws, and names an argument it does not recognise instead of answering a typo with a successful-looking teardown

#### SignalGroup

- `attachGroup()` rejects an edge that would close a cycle, and the five graph walks refuse to re-enter a walk they are already inside. Such a cycle used to send `hasSignal()`, `signal()`, `runEffects()`, `off()` and `clear()` into unbounded recursion
- A group is held weakly by all three of its module-level roots, so a host whose only back-reference is a signal value — the `@signal() accessor self = this` shape — is collected together with its group, and that group releases its destroy-queue subscriptions on the way out (measured: 1000 of 1000 hosts survived a `gc()` before, 0 of 1000 after; 2000 listeners → 0). An attached effect whose callback closure captures the host still blocks it, because every live effect is reachable from the global effect queue. A group collected this way has not run `clear()`: no `DESTROY` event, and its signals are collected rather than destroyed
- A destroyed signal, effect or link takes itself out of the group that holds it, at `Priority.Max` so a throwing listener cannot stop it. A long-lived group with churn used to accumulate every dead `EffectImpl` — closure included — and every destroyed signal until the next `clear()`
- Destroying a signal attached by name also releases the name; a remaining candidate takes the slot over. This is the path the `@signal` decorator takes
- `clear()`, `off()` and `detachSignal()` run the whole teardown even when a cleanup, a listener or an unsubscribe throws, and take their bookkeeping out of every register in a `finally`. The static `SignalGroup.clear()` sweeps every registered group instead of aborting at the first failure, and no longer loses a group created *during* the sweep
- `SignalGroup.delete(group)` clears the group it is handed instead of doing nothing. A group made by `findOrCreate(host)` is filed under `host`, so the lookup found nothing — the documented public destructor was a silent no-op for exactly the argument `get()` and `findOrCreate()` accept
- A teardown that throws from the `FinalizationRegistry` callback is reported through the diagnostics channel instead of taking the process down; a registry callback has no caller left to hand it to

#### Batching and frames

- `batch()` no longer loses the error its callback threw when a delayed effect fails in the flush afterwards — both arrive as an `AggregateError`, callback error first
- `hibernate()` restores the batch, the quiet counter and the effect stack even when the flush of the saved batch throws, and still runs its callback. The process used to be left with all three cleared in the middle of open frames, silently and for the rest of its life
- A batch flushed by `hibernate()` empties its queue even when an effect in it throws. The restored batch used to recall every delayed effect a second time when it closed — one write, two runs, the same failure reported at two different callers
- `effect.run()` inside an open `batch()` is no longer dropped for an `{autorun: false}` effect; the request is carried through to the flush
- Reading a memo inside a `batch()` returns its current value instead of the pre-batch one — a memo whose dependency was written in the same batch read stale, and one *created* in the batch read `undefined`. A memo reading both a batched signal and another memo now recomputes twice per batch when read inside it; values and downstream effect runs are unchanged

#### Signals and SignalAutoMap

- `getSignalsCount()` corrects itself through a `FinalizationRegistry` when a signal is dropped rather than destroyed (measured: 2000 dropped signals took the count from 2000 to 0, where it used to stay at 2000 for the lifetime of the process)
- `SignalAutoMap` evicts an entry whose signal was destroyed from the outside instead of caching the corpse — `has(key)` is `false` in the same turn and `get(key)` creates a fresh one (measured: 1000 dead keys → 0). A soft detach via `SignalGroup#off()` is not a destruction and leaves the entry alone
- A `SignalAutoMap` dropped without `clear()` releases its per-entry destroy-queue subscriptions itself and stays collectible (measured: 400 subscriptions → 0)
- `SignalAutoMap.fromProps(obj, propKeys)` deduplicates `propKeys`; a repeated key used to create a second signal that silently displaced the first without destroying it
- `Signal#onChange(cb)` hands its callback the tracked read, so a `beforeRead` hook fires for it and a `{lazy: true}` memo recomputes before the callback sees the value. On such a memo the callback can run twice per notification, both times with the fresh value

### Performance

- A signal write with ten dependent effects runs about a third faster — 373,783 → 510,935 ops/s
- A `batch()` whose writes reached no effect skips the flush entirely: 629 ns → 50 ns
- `{batchWrites: true}` no longer costs a memo without a dependent effect anything worth measuring: 756,036 → 2,244,935 ops/s, within 5 % of the default
- A reported effect failure no longer scans every subscribed event name of the global effect queue: 15,96 µs → 0,013 µs at 8000 live effects, about 78 % less time end-to-end for a write-then-report cycle
- An empty `SignalGroup` retains 1081 instead of 2513 bytes, and an `EffectImpl` 232 fewer
- A bundle that only uses `createSignal` no longer carries the effect subsystem: 17 087 → 10 539 B minified (5 790 → 3 868 gzip). A bundle using the full surface pays +1,0 % for the indirection

### Documentation

- New `skills/using-signalize/references/migration-v1.md`: the repair for every breaking change of this release in one place, with the reasoning. The `## Unreleased` block links to it instead of carrying the detail
- New `docs/diamond-example.md` — the diamond problem in the terms of [Reactive algorithms](https://github.com/milomg/reactively/blob/main/Reactive-algorithms.md): why the equality check costs signalize nothing, why a converging effect runs once per path with the first run on a half-updated graph, what `batch()` fixes and what it does not, and the single-memo funnel that gives one run
- New `docs/conventions.md` — the canonical rules for writing code here, for contributors and coding agents alike; `docs/architecture.md` gained an "Architecture decisions" register of sixteen decisions in context → decision → consequence form
- `README.md` gained a "Versioning & stability" section: no compatibility promise below `1.0.0`, semver on the published surface from `1.0.0` on, everything `@internal` exempt at every version
- The JSDoc of every exported symbol was rewritten to what a caller needs — purpose, surprises, what it returns or throws — and it ships in the declarations, so this is what a consumer's editor tooltip shows. The measured edge cases and inference outcomes it used to spell out live in `docs/api.md`
- Documented what the `FinalizationRegistry` backstop of a `SignalGroup` cannot do (an attached effect capturing the host blocks reclamation; a collected group never runs `clear()`), the actual lifetime of a `SignalLink`, which functions refuse a non-signal argument and which stay silent, and that the `@signal` decorator's `attach` option names an *additional* group rather than overriding the instance group
- The three deprecated declarations carry an `@deprecated` tag: `SignalGroup.destroy()`, `SignalGroup#destroy` and the callback overload of `SignalReader`

### Build System

- The published tarball is an allowlist (`package.json#files`) instead of an `.npmignore` denylist — 125 files down to 48, and `lib/*.js`/`lib/*.js.map`, which no resolution path ever reached, are 25 % of what went
- The published `.d.ts` carry their JSDoc, and `@internal` symbols are stripped from them — implementation-layer members no longer reach autocomplete
- `nextValue()` and `asyncValues()` take an `AbortSignalLike`, so the types resolve for a consumer on plain `"lib": ["ES2023"]` without `@types/node`
- `engines.node` lowered from `>=24.13` to `>=22` — no construct in `src/` needs anything newer, and Node 22 stays in LTS until 2027
- `"./package.json": "./package.json"` added to the `exports` map, so reading the version at runtime no longer fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`
- `dist/` ships sourcemaps with the source embedded; `lib/` no longer ships a declaration map pointing at files the package does not contain
- Two builds of the same commit produce byte-identical output: the bundle banner's `@version` line no longer carries a build date and the copyright year is frozen
- A prerelease version publishes under its own npm dist-tag — `1.2.3-beta.1` reaches npm as `beta` and `latest` stays on the last stable release. `-dev` still skips publishing; an identifier outside `alpha`/`beta`/`rc`/`next`, and anything that is not semver, fails the job instead of guessing at a tag
- The `latest` tag only moves forward: a release older than the version it points at fails the release job instead of handing every plain `npm install` the older library

## `v0.31.1` (2026-07-25)

### Bug Fixes

- Importing `lib/EffectImpl.js` as the first module of the graph threw `ReferenceError: Cannot access 'EffectImpl' before initialization`. `effects.ts` read `EffectImpl.createEffect` at module-eval time across an import cycle; it now delegates through a function

### Chores

- New `src/signal-core.ts` holds the signal primitives (`isSignal`, `signalImpl`, `readSignal`, `writeSignal`, `destroySignal`, `muteSignal`, `unmuteSignal`, `getSignalsCount`) that previously sat in `createSignal.ts`. This removes all six import cycles rollup was warning about. Public API is unchanged — `index.ts` re-exports the same names
- `rollup.config.mjs` now fails the build on `CIRCULAR_DEPENDENCY` instead of warning

### Tests

- CI runs `pnpm test:gc` as its own step. The four `SignalGroup.gc.spec.ts` tests skip themselves under plain `pnpm test` (no `globalThis.gc` without `--expose-gc`), so until now they ran on no runner at all

## `v0.31.0` (2026-07-25)

### Build System

- Test runner: **Jest 30 → Vitest 4**. Drops `jest`, `ts-jest`, `@types/jest`, `jest-expect-message` and `cross-env` — Vitest supports `expect(value, 'message')` natively, resolves `./foo.js` → `foo.ts` without a module mapper, and sets `NODE_ENV=test` itself. Specs now use `vi.fn` / `vi.spyOn` / `MockInstance`
- Vitest transpiles through **SWC** (`unplugin-swc`, `decoratorVersion: '2022-03'`) with Vite's oxc pass disabled: oxc emits TC39 decorators verbatim and Node cannot parse them
- Coverage moves to `@vitest/coverage-v8`; the same thresholds (branches ≥ 85 %, functions ≥ 85 %, lines ≥ 95 %, statements ≥ 95 %) and the `coverage-summary.json` the CI summary reads are unchanged
- `pnpm test:gc` now runs the `SignalGroup` GC suite for real via a dedicated `vitest.gc.config.ts` (forks pool + `--expose-gc`) instead of relying on a `NODE_OPTIONS` environment variable
- **TypeScript 6 → 7** (the native compiler). Emitted `.js` and `.d.ts` are byte-identical to the TS 6 output; only sourcemaps gain a few segments. Note that TS 7 removes the JS compiler API — `transpileModule` no longer exists
- **pnpm 10.6.5 → 11.17.0**. Settings moved out of the `pnpm` field in `package.json` into `pnpm-workspace.yaml`, where `allowBuilds` replaces `onlyBuiltDependencies`
- `@types/node` realigned from `^25` down to `^24.13.3` so the types match the `>=24.13` engine floor instead of exceeding it
- Removed `sinon` and `@types/sinon` — no source or spec file has imported them
- Dependency bumps: Biome 2.4.15 → 2.5.5 (config migrated to `preset: "recommended"`), rollup 4.60.4 → 4.62.2, `npm-run-all2` 8 → 9, `@arethetypeswrong/cli` 0.18.2 → 0.18.5

### Chores

- CI: `actions/checkout`, `actions/setup-node` and `actions/upload-artifact` to v7, `pnpm/action-setup` to v6. The pnpm version is no longer duplicated in the workflows — the action reads `packageManager` from `package.json` — and the pnpm store is now cached via `setup-node`

### Tests

- `createSignal.mutedWrites.spec.ts`: cover writes on muted and destroyed signals — value is stored, notification is suppressed, `unmuteSignal()` does not replay, lazy factories still install while muted

### Documentation

- `docs/recipes.md`, `docs/api.md`, `docs/cheat-sheet.md`, `skills/using-signalize/references/{api,pitfalls}.md`, JSDoc: correct the claim that `set()` is a no-op on muted or destroyed signals — the value is stored, only the notification is suppressed
- `skills/using-signalize`: split into a lean `SKILL.md` (mental model + six silent-failure behaviours) plus `references/{api,pitfalls,patterns}.md` loaded on demand; sharpen the frontmatter description for triggering
- `skills/using-signalize/SKILL.md`: drop the "refuse / rewrite" framing in favour of a judgement section — the skill states behaviour, it does not prescribe architecture
- `CLAUDE.md`: trim to the resident subset (commands, non-derivable gotchas, changelog rules) and point to `AGENTS.md`, `skills/` and `docs/` for the rest
- `CLAUDE.md`, `AGENTS.md`: remove the stale claim that the `skills/` folder was removed — it exists and is part of the doc-sync chain
- `AGENTS.md`: document the skill in the documentation surface, de-duplicate the CI-vs-local section
- `README.md`: add an "AI coding agents" pointer to the shipped skill
- `README.md`: add a "Development" section (pnpm task overview, and why `pnpm world` — not `pnpm cbt` — is the pre-push gate)
- `README.md`: add a "Good to know" section listing the six behaviours that differ from other signal libraries without raising an error
- `README.md`: fix the batched-writes example — a `createMemo` result is called as `total()`, it has no `.get()`
- `README.md`: fix the domain-model example — `createMemo` was used but not imported
- `README.md`: install snippet now installs the `@spearwolf/eventize` peer dependency explicitly (pnpm/yarn do not add peers), and notes the ESM-only/two-entry-point setup
- `README.md`: list the `Signal` and `Effect` class exports in "API at a glance"
- `CONTRIBUTING.md`: add `skills/using-signalize/` and `CLAUDE.md` to the documentation structure table
- `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`: replace the Jest/ts-jest references with Vitest, document the SWC decorator transform and the pnpm 11 settings move, correct the stale "TypeScript v5" claim
- `README.md`, `skills/using-signalize`: correct the cleanup claim — `SignalGroup` has a `FinalizationRegistry` backstop for groups with a host object, so "nothing is garbage-collected for you" was wrong; document its three limits (non-deterministic firing, no coverage for self-keyed groups or unattached resources)

## `v0.30.0` (2026-05-20)

### Features

- `SignalGroup#off()`: destroy attached effects/links and drop all external subscriptions on group signals; signals stay alive, the group remains reusable. Child groups are `off()`'d recursively. Emits an `OFF` event
- `SignalGroup`: auto-cleanup via `FinalizationRegistry` — when the user object becomes unreachable without an explicit `SignalGroup.delete(obj)`, the group's `clear()` runs from the FR callback, reclaiming attached signals/effects/links (FR firing is non-deterministic; explicit cleanup remains preferred)
- `getSignalGroupsCount()`: new top-level export for leak diagnostics

### Bug Fixes

- `SignalGroup.attachSignalByName`: deduplicate name→signal mapping (no more duplicate entries on repeated attach); internal `#otherSignals` is now `Map<name, Set<SignalImpl>>`
- `createEffect`: conditional-type overloads now reject string/symbol dependencies without an `attach` option at compile time, preventing the previous runtime `TypeError` from `group.signal(name)` on an undefined group

### Documentation

- `README.md`: expand "Features", add "What makes it different" (synchronous inline propagation as the central trade-off), add "Examples" section (game-loop, batched writes, `SignalGroup` lifecycle, framework-agnostic domain model) and "Typical use cases"
- `AGENTS.md`: fix stale peer-dep version (`^4.0.2` → `^5.0.0`); rewrite commands table and CI section to reflect Biome (replacing ESLint + Prettier); remove the deleted `Backlog.md` row
- `CONTRIBUTING.md`: replace ESLint references with Biome (`pnpm check` / `pnpm fix`); document `pnpm world` and clarify what `pnpm cbt` actually runs

### Tests

- `decorators.memo.spec.ts`: rename misleading `'non-lazy by default'` → `'always lazy'` (the assertions verify lazy behavior)
- `jest.config.js`: enforce coverage thresholds (branches/functions ≥ 85%, lines/statements ≥ 95%); emit `json-summary` + `lcov` reporters

### Build System

- CI: publish coverage summary to the workflow summary and upload the `coverage/` directory as an artifact (14 days retention)

## `v0.29.0` (2026-05-13)

### Build System

- Upgrade @spearwolf/eventize 4.x → 5.0.0 "duck-typing"

### Documentation

- Rewrite `docs/`: replace `introduction.md` / `guide.md` / `full-api.md` with `architecture.md`, `api.md`, `recipes.md`; rewrite `quickstart.md` and `cheat-sheet.md`; refresh `README.md`

## `v0.28.0` (2026-05-09)

### Deprecations

- `signalReader(callback)` (the callback-form of `Signal.get` / the reader function) is deprecated and emits a once-per-process `console.warn`. Use `Signal.onChange(callback)` instead — it returns an unsubscribe function. The callback form will be removed in a future release.

### Features

- `EffectImpl.maxDepth` (default `256`) caps re-entrant `run()` recursion; runaway self-triggering effects now throw a descriptive error instead of overflowing the JS stack

### Bug Fixes

- `set(value, {touch: true})` no longer emits a touch on muted or destroyed signals
- `beforeRead` callback now also fires on the reader-with-callback path (previously only on plain reads)
- `Batch.run()` releases its temporary `globalEffectQueue` / `globalEffectCalledQueue` listeners via `try/finally`, preventing leaks when an effect throws during a flush
- `SignalGroup` no longer pins user objects: the global registry is a `WeakMap`, and the per-group `#storeKey` is a `WeakRef`; iteration uses a parallel `Set<SignalGroup>` that holds groups (not user objects), eliminating the strong-Map memory leak

### Chores

- Remove dead `EffectImpl.parentEffect` field (never read; assignment was self-referential)
- Replace internal `EffectImpl.Destroy` string constant with the shared `DESTROY` symbol from `constants.ts`
- `Batch.batch()` clarifies the priority-insertion loop (explicit `continue` instead of empty branch) and `Batch.run()` iterates `delayedEffects` directly, dropping the intermediate `flatMap` allocation
- `EffectImpl.run()` reuses its `#lostSignals` Set across runs (`clear()` + re-fill) instead of allocating a fresh Set per re-run
- `link()` computes `signalImpl(target)` once and reuses it for both the singleton lookup-key and the branch decision

### Tests

- `globalEffectStack.spec.ts` now destroys created `EffectImpl` instances and asserts `effects-count = 0` in `before/afterEach`
- Cover `batch()` reentrancy after a throw in the callback (top-level and nested) and verify `Batch.run()` listener cleanup when an effect throws
- Add test for the `EffectImpl.maxDepth` recursion brake
- Add test case documenting the updater-function pitfall: `set()` stores function as value
- Add test case for `.set(fn, {lazy: true})` deferred evaluation behavior
- Pin down `SignalAutoMap.get()` behavior after external `destroySignal()`: the destroyed signal stays cached, reads return the last value, writes are silent no-ops
- Add `SignalGroup.gc.spec.ts` (skipped without `--expose-gc`) verifying the registry does not pin user objects

### Build System

- Upgrade TypeScript 5.9 → 6.0.3
- Upgrade Jest 29 → 30 (`@types/jest` bumped to 30; `ts-jest` 29.4.9 retained)
- Replace ESLint + Prettier with Biome 2.4 (`biome.json`); old configs removed
- Bump `@types/node` 20 → 25, `sinon` 18 → 22, `@types/sinon` 17 → 21
- Switch `npm-run-all` → `npm-run-all2`
- Remove unused devDeps: `@babel/core`, `@babel/preset-typescript`, `core-js`, `exec-sh`
- New scripts: `pnpm check`, `pnpm fix`, `pnpm format:write`; remove `lint`/`prettier*`/`fix` scripts
- `pnpm world` now runs `clean + check + compile + bundle + test`
- CI runs `pnpm check + pnpm test`
- New script `pnpm test:gc` (`NODE_OPTIONS=--expose-gc jest --runInBand`) for the GC-sensitive specs

## `v0.27.2` (2026-02-04)

- remove `AGENTS.md` from npm package output

## `v0.27.1` (2026-02-04)

- remove `.github` folder from npm package output

## `v0.27.0` (2026-02-04)

- **The npm build .js fragments are now bundled with rollup.**
- chore: cleanup obsolete scripts
- chore: update build dependencies

## `v0.26.0` (2026-02-03)

### Bug Fixes

- **Nested effects cleanup**: When an outer effect re-runs, nested (child) effects are now properly destroyed before being recreated. This ensures that cleanup callbacks of nested effects are correctly invoked.
  - Previously, cleanup callbacks of nested effects were only called when the outer effect was destroyed, not when it re-ran
  - Now, `destroyChildEffects()` is called in `run()` before the effect callback executes

### Chores

- **Test refactoring**: Replace deprecated Jest matcher aliases with recommended alternatives
  - `.toBeCalledWith()` → `.toHaveBeenCalledWith()` (31 occurrences)
  - `.toBeCalledTimes()` → `.toHaveBeenCalledTimes()` (15 occurrences)
  - Remove unnecessary `done` callback in synchronous test (1 occurrence)
  - Affected files: `unsubscribeEffect.spec.ts`, `createSignal.spec.ts`, `createSignal.compareFn.spec.ts`, `batch.spec.ts`, `effects.onCreateEffect.spec.ts`, `globalEffectStack.spec.ts`

### Documentation

- Restructure documentation: `README.md` is now a concise entry point with links to detailed `docs/`
- Add comprehensive documentation in `docs/` folder:
  - `introduction.md` - Library overview and core concepts
  - `quickstart.md` - Installation and basic usage
  - `guide.md` - Comprehensive tutorial with all features
  - `full-api.md` - Complete API reference
  - `cheat-sheet.md` - Quick reference for common patterns
- Add AI agent skills in `skills/` folder for assisted development
- Add `CONTRIBUTING.md` with development guidelines
- Add JSDoc comments to all public API functions and classes
- Document `beforeRead` signal option
- Clarify that static effects (with explicit dependencies) do NOT autorun
- Add EXPERIMENTAL warning for `@signal` and `@memo` decorators

## `v0.25.0` (2025-11-27)

- Add `hibernate(callback)` function to temporarily suspend all context states during callback execution
  - Clears batch, beQuiet, and effect stack contexts within the callback
  - All API calls function as if called without any context
  - Automatically restores previous states after callback completes (even if an exception occurs)
  - Supports nesting for complex use cases
- Setting a memo value (the return value of a memo hook) now always happens automatically as a _batch_
- Rename `SignalLink#toggle()` to `SignalLink#toggleMute()` for clarity
- Add comprehensive documentation for `SignalGroup` in README
- Add comprehensive tests for `SignalGroup` API covering all code paths

## `v0.24.0` (2025-08-26)

- Optimize dynamic signal unsubscriptions for effects
- Add a priority option to effects
  - Memos by default have a higher prio then plain effects

## `v0.23.0` (2025-08-25)

- Fixed an issue that prevented signals that were no longer used from being removed from the subscription list for dynamic effects.

## `v0.22.0` (2025-08-25)

Memos are now _non-lazy_ by default.

- Non-lazy memos are automatically recalculated when dependent signal values change. This also automatically updates any further effects that depend on the memo.
- Non-lazy memos are therefore a fully-fledged equivalent to a _computed_ signal.
- Non-lazy is the new standard because that is most likely the behavior most users expect from a computed signal.

Lazy memos (as they were the default in previous library releases) are still available and can be created with the `lazy: true` option.

- Lazy memos only recalculate when they are explicitly called (and the signal dependencies have changed).
- Unlike computed signals (or non-lazy memos), effects that have a memo as a dependency are not automatically triggered. This only happens when the memo is read and the memo value changes as a result.
- Lazy memos are of course still available and can be quite effective.

## `v0.21.1` (2025-08-21)

- improve documentation
- remove docs/ folder and hero image from npm package archive

## `v0.21.0` (2025-08-12)

_minor quality of live update_

- use `ES2023` as target for the build
- update dependencies (patch and minor versions)
- build: use _isolated modules_ in tsconfig.json

## `v0.20.1` (2025-03-26)

- improve `value(sig)` types: allow `SignalLike` and `SignalReader`

## `v0.20.0` (2025-03-21)

- deprecated `SignalGroup.destroy(obj)` and `SignalGroup#.destroy()` functions
  - a group can not be destroyed anymore &mdash; just clear it
  - use the new `SignalGroup.delete(obj)` and `SignalGroup#clear()` functions instead

## `v0.19.1` (2025-03-13)

- improve `SignalAutoMap` _from props_ behavior:
  - always create signals even if values are _undefined_ when using the `fromProps` or `updateFromProps` functions
- update `SignalAutoMap` key _types_ (which is now _string_ or _symbol_ &mdash; period.)

## `v0.19.0` (2025-03-13)

- add `SignalAutoMap` class

## `v0.18.1` (2024-10-24)

- add `SignalGroup#hasSignal(name)` helper
- refactor naming of internal constants

## `v0.18.0` (2024-10-24)

- rename `SignalGroup#getSignal(name)` helper to `SignalGroup#signal(name)`
- remove obsolete _type SignalFuncs_
- improve README and CHANGELOG &rarr; Migration Guide to v0.17.0

## `v0.17.1` (2024-10-23)

- minor maintenance release
  - exclude unused images from npm package output

## `v0.17.0` (2024-10-23)

_❗BREAKING CHANGES❗_

- refactor `createSignal()` and `createEffect()` api calls
  - introduce the `Signal` class (formerly `SignalObject`)
    - as return result of `createSignal(): Signal`
    - rename previous `Signal` _type_ &rarr; `ISignalImpl`
  - introduce a new `Effect` class
    - as return result of `createEffect(): Effect`
    - rename previous `Effect` class &rarr; `EffectImpl`
  - rename some `createSignal()` options
    - rename `compareFn` &rarr; `compare`
    - rename `beforeReadFn` &rarr; `beforeRead`
- introduce the new `SignalGroup` API
- remove some awkward and mistakable decorators
  - remove `@signalReader()`
  - remove `@effect()`
- refactor public api exports
  - rename `queryObjectSignal()` &rarr; `findObjectSignalByName()`
  - rename `getObjectSignalKeys()` &rarr; `findObjectSignalKeys()`
  - rename `getObjectSignals()` &rarr; `findObjectSignals()`
  - rename `destroySignals()` &rarr; `destroyObjectSignals()`
- cleanup types
- remove `connect()`, `unconnect()` and `class Connection`
- introduce `link()`, `unlink()` and `class SignalGroup`
  - as a more general approach and replacement of the previous connection api

### Migration Guide

#### Change `createSignal()` calls

The signature of the call to `createSignal()` has changed; a signal _object_ is now returned.
The previous calls in the form `const [val, setVal] = createSignal()` can be transformed into the form `const {get: val, set: setVal} = createSignal()`. Alternatively, you can now simply call `const val = createSignal()` and read the signal using `val.get()` or `val.value` and write it using `val.set()`.

#### Change `createEffect()` calls

Similarly, the `createEffect()` function now also returns an effect _object_.
The previous call `const [run, destroy] = createEffect()` should be rewritten as follows: `const {run, destroy} = createEffect()`. Alternatively, simply use the effect object:

```ts
const effect = createEffect(...)
...
effect.destroy()
```

#### Replace `@signalReader()` declarations

The `SignalGroup` API now replaces the awkward `@signalReader` decorator.

For each object that uses the `@signal()` decorator, a `SignalGroup` is automatically created, in which the signals are stored according to their name.
It is therefore possible to retrieve the signal api object via `group.getSignal(name)`.

Before:

```ts
class Foo {
  @signal() accessor bar = 123;
  @signalReader() accessor bar$;
}

const f = new Foo();

f.bar$((val) => {
  console.log('bar changed to', val);
});
```

After:

```ts
class Foo {
  @signal() accessor bar = 123;
}

const f = new Foo();

const bar = findObjectSignalByName(f, 'bar');

bar.onChange((val) => {
  console.log('bar changed to', val);
});
```

#### Replace `@effect()` declarations

The `SignalGroup` API now replaces the mistakable `@effect` decorator.

The necessity to call the methods annotated as `@effect()` in the constructor once has led to misunderstandings and ambiguities, especially when it was an effect with static dependencies. With the new `attach` option for effects, the behavior is now explicit and clear.

Before:

```ts
class Foo {
  @signal() accessor bar = 123;
  @signal() accessor plah = 'abc';

  constructor() {
    this.staticEffect();
    this.dynamicEffect();
  }

  @effect(['bar', 'plah'])
  staticEffect() {
    console.log('bar, plah :=', this.bar, this.plah);
  }

  @effect() dynamicEffect() {
    console.log('plah, bar :=', this.plah, this.bar);
  }

  destroy() {
    destroySignalsAndEffects(this);
  }
}
```

After:

```ts
class Foo {
  @signal() accessor bar = 123;
  @signal() accessor plah = 'abc';

  constructor() {
    createEffect(() => this.dynamicEffect(), {attach: this});

    createEffect(() => this.staticEffect(), ['bar', 'plah'], {
      attach: this,
    }).run();
  }

  staticEffect() {
    console.log('bar, plah :=', this.bar, this.plah);
  }

  dynamicEffect() {
    console.log('plah, bar :=', this.plah, this.bar);
  }

  destroy() {
    destroyObjectSignals(this);
  }
}
```

#### Replace `SignalObject` with `Signal`

Replace all occurrences of `SignalObject` (which was introduced in version v0.14.0) with `Signal`. The methods have not changed.

#### Refactor `connect()` and `unconnect()` usages

The legacy _connection api_ is now replaced by the _signal group_ feature and the `link()` and `unlink()` utility functions:

In most cases, it should be sufficient to simply replace the `connect()` calls with `link()` calls. Similarly, `unlink()` replaces the function `unconnect()`, although `unlink()` is often not necessary at all; _links_ between signals are automatically cleaned up when one of the signals is destroyed.

Links to _object signals_ must be adapted, e.g. with:

```js
link(sigFoo, findObjectSignalByName('bar'));
```

.. or by using the new _group api_:

```js
link(groupA.getSignal('foo'), groupB.getSignal('bar'));
```

## `v0.16.0` (2024-08-04)

- update to `@spearwolf/eventize@4.0.1`
- use `Symbol.for` for constants

## `v0.15.0` (2024-07-22)

_maintenance update_

- **no** new feature inside!
- just updated most build dependencies
- BUT also updated the (only) runtime dependency [@spearwolf/eventize](https://github.com/spearwolf/eventize) to v4.x:
  and this is a ❗BREAKING CHANGE❗ since the new eventize api switches to the functional api by default
- _so you may need to make adjustments to your codebase if you use the eventize api directly (independently of signalize)_

## `v0.14.0` (2024-06-25)

- `createSignal()` now returns a polymorphic api
  - a new object-based api is returned, see the [SignalObject](./src/SignalObject.ts) class for details
  - but the returned api can still be used as an array of [reader, writer] functions
  - so you don't need to change existing code that uses the reader and writer function syntax
  - but you can use the new object-based api, which may be more convenient (depending on your coding style and context)
  - more docs will follow later ;)
- upgrade build dependencies

## `v0.13.0`

_maintenance release_

- upgrade build dependencies
- remove unnecessary optional dependencies

## `v0.12.0`

- `createEffect()` now also supports _async_ callbacks. if an async effect callback creates a cleanup callback as return value, it will be executed like a normal cleanup callback when the effect is re-executed

## `v0.11.0`

- add the `beQuiet()` helper for dynamic effects. within the beQuiet callback, an active dynamic effect will not be noticed when a signal is read.
- add another test to demonstrate the dynamic nature of effects

## `v0.10.1`

- fix `@effect` decorator types

## `v0.10.0`

- the `@effect` decorator now supports the specification of _static_ signal dependencies (via `signal` or `deps` options)
  - in this case, you can use the `autostart: false` option to control whether the effect is executed immediately when the effect method is called for the first time - or only later when one of the static signal dependencies changes
  - by default (if it is not specified), then `autostart` is activated
- if no name is specified in the `@signalReader` decorator, then the name is automatically determined from the accessor field name. with the special feature that the field name is cut off at the end if the field has a `$` in the name. for example, the signal name `foo` is extracted from the field name `foo$`

## `v0.9.0`

- ensure that each object has its own signal instance when using the `@signal` decorator
- add `name` and `readAsValue: true` options to `@signal` decorator
- introduce `@signalReader({name: 'foo'})` class accessor decorator
- export `getObjectSignalKeys(obj)` helper

## `v0.8.0`

- the createEffect api was enhanced
  - `createEffect(callback, [sigA, sigB, ..])`
    - similar to react's createEffect hook, you can now (optionally) specify a dependency array. in the dependency array, you specify the signals that will execute the effect on change. the signals do not have to match the signals used in the effect callback. if such static dependencies are specified, the effect callback will no longer be executed automatically when you create the effect. it will only be executed later if at least one signal changes.
- a signal reader callback is no longer called immediately ..
  - only when the signal changes
  - the callback is no longer called as a dynamic effect
  - it only uses the original signal as a static effect dependency
- introduce the type helper `SignalFuncs<Type>` &mdash; the return value type of `createSignal()`
- the pre-compile step for jest is omitted, now ts-jest is used and jest can be called directly without any indirection 🥳

## `v0.7.0`

- the decorators are no longer included in the default export (index.js)
  - to use the decorators, the user must import them from `@spearwolf/signalize/decorators'
- fix package type definitions

## `v0.6.1`

- no _commonjs_ format is delivered anymore
- the _esm_ format is no longer bundled
- use `import type ..` syntax

## `v0.6.0`

- switch package to `type: module`
  - this hopefully solves the problem that typescript cannot resolve the types correctly when `signalize.mjs` is loaded 😵
  - the final package output will now completely omit `.mjs` file endings

## `v0.5.2`

- mark package as side effects free
- update (mainly dev) dependencies

## `v0.5.1`

- upgrade dev depenedencies
  - this includes an upgrade from typescript 5.1 to 5.2, which brings with it new build artefacts

## `v0.5.0`

- upgrade dependency `@spearwolf/eventize` to `v3.0.0`
- remove `type=module` from package.json
  - instead, use `*.mjs` file extension for _esm_ output
- introduce CHANGELOG 😉

## `0.4.0` (2023-03-02)

- upgrade to typescript@5
  - refactor build pipeline
- mute, unmute and destroy signals
  - `muteSignal(get)`
  - `unmuteSignal(get)`
  - `destroySignal(get)`
- fix effect cleanup callback
  - if an effect is executed again, the cleanup callback from the last effect is called first (the behavior is similar to the react.useEffect() cleanup function)
- add `getEffectsCount()` and `onDestroyEffect()` helpers
- auto cleanup/unsubscription of effects and memos when all their signals are destroyed
- change signature of the `createEffect()` helper: an array with a _run_ and _unsubscribe_ function is now returned
- refactor child effects

## `0.3.2` (2023-02-22)

- typescript: export all types
