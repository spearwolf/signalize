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
`getSignalsCount()` to `-1`. Since ARCH-001 this is no longer silent: loading the second copy is
reported once through [`onSignalizeError()`](./api.md#onsignalizeerrorcb-priority---void) with
`source: 'multiple-instances'` and the load paths of both copies (`src/instances.ts`).

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
| `signalize-error.ts`       | Leaf — `onSignalizeError`, the fallback diagnostics channel every layer reports through (CONS-001) |
| `instances.ts`             | Leaf below `signalize-error.ts` — the multi-copy sentinel that reports when a second copy of the library loads (ARCH-001) |
| `create-memo.ts`           | `createMemo` — wraps signal + high-priority effect          |
| `link.ts` / `SignalLink.ts`| `link()` / `unlink()` and link classes                      |
| `SignalGroup.ts`           | Lifecycle container                                         |
| `SignalAutoMap.ts`         | Auto-creating `Map<key, Signal>`                            |
| `object-signals.ts`        | Signals attached to host objects (used by decorators)       |
| `global-effect-stack.ts`   | Effect execution context stack                              |
| `global-queues.ts`         | The four global eventize buses                              |
| `batch.ts`, `be-quiet.ts`, `hibernate.ts`, `touch.ts`, `value.ts` | Context modes & helpers |
| `constants.ts`             | Symbols (`$signal`, `$effect`, `RECALL`, …)                 |
| `types.ts`                 | Public TypeScript types                                     |
| `UniqIdGen.ts`             | Symbol-based unique ID generator (`Symbol('si1')`, `Symbol('ef1')`) |

Generated artefacts (`lib/`, `dist/`) are not edited by hand.
