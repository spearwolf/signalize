# API reference

Two entry points:

- `@spearwolf/signalize` — everything below except the decorators.
- `@spearwolf/signalize/decorators` — `@signal`.

---

## Signals

### `createSignal<T>(initial?, params?): Signal<T>`

Create a signal.

**`initial`** — initial value, a `() => T` factory (when `lazy: true`), or an
existing signal-like (then this very signal is returned, no new one created).

**`params`** *(`SignalParams<T>`)*:

| Field         | Type                          | Effect                                                              |
| ------------- | ----------------------------- | ------------------------------------------------------------------- |
| `lazy`        | `boolean` (default `false`)   | Treats `initial` as a factory; not evaluated until first read.      |
| `compare`     | `(a, b) => boolean`           | Custom equality. `===` by default.                                  |
| `beforeRead`  | `() => void`                  | Hook called before each tracked read (not on `.value`).             |
| `attach`      | `object \| SignalGroup`       | Attaches the signal to a group; group lifecycle owns it.            |

### `Signal<T>` instance

| Member            | Description                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `get(): T`        | Read **with** dependency tracking.                                                         |
| `get(cb)`         | **Deprecated.** Internally creates an effect with no handle. Use `onChange()` instead.     |
| `value` (getter)  | Read **without** dependency tracking.                                                      |
| `set(v, params?)` | Write. `v` may be a value or, with `{lazy: true}`, a factory.                              |
| `value = v`       | Setter shortcut for `set(v)`.                                                              |
| `touch()`         | Emit a change without changing the value.                                                  |
| `onChange(cb)`    | Subscribe to changes. Returns `() => void` unsubscribe. `cb` runs as a static-deps effect — an effect created inside it is a child effect and is destroyed on the next change (see below). |
| `muted`           | `boolean` getter/setter — pause/resume notifications. Writes still store their value.      |
| `destroy()`       | Destroy the signal (alias for `destroySignal(this)`).                                      |

`set(value, params)` accepts the union of `SignalParams<T>` and:

| Field    | Type      | Effect                                                  |
| -------- | --------- | ------------------------------------------------------- |
| `touch`  | `boolean` | If `true`, emit a notification even when the value is unchanged. |
| `lazy`   | `boolean` | If `true`, store `value` as a factory; evaluate on next read. |

> ⚠️ **No updater function.** `set((v) => v + 1)` stores the function as the
> value (TypeScript prevents this for typed code; runtime accepts it). Use
> `set(sig.value + 1)` instead.

> On a muted or destroyed signal, `set()` still writes: the new value is stored
> and subsequent reads return it — only the notification (including
> `{touch: true}`) is suppressed. See `recipes.md` → *Writes that don't notify*.

### Top-level helpers

| Function                       | Purpose                                                                |
| ------------------------------ | ---------------------------------------------------------------------- |
| `isSignal(v)`                  | `true` for any `Signal`, `SignalReader`, or `SignalLike`.              |
| `destroySignal(...sigs)`       | Destroy one or more signals; subscriptions and groups are cleaned up.  |
| `muteSignal(sig)`              | Suppress notifications without destroying; reads and writes keep working. |
| `unmuteSignal(sig)`            | Resume notifications. Does not replay writes made while muted.         |
| `getSignalsCount()`            | Count of live signals (debugging / leak checks).                       |
| `value(sig \| [obj, key])`     | Untracked read (signal or `[host, name]`).                             |
| `touch(sig \| [obj, key])`     | Force a notify.                                                        |

---

## Effects

### `createEffect(callback, options?): Effect`
### `createEffect(callback, dependencies, options?): Effect`

Create a reactive effect.

**`callback`** — `() => void | (() => void)`. The optional return value is
the cleanup callback; it runs before the next execution and on `destroy()`.
Async callbacks are supported, with two caveats: the cleanup a promise resolves
to is **discarded** if the effect has re-run or been destroyed by the time the
promise settles, and a rejection goes to `onEffectError(cb)` instead of
becoming an unhandled rejection. Details under
[`onEffectError`](#oneffecterrorcb-priority---void) and in
[recipes.md](./recipes.md#async-callbacks-the-cleanup-can-be-dropped).

**`options`** *(`EffectOptions`)*:

| Field          | Type                                | Default | Effect                                                                                                |
| -------------- | ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `autorun`      | `boolean`                           | `true`  | If `false`: callback is not called on creation, and signal changes only flag `shouldRun=true`. Run via `effect.run()`. |
| `dependencies` | `(SignalLike \| string \| symbol)[]`| `—`     | Static deps. Disables automatic tracking. String/symbol deps look up signals by name in the attached group. |
| `priority`     | `number`                            | `0`     | Higher runs first when the same signal change fans out to multiple effects.                           |
| `attach`       | `object \| SignalGroup`             | `—`     | Lifecycle group.                                                                                      |

The shorthand `createEffect(cb, [sigA, sigB])` is equivalent to
`createEffect(cb, {dependencies: [sigA, sigB]})`. With static dependencies the
effect does **not** auto-run on creation — call `.run()` once manually if you
need an initial pass.

Static deps switch off dependency tracking, not the effect context: the
callback still runs as the current effect, so effects created inside it —
directly, or through `Signal.onChange()` — become child effects and are
destroyed before the next rerun and on `destroy()`. Wrap the creation in
`hibernate()` if an inner effect must outlive its parent.

`createMemo()` inside such a callback follows the same child-effect rule for
its internal effect: it is a child and is destroyed with the parent, so the
memo stops recomputing. Without `{attach}`, its signal is destroyed right
along with it — a memo handle that escapes the callback then reads a
destroyed signal, still usable since destroyed signals keep returning the
last value they held, so it reads as a frozen constant. With `{attach}`, a
`SignalGroup` owns the signal instead and it survives — but the memo's
internal effect is *still* a child of the parent and still dies on every
rerun, so an attached memo also freezes, just without losing the signal.
`{attach}` is not an escape hatch for a live memo, only for its last value;
`hibernate()` around the creation is the only way to keep the memo itself
recomputing past the parent's rerun.

> ⚠️ **Recursion guard.** If a callback writes to a signal it depends on,
> `run()` re-enters synchronously. The depth is capped by
> `EffectImpl.maxDepth` (default `256`); beyond that a descriptive `Error`
> is thrown. Tune via `EffectImpl.maxDepth = N`, but prefer breaking the cycle.

### `Effect` instance

| Member     | Description                                                                              |
| ---------- | ---------------------------------------------------------------------------------------- |
| `run()`    | Run the callback if dependencies have changed since the last run; otherwise no-op. Inside a `batch()`, queues the effect. |
| `destroy()`| Mark the effect destroyed, drop subscriptions, notify, then run cleanup and destroy child effects. |

> **Teardown order.** `destroy()` marks the effect as destroyed and
> unsubscribes it from all queues **before** it emits its destroy events and
> **before** the cleanup callback runs. Everything that observes the teardown
> — a cleanup callback, an `onDestroyEffect(cb)` handler — therefore sees an
> effect that no longer reacts: writing to a signal the effect depends on
> triggers no further run, and `run()` is a no-op. Repeated or re-entrant
> `destroy()` calls do nothing. A cleanup that throws propagates to the
> caller of `destroy()`, but the teardown still completes — including the
> child effects, so a failing sibling never leaves a live effect behind. If
> more than one cleanup throws (this effect's and a child's, or several
> children's), the caller gets an `AggregateError` whose `errors` array holds
> every failure in teardown order; a lone error is rethrown unchanged.

### Top-level helpers

| Function                  | Purpose                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `getEffectsCount()`       | Live effect count.                                                                 |
| `onCreateEffect(cb)`      | Subscribe to effect-create events; returns an unsubscribe function.                |
| `onDestroyEffect(cb)`     | Subscribe to effect-destroy events; returns an unsubscribe function. The effect passed to `cb` is already destroyed — `run()` on it does nothing. |
| `onEffectError(cb, priority?)` | Subscribe to *asynchronous* effect failures; returns an unsubscribe function. |

### `onEffectError(cb, priority?): () => void`

```ts
const unsubscribe = onEffectError(({error, effect, effectId, phase}) => {
  report(error, {effect: effectId, phase});
});
```

`cb` receives one `EffectErrorPayload`:

| Field      | Type                        | Meaning                                                     |
| ---------- | --------------------------- | ------------------------------------------------------------ |
| `error`    | `unknown`                   | The rejection reason.                                        |
| `effect`   | `FailingEffect`             | The failing effect — the real instance `onCreateEffect()` hands out, typed down to `{id, destroy()}`. Not the `Effect` returned by `createEffect()`: that is a wrapper, so `payload.effect === myEffect` is `false`. Compare `payload.effectId` instead. |
| `effectId` | `symbol`                    | `effect.id`, handy for log lines.                            |
| `phase`    | `'callback' \| 'cleanup'`   | Which of the two async callbacks rejected.                   |

Only failures that surface *after* the synchronous call stack is gone arrive
here: the promise of an `async` effect callback rejected, or the promise of an
`async` cleanup callback did. A synchronous `throw` keeps propagating to
whoever triggered the run and never reaches this channel.

> ⚠️ **The library will not turn these into unhandled rejections — but your
> handler can.** Node terminates the process on an unhandled rejection by
> default, and an effect that fails on a fetch is the most ordinary thing in
> the world, so the rejection is caught and reported instead. While no
> handler is registered it goes to `console.error` with the effect id;
> registering one replaces that log.
>
> **The handler itself must be synchronous or catch its own errors.** Nothing
> awaits it: `onEffectError(async (p) => { await report(p); })` with a failing
> `report` is an unhandled rejection again, and the process is gone. Wrap the
> send in `.catch()`.

> ⚠️ **A throwing handler stops the dispatch.** A synchronous `throw` out of a
> handler does not escape — its failure and the original error both go to
> `console.error` — but eventize aborts the dispatch there, so handlers with a
> lower priority never see that event. One broken handler can blind the
> monitoring registered behind it. Keep handlers total, and give the one that
> must not miss anything the highest priority.

`priority` is the eventize priority (higher runs first) when several handlers
are registered.

---

## Memos

### `createMemo<T>(computer, options?): SignalReader<T>`

A memo is a signal driven by a high-priority effect. Reading the returned
function tracks the memo as a dependency.

**`computer`** — `() => T`. Any signals read inside become dependencies.

**`options`** *(`CreateMemoOptions`)*:

| Field      | Type                          | Default      | Effect                                                                       |
| ---------- | ----------------------------- | ------------ | ---------------------------------------------------------------------------- |
| `lazy`     | `boolean`                     | `false`      | If `false`, the memo eagerly recomputes on dep change (acts as a computed signal). If `true`, recomputes on read only. |
| `priority` | `number`                      | `1000`       | Higher than default effects so memos resolve first in a flush.               |
| `attach`   | `object \| SignalGroup`       | `—`          | Lifecycle group.                                                             |
| `name`     | `string \| symbol`            | `—`          | Name within the attached group (`group.signal(name)`).                       |

**Eager (default) vs lazy.** Effects that depend on a memo only re-run if the
memo value changes. With `lazy: true` the memo is not evaluated on dep change,
so dependent effects are not notified until something reads the memo.

The internal recompute is wrapped in a `batch()`, so multiple memo writes
inside a single effect propagate cleanly.

**Lifetime when created inside another effect's body.** The memo's internal
effect is registered there as a child effect (see "Effects: dynamic vs static
deps" above) and is destroyed on every parent rerun and on parent
`destroy()`. Without `{attach}`, the memo's *signal* is destroyed right along
with it, instead of being orphaned. With `{attach}`, the group owns the
signal instead, so it survives — the internal effect still dies with the
parent either way. A memo created outside any effect body is unaffected: its
signal lives until destroyed explicitly, or via its group.

---

## Links

A link wires a source signal to a target (signal or callback) one-way. A link
between the same `(source, target)` pair is deduplicated — calling `link()`
again returns the existing link.

### `link<T>(source, target, options?): SignalLink<T>`

- **`source`** — `Signal<T>` or `SignalReader<T>`.
- **`target`** — `Signal<T>`, `SignalReader<T>`, or `(value: T) => void`.
- **`options.attach`** — `object` (lifecycle group).

The target receives the source's current value immediately (`touch()` on
construction).

### `unlink(source, target?)`

Drop a specific `(source, target)` link, or all links from `source` if no
target is given.

### `getLinksCount(source?)`

Total link count, or count for a single source.

### `SignalLink<T>` instance

| Member                  | Description                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| `lastValue`             | Last value propagated.                                                   |
| `source`                | Underlying source signal impl.                                           |
| `isMuted` / `isDestroyed` | State flags.                                                           |
| `mute()` / `unmute()`   | Pause / resume propagation.                                              |
| `toggleMute()`          | Flip mute state; returns the new state.                                  |
| `touch()`               | Force one propagation of the current value.                              |
| `attach(obj)`           | Attach to the group of `obj` for cleanup.                                |
| `destroy()`             | Drop the link and free subscriptions.                                    |
| `nextValue()`           | `Promise<T>` that resolves on the next propagation, rejects on destroy.  |
| `asyncValues(stop?)`    | `AsyncIterable<T>` of propagated values; stops on `stop(value, i) → true` or destroy. |

The link is destroyed automatically when `source` or `target` (if it's a
signal) is destroyed.

**Events** (eventize) emitted on the link object: `'value'`, `'mute'`,
`'unmute'`, `'destroy'`.

---

## Context modes

### `batch(callback)`

Defer effect runs until the outermost batch returns. Effects are deduplicated
and flushed in descending priority order.

> A batch is a *hint*, not a strict guarantee — internal consistency rules can
> still cause partial propagation in edge cases.

### `beQuiet(callback)`

Inside `callback`, signal **reads do not subscribe** the surrounding effect,
and signal **writes do not emit**. Calls nest via an internal counter.

### `isQuiet(): boolean`

`true` while inside any `beQuiet()` frame.

### `hibernate(callback): T`

Suspends *all* outer reactive context (current batch, quiet counter, effect
stack) for the duration of `callback`. Inside, you can start fresh contexts
(`batch`, new effects) — they work normally and are isolated. State is
restored on exit, including after a throw. Stackable.

> If a batch was active, its queued effects are flushed before the callback
> runs (so they aren't lost or re-batched).

---

## SignalGroup

Lifecycle container for signals, effects, links and child groups. Each user
object is associated with at most one group; the registry is a `WeakMap` and
does not pin user objects.

### Static

| Method                              | Purpose                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `SignalGroup.findOrCreate(obj)`     | Get or create the group attached to `obj`. Passing a group returns it as-is. Throws on `null`. |
| `SignalGroup.get(obj)`              | Existing group, or `undefined`.                                                |
| `SignalGroup.delete(obj)`           | Clear and remove the group.                                                    |
| `SignalGroup.clear()`               | Clear all groups globally.                                                     |
| `SignalGroup.destroy(obj)`          | **Deprecated.** Use `delete()`.                                                |
| `getSignalGroupsCount()`            | Count of live `SignalGroup` instances (debugging / leak checks).               |

When a user object becomes unreachable without an explicit `clear()` / `delete()`,
a `FinalizationRegistry` callback runs `clear()` on the orphaned group. FR
firing is non-deterministic — explicit cleanup remains preferred.

### Instance

| Method                                  | Purpose                                                                |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `attachSignal(sig)`                     | Add a signal; group destroys it on `clear()`.                          |
| `attachSignalByName(name, sig?)`        | Add and register a name. Pass `undefined` to drop the name only.       |
| `detachSignal(sig)`                     | Remove a signal (does **not** destroy it).                             |
| `hasSignal(name)`                       | Lookup walks parent chain.                                             |
| `signal<T>(name)`                       | Returns the named `Signal<T>` (parent fallback) or `undefined`.        |
| `attachEffect(eff)` / `runEffects()`    | Track an effect / run all attached and child effects.                  |
| `attachLink(link)` / `detachLink(link)` | Track / untrack a link.                                                |
| `attachGroup(child)` / `detachGroup(child)` | Nest groups.                                                       |
| `off()`                                 | Destroy attached effects/links and drop all external subscriptions on group signals; signals stay alive, the group remains reusable. Child groups are `off()`'d recursively. Emits an `OFF` event. |
| `clear()`                               | Destroy all attached signals / effects / links and child groups, detach from parent, remove from registry. |
| `destroy()`                             | **Deprecated.** Use `clear()`.                                         |

---

## SignalAutoMap

Auto-creating `Map<string|symbol, Signal>`. Useful for prop-style dynamic keys.

### Constructors / factories

```ts
new SignalAutoMap()
SignalAutoMap.fromProps<P>(obj: P, keys?: (keyof P)[])
```

### Methods

| Method                                  | Behaviour                                                              |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `get<T>(key): Signal<T>`                | Returns existing signal or creates one (initial value `undefined`).    |
| `has(key): boolean`                     | Membership check.                                                      |
| `update(map: Map)`                      | Apply a `Map` of values; missing keys are created. Wrapped in `batch()`. |
| `updateFromProps(obj, keys?)`           | Apply object props; missing keys created. Wrapped in `batch()`.        |
| `keys()` / `signals()` / `entries()`    | Iterators.                                                             |
| `clear()`                               | Destroy all signals and empty the map.                                 |

> If a stored signal is destroyed externally via `destroySignal()`, the map
> still holds a reference: reads return its last value, and writes still update
> that value — they just never notify anyone.

---

## Object signals

Signals stored on a host object by name (used by `@signal`).

| Function                                | Returns                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `findObjectSignalByName(obj, name)`     | `Signal<T> \| undefined`.                                                |
| `findObjectSignals(obj)`                | `Signal[] \| undefined`.                                                 |
| `findObjectSignalNames(obj)`            | `(string \| symbol)[] \| undefined`.                                     |
| `destroyObjectSignals(...objs)`         | Destroy all signals attached to each object.                             |

---

## Decorators

```ts
import {signal} from '@spearwolf/signalize/decorators';
```

> Standard TC39 decorators only. No `experimentalDecorators`.

### `@signal(options?)` — accessor decorator

Turns a class field declared with `accessor` into a per-instance signal.

| Option        | Type                          | Effect                                                                 |
| ------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `name`        | `string \| symbol`            | Override the registered name (defaults to the field name).             |
| `readAsValue` | `boolean` (default `false`)   | If `true`, the property getter returns the value **untracked** (`.value`). Otherwise it tracks (`.get()`). |
| `compare`     | `(a, b) => boolean`           | Custom equality.                                                       |
| `beforeRead`  | `() => void`                  | Hook on each tracked read.                                             |
| `attach`      | `object \| SignalGroup`       | Override the default group (the instance).                             |

Each instance gets its own signal. The signal is registered in
`SignalGroup.findOrCreate(this)` under `name`.

For a class-bound derived value, use `createMemo()` with `{attach: this}` —
there is no memo decorator.

---

## Types

Exported from `@spearwolf/signalize`:

| Type                         | Meaning                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| `Signal<T>`                  | The reactive object returned by `createSignal()`.                |
| `SignalReader<T>`            | The callable form of `signal.get` (also a `SignalLike<T>`).      |
| `SignalWriter<T>`            | The callable form of `signal.set`.                               |
| `SignalLike<T>`              | Branded interface — anything carrying `[$signal]`.               |
| `SignalParams<T>`            | Options for `createSignal` (`lazy`, `compare`, `beforeRead`, `attach`). |
| `SignalWriterParams<T>`      | Options for `set()` (extends `SignalParams`, adds `touch`).      |
| `Effect`                     | The wrapper returned by `createEffect()`.                        |
| `EffectOptions`              | Options for `createEffect`.                                      |
| `EffectCallback`             | `() => void \| (() => void)`.                                    |
| `CreateMemoOptions`          | Options for `createMemo`.                                        |
| `SignalLink<T>`, `ValueCallback<T>` | Link types.                                               |
| `CompareFunc<T>`             | `(a: T, b: T) => boolean`.                                       |
| `BeforeReadFunc`             | `() => void`.                                                    |
| `VoidFunc`                   | `() => void`.                                                    |
| `ValueChangedCallback<T>`    | `(value: T) => void \| (() => void)`.                            |

From `@spearwolf/signalize/decorators`:
`SignalDecoratorOptions`, `SignalReaderDecoratorOptions`.
