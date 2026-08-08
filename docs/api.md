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

> **A failing effect no longer costs its siblings their notification.**
> `set()` runs *every* subscribed effect before it returns — including the
> ones with a lower priority than the one that threw — and only then
> re-raises what failed: a single failure unchanged, several as an
> `AggregateError` in delivery order. Wrap the write in `try`/`catch` if
> effect failures are expected; the value is written and delivered either
> way. The exception is a throwing `link()` callback, which is not an
> effect and does end the delivery — the failures collected before it are
> still re-raised together with it.

### Top-level helpers

| Function                       | Purpose                                                                |
| ------------------------------ | ---------------------------------------------------------------------- |
| `isSignal(v)`                  | `true` for any `Signal`, `SignalReader`, or `SignalLike`.              |
| `destroySignal(...sigs)`       | Destroy one or more signals; subscriptions and groups are cleaned up.  |
| `muteSignal(sig)`              | Suppress notifications without destroying; reads and writes keep working. |
| `unmuteSignal(sig)`            | Resume notifications. Does not replay writes made while muted.         |
| `getSignalsCount()`            | Count of live signals — created, not destroyed, still reachable. Self-corrects once a dropped signal is collected, at a time you cannot observe or force (debugging / leak checks). |
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
to runs **late** — right when the promise settles, not stored as the next
cleanup — if the effect has re-run or been destroyed by the time the promise
settles, and a rejection goes to `onEffectError(cb)` instead of becoming an
unhandled rejection. Details under
[`onEffectError`](#oneffecterrorcb-priority---void) and in
[recipes.md](./recipes.md#async-callbacks-the-cleanup-runs-late).
The synchronous case knows the same rule: a run that a re-entrant self-write
overtook executes its cleanup at once instead of putting it in the slot, so an
effect writing a signal it depends on gets the cleanup of **every** nested run,
not only the oldest.
A synchronous throw out of the callback arrives at whoever triggered the run —
`set()`, `touch()`, `batch()`, `effect.run()` — but it no longer holds up the
other effects of that same write; they all run first, and the failure (or an
`AggregateError` over several of them) is re-raised afterwards. The effect
itself stays usable: it keeps its dependencies and runs again on the next
change.

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
need an initial pass. The declared set is re-subscribed at the start of *every*
run, so a subscription taken away by `SignalGroup.off()` comes back with the
effect's next run — the same moment a dynamic effect gets it back by reading the
signal again. A destroyed dependency is skipped, whether it was already
destroyed when the effect was created or died later: a destroyed signal wakes
nobody, so subscribing to it would only keep the effect alive as a deaf shell.

A string/symbol dependency that cannot be resolved to a signal throws
synchronously, before the effect is created — either because no group is
attached at all (`attach` is missing), or because the name is not registered
in the attached group. Both errors name the dependency, e.g.
`createEffect(cb, ['missing'], {attach: obj})` throws `cannot resolve
dependency "missing" — no signal with that name is registered in the attached
SignalGroup`. The TypeScript overloads require `attach` whenever
`dependencies` contains a string/symbol, so the missing-group case only
surfaces to callers that bypass the type system.

Static deps switch off dependency tracking, not the effect context: the
callback still runs as the current effect, so effects created inside it —
directly, or through `Signal.onChange()` — become child effects and are
destroyed before the next rerun and on `destroy()`. Wrap the creation in
`hibernate()` if an inner effect must outlive its parent.

`createMemo()` inside such a callback follows the same child-effect rule for
its internal effect: it is a child and is destroyed with the parent, so the
memo stops recomputing. Its signal is destroyed right along with it, with or
without `{attach}` — a memo handle that escapes the callback then reads a
destroyed signal, still usable since destroyed signals keep returning the
last value they held, so it reads as a frozen constant. `{attach}` gives the
signal a `SignalGroup` membership and, optionally, a name; it does not take
the signal out of the creating effect's ownership, so it dies on the same
rerun the effect does, same as an unattached one. `{attach}` is not an escape
hatch for a live memo — it no longer even saves the last value; `hibernate()`
around the creation is the only way to keep the memo itself recomputing past
the parent's rerun.

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
| `onEffectError(cb, priority?)` | Subscribe to effect failures with no caller left to throw at (async rejections, plus stale synchronous cleanups); returns an unsubscribe function. |

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
| `phase`    | `'callback' \| 'cleanup'`   | Which callback failed — `cleanup` also covers a stale synchronous throw with no legitimate owner to catch it. |

Failures land here when there is no legitimate caller left to throw at — most
often because the call stack that triggered them is long gone: the promise of
an `async` effect callback rejected, or the promise of an `async` cleanup
callback did. A synchronous `throw` from a cleanup that is still running as
part of `run()` or `destroy()` normally keeps propagating to whoever triggered
it instead — except a stale cleanup: one whose run was superseded (also
synchronously, by a re-entrant self-write) or whose effect is already
destroyed by the time it runs, sync or not, has no such
caller left to throw at even with a full stack still present, so it lands here
too, with `phase: 'cleanup'`.
A **synchronous** throw out of an effect *callback* explicitly does **not**
land here: it is collected until the delivery is complete and then thrown at
whoever wrote the signal. If you want every failure in one place, catch at the
write.

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
| `batchWrites` | `boolean`                   | `false`      | Wrap the recompute in `batch()`. See below — this is a trade-off, not a free upgrade. |

**Eager (default) vs lazy.** Effects that depend on a memo only re-run if the
memo value changes. With `lazy: true` the memo is not evaluated on dep change,
so dependent effects are not notified until something reads the memo.

**`batchWrites`.** By default the recompute writes the memo's signal directly,
no `batch()` involved. Set `batchWrites: true` only if `computer` itself
writes to *other* signals as a side effect (uncommon — `computer` is meant to
read and return, not write) — the batch then groups those writes with the
memo's own write so a downstream effect depending on both sees one
consistent run instead of one per write with a torn intermediate value.

That grouping has a real cost: any effect's run is deferred while a batch is
open, including another memo's recompute triggered by reading it — reading a
*composed* memo (a normal, common pattern) from inside a `batchWrites: true`
callback can return that memo's stale, pre-recompute value instead of a
fresh one. For a `{lazy: true}` memo read this way, the staleness can persist
indefinitely — a lazy memo's deferred run is a no-op (it only marks itself
dirty), so nothing but a later direct, unbatched read forces it to catch up.
This is why the default is `false`: composed memos are the common case,
side-effect-writing callbacks are not.

**Lifetime when created inside another effect's body.** The memo's internal
effect is registered there as a child effect (see "Effects: dynamic vs static
deps" above) and is destroyed on every parent rerun and on parent
`destroy()`. The memo's *signal* is destroyed right along with it, with or
without `{attach}` — `{attach}` gives the signal a `SignalGroup` membership
and, optionally, a name, but not a lifetime of its own, so it does not
survive the parent rerun, the parent's `destroy()`, or a `group.off()` on
the attached group. A memo created outside any effect body is unaffected:
its signal lives until destroyed explicitly, or via its group.

---

## Links

A link wires a source signal to a target (signal or callback) one-way. A link
between the same `(source, target)` pair is deduplicated — calling `link()`
again returns the existing link.

### `link<T>(source, target, options?): SignalLink<T>`

- **`source`** — `Signal<T>` or `SignalReader<T>`. Throws if it is not a signal.
- **`target`** — `Signal<T>`, `SignalReader<T>`, or `(value: T) => void`.
- **`options.attach`** — `object` (lifecycle group).

The target receives the source's current value immediately (`touch()` on
construction).

Calling `link()` again for a `(source, target)` pair that already has a link
returns the existing instance — it does **not** create a second one. If that
repeat call passes `options.attach`, the existing link is attached to that
group *too*, in addition to whatever it was already attached to; the group
isn't ignored. A link attached to several groups is destroyed as soon as any
one of them clears — it doesn't wait for all of them.

**Lifetime.** A link is held by an internal registry keyed on its source
signal until one of four things happens: `link.destroy()`, `unlink(source,
target?)`, a `{attach}` group being cleared, or the source or a signal target
being destroyed. Garbage collection alone is not a fifth way — a link on a
still-live source is not reclaimed, no matter how thoroughly its return value
is dropped. A link that becomes unreachable *together with* its source does
get its subscriptions on the two global queues released by an internal
finalizer these days, not just its entry in the count — but that is a
backstop for links nobody can reach any more, and it can be neither scheduled
nor observed. A long-lived source that keeps accumulating fresh links without
ever tearing the old ones down grows this registry without bound, and every
write to that source gets linearly slower as it grows. At 1000 links on one
source, `link()` says so once, via `console.warn` — a diagnostic, not a
limit: nothing is thrown and nothing is refused.

### `unlink(source, target?)`

Drop a specific `(source, target)` link, or all links from `source` if no
target is given.

### `getLinksCount(source?)`

Total link count, or count for a single source. Counts exactly the links
held by the registry above. While its source is reachable, a link never
drops out of this count through garbage collection alone — only `destroy()`,
`unlink()`, a cleared `{attach}` group, or destroying the source/target does
that, and each of those also releases the link's own subscriptions. If a
link becomes unreachable *together with* its source instead, the count is
eventually corrected too — nondeterministically, but subscriptions included
— see `link.ts`'s `gLinkFinalizer`.

### `SignalLink<T>` instance

| Member                  | Description                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| `lastValue`             | Last value announced — see the note below on re-entrant propagation.     |
| `source`                | Underlying source signal impl.                                           |
| `isMuted` / `isDestroyed` | State flags.                                                           |
| `mute()` / `unmute()`   | Pause / resume propagation.                                              |
| `toggleMute()`          | Flip mute state; returns the new state.                                  |
| `touch()`               | Force one propagation of the current value.                              |
| `attach(obj)`           | Attach to the group of `obj` for cleanup. Safe to repeat: it re-establishes membership every call (so it undoes an intervening `detachLink()`), and never registers a second cleanup listener for the same group — which holds for a direct `group.attachLink(link)` too. |
| `destroy()`             | Drop the link and free subscriptions.                                    |
| `nextValue(options?)`   | `Promise<T>` that resolves on the next propagation, rejects with an `Error` if the link is destroyed first. |
| `asyncValues(stop?, options?)` | `AsyncIterable<T>` of propagated values; stops on `stop(value, i) → true` or destroy. |

The link is destroyed automatically when `source` or `target` (if it's a
signal) is destroyed.

### `nextValue(options?)` / `asyncValues(stop?, options?)`

`options.signal` — an `AbortSignal` — aborts the wait: an already-aborted
signal rejects immediately, and one that aborts while a value is pending
rejects at that point, with the signal's `reason`. `asyncValues()` forwards
the same `options` to every internal `nextValue()` call, but does **not**
end the same way `nextValue()` does: an abort makes the loop **throw** the
abort reason out of the `for await`, instead of ending it quietly. The link
being destroyed still ends the loop quietly, same as `stop(value, i) →
true` — only an externally requested abort is meant to be distinguishable
from a normal stop.

A link destroyed while a `nextValue()` is pending rejects with
`Error('SignalLink destroyed before the next value arrived')` — not
`undefined` — so a `catch` block has something to inspect.

`asyncValues()` only ever holds the **last** propagated value — it is a
sampler, not a lossless stream. Several `asyncValues()` iterators can run
over the same link concurrently; they share that one retained slot, and it
is only released once the *last* of them stops (finishes, breaks, or is
`.return()`ed) — an earlier one finishing does not cut a still-running
sibling off from the next value. Released means switched off, not just
emptied: once the last iterator is gone, `'value'` is no longer retained at
all, so a later `nextValue()` waits for the next value instead of resolving
with one that arrived while nobody was iterating. The other side of that
coin — `asyncValues()` claims the retain policy of the `'value'` event for
itself and gives it up at the end, so a `retain(link, 'value')` you set
yourself does not survive an `asyncValues()` run.

**Re-entrant propagation.** If `action()` — the link callback, or an effect
on the target signal — writes the source again, the nested propagation runs
to completion first. The outer one then gives up silently: it emits no
`'value'` and leaves `lastValue` alone, because its value no longer exists
on either signal. A consumer therefore sees values monotonically in write
order and never a regression to an older one. The same holds if `action()`
destroys the link: the link no longer throws out of the `signal.set()` that
started the propagation, and `lastValue` stays `undefined`.

**Events** (eventize) emitted on the link object: `'value'`, `'mute'`,
`'unmute'`, `'destroy'`. A `'destroy'` listener already sees the link with
`isDestroyed === true`, so an `on()` listener that calls `destroy()` again
hits the method's guard and does nothing, instead of recursing.

---

## Context modes

### `batch(callback)`

Defer effect runs until the outermost batch returns. Effects are deduplicated
and flushed in descending priority order.

> A batch is a *hint*, not a strict guarantee — internal consistency rules can
> still cause partial propagation in edge cases.

`callback` must be synchronous. `batch()` only sees signal writes made on the
current call stack — an `async` callback returns a pending `Promise` at its
first `await`, at which point `batch()` closes the batch and everything after
that `await` runs unbatched, with no error. To catch this early, `batch()`
throws `TypeError` if `callback` returns a thenable, and its signature rejects
an `async` callback (or anything typed to return `Promise`/`PromiseLike`) at
`tsc` time. Writes made before the check — i.e. everything the callback did
synchronously before returning — are still flushed; only what runs after the
callback returns is left unbatched.

This is a synchronous throw at the `batch()` call site, unlike an async
*effect* callback's rejection, which cannot be thrown at any caller and goes
to `onEffectError()` instead (see `createEffect`).

An effect that throws during the flush no longer holds up the remaining
delayed effects; its failure reaches the `batch()` caller after the flush is
complete, several failures as an `AggregateError`.

### `beQuiet(callback): T`

Inside `callback`, signal **reads do not subscribe** the surrounding effect,
and signal **writes do not emit**. Calls nest via an internal counter.

`beQuiet()` returns whatever `callback` returns, and — like `batch()` —
rejects an `async`/thenable-returning `callback` at compile time, because the
quiet frame closes at the first `await`.

Wrapping a **whole effect run** in a quiet frame does not change that effect's
dependency set — unlike the ordinary case above, where a `beQuiet()` around a
single read inside a tracked run is exactly what drops that one signal from the
set. An effect you run inside the frame — the `{autorun: false}` case —
executes its callback and keeps the dependencies it had; its reads in that run
count as little as any other read in the frame, and the set realigns on the
next tracked run. »Whole run« means the frame is opened around `run()` from
outside: a callback that wraps its own entire body instead starts as a tracked
run, records nothing, and therefore drops **all** its dependencies at the end
of that run. An
effect **created** inside a quiet frame subscribes to nothing and never runs
again: use `hibernate()` to step out of the frame when a run is meant to track.

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
| `SignalGroup.clear()`               | Clear all groups globally. Sweeps to the end even if a group's teardown throws; a group created *during* the sweep (typically from a `DESTROY` listener) survives it and stays registered — still counted by `getSignalGroupsCount()`, still reachable by the next `clear()`. |
| `SignalGroup.destroy(obj)`          | **Deprecated.** Use `delete()`.                                                |
| `getSignalGroupsCount()`            | Count of live `SignalGroup` instances (debugging / leak checks). A group that has been garbage-collected with its host is not counted. |

Errors from individual groups are collected and reported after the full sweep —
a single one unchanged, several as an `AggregateError` in sweep order.

When a user object becomes unreachable without an explicit `clear()` / `delete()`,
a `FinalizationRegistry` callback runs `clear()` on the orphaned group. Nothing
in `SignalGroup` itself blocks that any more: the registry of live groups, the
registry's held value and the per-signal subscription on the global destroy
queue all know a group through a `WeakRef`. A host whose only back-reference is
a signal value — the `@signal() accessor self = this` shape — is reclaimed
together with its group. Measured: 1000 of 1000 such hosts survived a `gc()`
before, 0 of 1000 after.

What still blocks it is an **attached effect whose callback closure captures the
object**. An effect is reachable from the global effect queue from the moment it
is created until it is destroyed — that is how a write reaches it — so whatever
its closure holds is held for as long as the effect lives. The group has nothing
to do with it: 200 effects created with no group at all pin their hosts just the
same, and `effect.destroy()` releases all of them. Measured over 500 groups:
signal value 500 → 0, effect closure 500 → 500.

A group that is collected together with its host **has not seen `clear()`**. It
emits no `DESTROY` event, and its signals are not destroyed but collected with
it. Code that hangs cleanup off a group's `DESTROY` is hanging it off an event
the GC path does not deliver; `getSignalsCount()` still comes back down, because
each signal corrects the counter from its own finalizer. FR firing is
non-deterministic in any case — explicit `delete()` / `group.clear()` remains the
one path you can schedule. If that teardown throws, the error is reported via
`console.error` and never re-raised: a registry callback has no caller left to
receive it.

### Instance

| Method                                  | Purpose                                                                |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `attachSignal(sig)`                     | Add a signal; group destroys it on `clear()`.                          |
| `attachSignalByName(name, sig?)`        | Add and register a name. The name is the group's only hold on the signal unless `attachSignal()` was called for it too — so rebinding the name **destroys** the signal it displaces. Exempt: signals held by another name, and explicitly attached ones. Passing `undefined` releases the name the same way. |
| `detachSignal(sig)`                     | Remove a signal (does **not** destroy it).                             |
| `hasSignal(name)`                       | Lookup walks parent chain.                                             |
| `signal<T>(name)`                       | Returns the named `Signal<T>` (parent fallback) or `undefined`.        |
| `attachEffect(eff)` / `runEffects()`    | Track an effect / run all attached and child effects.                  |
| `attachLink(link)` / `detachLink(link)` | Track / untrack a link. A destroyed link takes itself out of the group, whichever route attached it. |
| `attachGroup(child)` / `detachGroup(child)` | Nest groups. `attachGroup()` throws when the edge would create a cycle — attaching a group to itself, or to one of its own descendants. |
| `off()`                                 | Destroy attached effects/links and drop all external subscriptions on group signals — an external effect that survives the detach re-subscribes on its next run, static deps as well as dynamic ones; signals stay alive, the group remains reusable — except a memo signal `{attach}`ed inside an effect body, which belongs to that effect and dies with it. Child groups are `off()`'d recursively. Emits an `OFF` event. |
| `clear()`                               | Destroy all attached signals / effects / links and child groups, detach from parent, remove from registry. |
| `destroy()`                             | **Deprecated.** Use `clear()`.                                         |

The five walks over the group graph — `hasSignal()`, `signal()`, `runEffects()`,
`off()`, `clear()` — refuse to re-enter a group they are already walking. A
`DESTROY` listener that calls `clear()` again, or an `OFF` listener calling
`off()`, gets a no-op instead of a blown stack.

> **Teardown errors.** `clear()` and `off()` finish the entire teardown
> before they report a failure. A cleanup callback that throws, or a
> `DESTROY`/`OFF` listener that does, no longer aborts what comes after it.
> For `clear()`: sibling effects are still destroyed, signals still torn
> down, links still released, the group is still deregistered. For `off()`:
> sibling effects are still destroyed, links still released and external
> subscriptions still dropped — signals stay alive and the group stays
> registered either way, as usual for `off()` — and it still emits its `OFF`
> event. Either way the failures are collected and raised afterwards: a lone
> one unchanged, several as an `AggregateError` whose `errors` array holds
> them in teardown order. The one place they are not raised is the
> `FinalizationRegistry` path described above, where they go to
> `console.error` instead.

Destroying a signal directly — `signal.destroy()` or `destroySignal(sig)` —
also takes it out of the group that held it, name included: `hasSignal(name)`
turns `false` and `signal(name)` returns `undefined` rather than the destroyed
signal. If another signal is still a candidate for that name, it takes the slot
over by the same rule `detachSignal()` uses. The same applies to attached
effects: a destroyed effect leaves the group's set by itself instead of sitting
there until the next `clear()`.

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
| `delete(key): boolean`                  | Destroy `key`'s signal and drop the entry; `true` if present.          |

> If a stored signal is destroyed externally via `destroySignal()`, its entry
> leaves the map in the same synchronous turn: `has(key)` is `false`
> immediately afterwards, and `get(key)` creates a fresh, live signal instead
> of handing back the corpse. Whoever kept the `Signal` object still holds
> it — reads return the last value and writes update it without notifying
> anyone — but the map is no longer involved. Consequently `delete(key)` on
> such a key reports `false`: there is nothing left to remove. A soft detach
> (`SignalGroup#off()`) is not a destruction and leaves the entry alone.
>
> `delete(key)` drops the entry, then destroys the signal — so an effect
> cleanup that runs as part of that destroy can call `get(key)` again and get
> a fresh, live signal. That signal stays in the map: `has(key)` is `true`
> again once `delete()` returns.

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
