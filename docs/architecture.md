# Architecture

`@spearwolf/signalize` is a synchronous fine-grained reactivity layer built on
top of [`@spearwolf/eventize`](https://github.com/spearwolf/eventize). Every
signal change is propagated inline — there is no scheduler, no microtask
queue, no virtual graph.

## The four primitives

| Primitive       | Created via       | Role                                                                        |
| --------------- | ----------------- | --------------------------------------------------------------------------- |
| **Signal**      | `createSignal()`  | Reactive value. `.get()` inside an effect registers a dependency.           |
| **Effect**      | `createEffect()`  | Function that re-runs when tracked signals change.                          |
| **Memo**        | `createMemo()`    | Cached derived signal — internally a signal driven by a high-priority effect. |
| **Link**        | `link()`          | Explicit one-way data flow: `signal → signal` or `signal → callback`.       |
| **SignalGroup** | `SignalGroup.findOrCreate(obj)` | Lifecycle bundle. Clearing the group destroys everything attached to it.  |

## Reactivity flow

```
1. effect.run()                                          ← starts execution
2. push effect onto globalEffectStack
3. callback executes
4. signal.get() inside callback
5. signal asks getCurrentEffect()?.whenSignalIsRead(id)
6. effect subscribes: on(globalSignalQueue, id, priority, RECALL, this)
7. ... later, signal value changes ...
8. emit(globalSignalQueue, id, newValue)
9. RECALL handler fires → step 1
```

Subscribe-on-read happens once per signal per effect run. On every rerun the
effect snapshots its previous deps, then drops anything not re-read.

An effect with **static deps** goes through the same steps 1–3: it is pushed
onto the stack like any other, which is what makes effects created inside its
callback child effects. Step 5 is where it differs — `whenSignalIsRead()`
returns early while a static-deps callback is running, so no subscription is
created. The declared deps are subscribed separately, from `createEffect()`.

## Synchronous everything

`emit()` calls every subscriber inline before returning. This means a
`signal.set()` triggers all dependent effects before the next line of user code
runs. Predictable, but it's also why the library guards against recursion:
an effect that synchronously writes to a signal it depends on re-enters
`run()`. Up to `getMaxEffectDepth()` (default 256) levels are tolerated —
`setMaxEffectDepth(n)` moves the cap;
beyond that, `run()` throws a descriptive `Error` instead of overflowing the
JS stack.

## Global event buses

All cross-cutting communication uses four global eventize buses
(`src/global-queues.ts`):

| Queue                       | Carries                                     |
| --------------------------- | ------------------------------------------- |
| `globalSignalQueue`         | Signal value changes (`emit(queue, signalId, value)`) |
| `globalDestroySignalQueue`  | Signal destruction                          |
| `globalEffectQueue`         | Effect lifecycle (`$createEffect`, `$destroyEffect`, `RECALL`) and async failures (`$effectError`) |
| `globalEffectCalledQueue`   | Batch deduplication — emitted on only while a batch flush is running |

Effects subscribe to signal IDs they read; signals emit on change. Nothing else.

**Symbol namespacing:** All internal `Symbol.for` keys use the `@spearwolf/signalize/` namespace
prefix (`signal`, `effect`, `recall`, `destroySignal`, `createEffect`, `destroyEffect`,
`effectError`, `signalizeError`, `queueUnsubscribes`, `autoMapResources`, `instances`) to prevent
collisions with unrelated code: without the prefix, a stray
`Symbol.for('signal')` in application code would pass `isSignal()` with incorrect metadata. The
namespace carries no major version, so the keys of two copies in one process are identical.

**Two copies in one process do not work together.** They recognize each other's signals and
nothing else: the queues, the effect stack and the link map are module state and exist once per
copy. Measured — `isSignal()` returns `true` across the boundary, an effect from the other copy
never runs again after its first run, and `destroySignal()` across it drives the calling copy's
`getSignalsCount()` to `-1`. This is not silent: loading a second copy is reported once through
[`onSignalizeError()`](./api.md#onsignalizeerrorcb-priority---void) with
`source: 'multiple-instances'` and the load paths of both copies (`src/instances.ts`). See
[Announce every copy of the library](#announce-every-copy-of-the-library).

## Priority

Subscribers are notified in **descending priority order** (higher runs first).

- Memos default to `Priority.C = 1000`.
- Effects default to `0`.

Therefore an effect that reads a memo always sees the up-to-date memo value:
the memo's internal effect ran first.

## Context modes

| Mode             | Function           | Behaviour                                                            |
| ---------------- | ------------------ | -------------------------------------------------------------------- |
| Batch            | `batch(fn)`        | Effects triggered inside `fn` run once after the outermost batch ends, in priority order. |
| Quiet            | `beQuiet(fn)`      | Reads inside `fn` don't subscribe; writes don't notify.              |
| Hibernate        | `hibernate(fn)`    | Suspends batch, quiet, and the effect stack for the duration of `fn`. |
| Untracked read   | `value(sig)` / `sig.value` | Read without registering a dependency.                       |
| Forced notify    | `touch(sig)` / `sig.touch()` | Emit a change without changing the value.                  |

These modes nest correctly: each pushes its previous state and restores it on
exit (including thrown exceptions).

## Lifecycle (SignalGroup)

`SignalGroup` is a container that owns signals, effects, links and child
groups. Clearing a group destroys everything in it.

- `SignalGroup.findOrCreate(obj)` — returns the group attached to `obj`,
  creating one if necessary. Each user object has at most one group. Passing
  a `SignalGroup` returns it as-is.
- The store is a `WeakMap<object, SignalGroup>` and the back-pointer is a
  `WeakRef`, so attaching a group to a user object does **not** keep that
  object alive.
- `SignalGroup.delete(obj)` is the public destructor, for the host object or
  for the group itself. The instance method is `group.clear()` (the older
  `destroy()` is deprecated and warns).
- Groups can nest via `attachGroup()`. Named signal lookup
  (`group.signal(name)`) walks up the parent chain.
- **Automatic cleanup via `FinalizationRegistry`:** When the user object
  becomes unreachable, a registry callback invokes `group.clear()`. This
  requires that no strong reference path from a GC root back to the object
  exists — and any such path is enough to stop it. `SignalGroup` itself no
  longer contributes one: the module-level set of live groups holds
  `WeakRef`s, the registry's held value is a `WeakRef`, and the per-signal
  subscription each group keeps on `globalDestroySignalQueue` knows both the
  group and the signal through `WeakRef`s. An attached signal whose value
  points back at the object — the `@signal accessor` storing `this` — is
  therefore collected together with its group and its host (measured: 1000
  of 1000 hosts survived before, 0 of 1000 after).
- **What still pins a host: an attached effect whose callback closure
  captures it.** The group is not the holder here. `EffectImpl` subscribes
  itself to `globalEffectQueue` under its own id in its constructor and
  stays subscribed until `destroy()` — that subscription is how a write
  reaches it, and it makes every live effect reachable from a module-level
  root. Whatever its callback closes over is held by that root, group or no
  group: measured, 200 effects created without any group keep 200 of 200
  hosts alive, and `destroy()` brings it to 0 of 200. This is the reason the
  same limit applies to anything created without `attach` — it stays
  subscribed to the global queues until it is destroyed by hand.
- **A silently collected group has not run `clear()`.** It emits no
  `DESTROY`, and its signals are collected rather than destroyed (the signal
  counter corrects itself from a per-signal finalizer, so it still falls
  back to its baseline). Its subscriptions on `globalDestroySignalQueue` are
  released by a second `FinalizationRegistry` on the group, whose held value
  is the unsubscribe handles alone — without it the leak would only have
  moved, 2000 listeners staying on the queue for 1000 collected groups.
  Explicit `SignalGroup.delete(obj)` or `group.clear()` in cleanup remains
  the reliable path, and the only one that fires `DESTROY`. A teardown that
  throws inside a registry callback is reported via `onSignalizeError()` —
  `console.error` while nobody listens there — rather than re-raised: there is
  no caller in that job to throw at.

## Decorators

`@signal` (subpath `@spearwolf/signalize/decorators`) uses the
TC39 standard form (`accessor` keyword, stage-3 semantics).

- Each instance of a decorated class implicitly owns a `SignalGroup` keyed by
  the instance — destroying the group via `SignalGroup.delete(instance)` or
  `destroyObjectSignals(instance)` cleans up.
- A decorated field holding a reference to the instance (e.g.
  `@signal() accessor self = this`) does **not** stop automatic cleanup via
  `FinalizationRegistry` — instance and group are collected together (see
  "Automatic cleanup" above; measured 1000 of 1000 such instances survived
  before, 0 of 1000 after). What does stop it is an effect whose callback
  closure captures the instance, group or no group. Explicit cleanup in a
  destructor or dispose method stays the one path you can schedule, and the
  only one that emits `DESTROY`.
- There is no memo decorator; a class-bound derived value is a
  `createMemo(..., {attach: this})` in the class body — which dies with the
  surrounding effect if the instance is constructed inside one.

## Architecture decisions

The decisions that shape the code but cannot be read off any single file. They
are recorded here so that inline comments do not have to carry them, and so
that a change touching one of them is recognisable as a change of direction
rather than a refactor. Code may point at an entry; it should not restate one.

A decision that is simply in force everywhere — synchronous delivery, English
source, named exports — needs no marker at the call site.

### Reactivity is synchronous, with no scheduler

**Context.** Every other option — microtask queue, animation-frame batching, a
virtual dependency graph resolved on flush — buys deduplication at the price of
a moment where the graph is half updated and the application cannot tell.

**Decision.** `emit()` calls every subscriber inline. A `signal.set()` has
finished notifying before the next statement of user code runs. `batch()` is
the one opt-in that defers, and only until the outermost batch ends.

**Consequence.** Reads after a write are always current, and a stack trace
spans the whole causal chain. In exchange the library must guard re-entrancy
itself: an effect that writes a signal it reads re-enters `run()`, so runs are
capped at `getMaxEffectDepth()` (default 256) and the overflow is a descriptive
error rather than a blown JS stack. There is no place to hook a scheduler in
later without changing observable behaviour.

### Cross-cutting communication rides on eventize queues

**Context.** Signals need to reach effects that were not known when the signal
was created, and effects need to survive their dependencies being destroyed.

**Decision.** Four module-level eventize buses carry everything
(`src/global-queues.ts`); a signal emits under its own id, an effect subscribes
to the ids it read. There is no graph object, no owner tree, no registry of
edges.

**Consequence.** Dependency tracking costs one subscription per signal per
effect and nothing else, and priorities come for free from eventize. The price
is that the queues are module-level GC roots: every live effect is reachable
from one until it is destroyed, which is why explicit teardown exists at all.

### Symbol keys are namespaced and carry no version

**Context.** `Symbol.for` keys are process-global. An unprefixed
`Symbol.for('signal')` in unrelated application code would satisfy `isSignal()`
and hand the library an object with the wrong metadata.

**Decision.** Every internal key is `Symbol.for('@spearwolf/signalize/<name>')`.
The namespace deliberately carries no major version.

**Consequence.** Collisions with foreign code are ruled out, while two copies
of *this* library still recognise each other's keys — which is what makes the
detection below possible at all. A versioned key would never meet the other
copy, which is the whole point of looking.

### Announce every copy of the library

**Context.** Two copies in one process share no queues, no effect stack and no
link map, but do share symbol keys. The result is not an error anywhere: signals
are recognised across the boundary, effects silently stop running, and counters
drift negative.

**Decision.** On load, a copy registers itself in a `globalThis` register keyed
by `$signalizeInstances` and reports through `onSignalizeError()` with
`source: 'multiple-instances'` if it is not the only one, naming the load paths
of both.

**Consequence.** A duplicate install becomes a diagnosable warning instead of an
unexplainable loss of reactivity. The register is one of the two accepted
top-level side effects (below), and a consumer that uses none of the exports
reaching it simply does not get the warning — a missing alarm, never a false
one.

### The effect subsystem is reachable through a placeholder, not an import

**Context.** `Signal.onChange()` needs `createEffect()`. Importing `effects.ts`
from the signal layer would close a cycle and drag `EffectImpl`, `SignalGroup`
and `batch` into every bundle that only wanted `createSignal`.

**Decision.** `effect-hook.ts` is a leaf holding an unset placeholder.
`effects.ts` fills it on module evaluation; the signal layer reads it. That
assignment is the only edge between the two halves.

**Consequence.** A signal-only consumer bundle drops the effect subsystem
entirely — measured at 17 087 → 10 539 bytes minified for a bundle re-exporting
only `createSignal`. `onChange()` throws a named error if the hook was never
filled, which is the price of the indirection, and it is why the assignment is
the second accepted top-level side effect.

### Top-level side effects: two, both measured

**Context.** `package.json` declares `sideEffects: false`, which permits a
bundler to drop any module whose exports go unused.

**Decision.** Module top-levels stay free of observable work, with exactly two
exceptions: the instance register in `signalize-error.ts`, and the hook
assignment at the end of `effects.ts`. They are not interchangeable — losing the
first costs a warning, losing the second makes `Signal.onChange()` throw.

**Consequence.** A third exception is a decision of the same weight and owes the
same measurement, including how it behaves under `treeshake: 'smallest'` in both
the bundled and the multi-module form. `AGENTS.md` carries the full measurement
and the packaging obligation that follows from it: pointing `exports` at `lib/`
would break `onChange()` in tree-shaken consumer bundles.

### The published surface is a list, never a star

**Context.** `export *` publishes every future export of a module without anyone
deciding to; `export type *` does the same for types.

**Decision.** `src/index.ts` and `src/decorators.ts` name every export
individually. Implementation-layer types stay inside the module graph —
`ISignalImpl` is internal, `LinkSource` is the view a consumer gets.

**Consequence.** Publishing is an edit to an entry file, reviewable as such.
Biome's `performance/noReExportAll` and `index.public-surface.spec.ts` hold the
value half; the type half has no tool and rests on the rule plus the witnesses
in `types.public-surface.spec.ts`.

### Lifetimes are weak by default, with finalizers as backstops

**Context.** A `SignalGroup` exists to be attached to a host object. Anything in
the library that holds a group strongly from a module-level root also holds that
host, and an `@signal accessor` whose value is `this` closes the loop.

**Decision.** The store is a `WeakMap`, the set of live groups holds `WeakRef`s,
every back-pointer and every queue listener reaches its owner through a
`WeakRef`, and each `FinalizationRegistry` holds unsubscribe handles rather than
the object they belong to.

**Consequence.** A host object becomes collectible together with its group and
its signals — measured at 1000 of 1000 hosts surviving before the change, 0 of
1000 after. What the design cannot reach is an effect: `EffectImpl` subscribes
itself to `globalEffectQueue` in its constructor and stays subscribed until
`destroy()`, so whatever its callback closes over is held by a module-level root,
group or no group. Explicit teardown remains the only schedulable path, and the
only one that fires `DESTROY`.

### Resource counters are eventually consistent, never observably so

**Context.** `getSignalsCount()` and `getLinksCount()` are advertised for leak
detection, but a resource that is merely dropped never runs its `destroy()`.

**Decision.** A `FinalizationRegistry` corrects each counter when a dropped
resource is collected, and releases the subscriptions that would otherwise stay
on the module-level queues.

**Consequence.** The counters do not mislead in the long run, but the correcting
moment cannot be named or forced. Treat a difference as a leak only after
explicit teardown; `0` means "nothing is reachable any more", not "everything was
cleaned up". The backstop is not a teardown route: it emits no `DESTROY`, calls
no `destroy()`, detaches from no group and touches no target.

### Teardown collects failures instead of aborting

**Context.** Cleanup callbacks, `DESTROY` listeners and unsubscribe handles are
application code or belong to a queue the caller does not own. Any of them may
throw, in the middle of a multi-step teardown that cannot be resumed.

**Decision.** Every teardown path runs to completion and collects what was
thrown. A single failure is re-raised unchanged; several become an
`AggregateError` holding them in teardown order.

**Consequence.** One bad listener can no longer strand the resources behind it —
half-destroyed groups, links left fully subscribed, counters that never come back
down. Callers that expect a specific error still get it in the single-failure
case, which is why the lone error is passed through rather than always wrapped.

### One diagnostic channel, no direct console

**Context.** Warnings scattered across modules as `console.warn` cannot be
silenced, redirected or asserted on by a consumer, and are invisible to a test.

**Decision.** `onSignalizeError()` is the general channel; every layer reports
through it, and it falls back to the console itself when nobody listens. Effect
failures go to `onEffectError()` first with their structured payload and reach
the general channel only when that one is unsubscribed, so a handler never sees
the same failure twice.

**Consequence.** `suspicious/noConsole` is an error across `src/`, with two named
exemptions in `biome.json` — the fallback itself, and one report that would
recurse if it went through a handler channel. Every self-authored message carries
the `[signalize] ` prefix at its call site so a single test can check the whole
tree.

### Notices fire once per process, or once per call, by kind

**Context.** A warning inside a render loop is worse than no warning.

**Decision.** A deprecation is a lifecycle fact about a codebase and is reported
at most once per process, per call site. An ignored option is a typo in one call
and is reported every time.

**Consequence.** The two kinds cannot share a mechanism, and a new notice has to
pick a side. A process-wide flag also outlives the test that installed it, which
is why the per-call kind does not use one.

### Delivery is isolated per subscriber

**Context.** eventize's dispatch loop abandons the remaining subscribers when one
of them throws. For a signal write that means the effects behind the failing one
never run, and the links behind it never update.

**Decision.** Writes and destroy notifications open an isolated delivery frame:
each subscriber's failure is caught at the listener that eventize actually calls,
collected, and re-raised after the whole set has been served.

**Consequence.** One throwing effect no longer silences its siblings. Swallowing
is confined to exactly those listener entry points — one frame further out it
would be too late, and anywhere else it would hide a real failure.

### The shipped declarations resolve under `"lib": ["ES2023"]` alone

**Context.** A consumer compiling with plain `"lib": ["ES2023"]` has neither
`lib.dom.d.ts` nor `@types/node`. Every global those two own is unresolvable on
that machine, so a public type naming one turns the shipped `.d.ts` into a
compile error in somebody else's project. `AbortSignal` is the global this API
would otherwise reach for, in `nextValue()` and `asyncValues()`.

**Decision.** The published types name nothing beyond ES2023. Where a platform
type is needed, `types.ts` declares the structural subset the library actually
touches — `AbortSignalLike` for the abort case, with `aborted`, `reason` and the
two listener methods. Every real `AbortSignal`, DOM or Node, satisfies it, so
passing one stays a plain call with no cast on either side.

**Consequence.** No compile run in this repository covers the rule: `smoke/`
inherits `DOM` from the root config, and `checkPkgTypes` resolves the `exports`
map and the module modes, not the lib set. A global slipping back into a public
type would pass every gate here and fail at a consumer. Treat a platform global
in `types.ts` as the change of direction it is.

### No browser test run

**Context.** The package is advertised as running in a modern browser, and there
is no browser job in CI.

**Decision.** Coverage of the browser case sits in *resolution*, not execution:
`attw` checks the `exports` map and the shipped `.d.ts` in `bundler` mode, and
the smoke test runs the built `dist/` with a `tsc`-lowered decorator — the
lowering a consumer's own compiler performs.

**Consequence.** The claim rests on `src/` using no platform-dependent API, which
a periodic grep confirms; the only non-trivial runtime objects in use are
`WeakRef` and `FinalizationRegistry`. A browser run would also skip precisely the
tests whose answer it could change, since the GC specs need an `--expose-gc` flag
no portable browser harness provides. What would overturn this: the first line in
`src/` touching a DOM or Node-only API, or a dedicated browser entry point in the
`exports` map.

### The bundle banner is a pure function of `package.json`

**Context.** Anything ambient that leaks into the banner — a build date, a random,
a clock — makes two builds of the same commit produce different bytes, and a
consumer can no longer verify a published artifact against their own rebuild.

**Decision.** The banner is rendered from `package.json` alone, and `check:banner`
renders it twice under deliberately different ambient state to prove it.

**Consequence.** `pnpm check` fails on a banner that reads a clock, at
module-evaluation time as well as at call time. The guard reaches only the two
banner modules it imports directly; a module-level read buried in something *they*
import would need its own coverage.

## Source layout

| File                       | Responsibility                                              |
| -------------------------- | ----------------------------------------------------------- |
| `index.ts`                 | Public entry — re-exports the `.` API surface               |
| `decorators.ts`            | `@signal` (subpath entry `./decorators`)                    |
| `signal-core.ts`           | Leaf primitives: `isSignal`, `destroySignal`, `signalImpl`, `writeSignal` |
| `collect-errors.ts`        | Leaf below `signal-core.ts` — teardown error collection plus the isolated-delivery frame `writeSignal()` uses |
| `Signal.ts` / `create-signal.ts` | `Signal<T>` wrapper + `SignalImpl` core               |
| `Effect.ts` / `EffectImpl.ts`   | `Effect` wrapper + tracking/rerun core                 |
| `effects.ts`               | `createEffect` plus lifecycle hooks: `onCreateEffect`, `onDestroyEffect`, `onEffectError`, the max-depth setting |
| `effect-hook.ts`           | Leaf holding the internal `createEffect` placeholder — `effects.ts` fills it, `Signal.onChange()` reads it, so a signal-only bundle drops the effect subsystem |
| `signalize-error.ts`       | Leaf — `onSignalizeError`, the fallback diagnostics channel every layer reports through |
| `instances.ts`             | Leaf below `signalize-error.ts` — the multi-copy sentinel that reports when a second copy of the library loads |
| `create-memo.ts`           | `createMemo` — wraps signal + high-priority effect          |
| `link.ts` / `SignalLink.ts`| `link()` / `unlink()` and link classes                      |
| `SignalGroup.ts`           | Lifecycle container                                         |
| `SignalAutoMap.ts`         | Auto-creating `Map<key, Signal>`                            |
| `object-signals.ts`        | Signals attached to host objects (used by decorators)       |
| `global-effect-stack.ts`   | Effect execution context stack                              |
| `global-queues.ts`         | The four global eventize buses                              |
| `batch.ts`, `be-quiet.ts`, `hibernate.ts`, `touch.ts`, `value.ts` | Context modes & helpers |
| `thenable-guard.ts`        | Leaf — the structural `isThenable` test behind the `TypeError` that `batch()`, `beQuiet()` and `hibernate()` throw on a thenable result |
| `constants.ts`             | Symbols (`$signal`, `$effect`, `RECALL`, …)                 |
| `types.ts`                 | Public TypeScript types                                     |
| `UniqIdGen.ts`             | Symbol-based unique ID generator (`Symbol('si1')`, `Symbol('ef1')`) |

Generated artefacts (`lib/`, `dist/`) are not edited by hand.
