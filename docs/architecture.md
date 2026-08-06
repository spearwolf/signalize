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
| **SignalGroup** | `new SignalGroup()` | Lifecycle bundle. Clearing the group destroys everything attached to it.  |

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

## Synchronous everything

`emit()` calls every subscriber inline before returning. This means a
`signal.set()` triggers all dependent effects before the next line of user code
runs. Predictable, but it's also why the library guards against recursion:
an effect that synchronously writes to a signal it depends on re-enters
`run()`. Up to `EffectImpl.maxDepth` (default 256) levels are tolerated;
beyond that, `run()` throws a descriptive `Error` instead of overflowing the
JS stack.

## Global event buses

All cross-cutting communication uses four global eventize buses
(`src/global-queues.ts`):

| Queue                       | Carries                                     |
| --------------------------- | ------------------------------------------- |
| `globalSignalQueue`         | Signal value changes (`emit(queue, signalId, value)`) |
| `globalDestroySignalQueue`  | Signal destruction                          |
| `globalEffectQueue`         | Effect lifecycle (`$createEffect`, `$destroyEffect`, `RECALL`) |
| `globalEffectCalledQueue`   | Batch deduplication                         |

Effects subscribe to signal IDs they read; signals emit on change. Nothing else.

**Symbol namespacing:** All internal `Symbol.for` keys use the `@spearwolf/signalize/` namespace
prefix (`signal`, `effect`, `recall`, `destroySignal`, `createEffect`, `destroyEffect`) to
prevent collisions with unrelated code. The namespace carries no major version so that two
versions of the library loaded in the same process continue to recognize each other's signals —
otherwise, a stray `Symbol.for('signal')` in application code would pass `isSignal()` with
incorrect metadata.

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
- `SignalGroup.delete(obj)` is the public destructor. The instance method is
  `group.clear()` (the older `destroy()` is deprecated and warns).
- Groups can nest via `attachGroup()`. Named signal lookup
  (`group.signal(name)`) walks up the parent chain.

## Decorators

`@signal` (subpath `@spearwolf/signalize/decorators`) uses the
TC39 standard form (`accessor` keyword, stage-3 semantics).

- Each instance of a decorated class implicitly owns a `SignalGroup` keyed by
  the instance — destroying the group via `SignalGroup.delete(instance)` or
  `destroyObjectSignals(instance)` cleans up.
- There is no memo decorator; a class-bound derived value is a
  `createMemo(..., {attach: this})` in the class body.

## Source layout

| File                       | Responsibility                                              |
| -------------------------- | ----------------------------------------------------------- |
| `index.ts`                 | Public entry — re-exports the `.` API surface               |
| `decorators.ts`            | `@signal` (subpath entry `./decorators`)                    |
| `signal-core.ts`           | Leaf primitives: `isSignal`, `destroySignal`, `signalImpl`, `writeSignal` |
| `Signal.ts` / `createSignal.ts` | `Signal<T>` wrapper + `SignalImpl` core                |
| `Effect.ts` / `EffectImpl.ts`   | `Effect` wrapper + tracking/rerun core                 |
| `createMemo.ts`            | `createMemo` — wraps signal + high-priority effect          |
| `link.ts` / `SignalLink.ts`| `link()` / `unlink()` and link classes                      |
| `SignalGroup.ts`           | Lifecycle container                                         |
| `SignalAutoMap.ts`         | Auto-creating `Map<key, Signal>`                            |
| `object-signals.ts`        | Signals attached to host objects (used by decorators)       |
| `globalEffectStack.ts`     | Effect execution context stack                              |
| `global-queues.ts`         | The four global eventize buses                              |
| `batch.ts`, `bequiet.ts`, `hibernate.ts`, `touch.ts`, `value.ts` | Context modes & helpers |
| `constants.ts`             | Symbols (`$signal`, `$effect`, `RECALL`, …)                 |
| `types.ts`                 | Public TypeScript types                                     |

Generated artefacts (`lib/`, `dist/`) are not edited by hand.
