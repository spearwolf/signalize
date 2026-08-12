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
| `lazy`        | `boolean` (default `false`)   | Treats `initial` as a factory; not evaluated until first read. Required for that form, and it has to be statically `true` — `createSignal<T>(fn)` without it does not compile, and neither does a params *variable* typed `SignalParams<T>` (see below). |
| `compare`     | `(a, b) => boolean`           | Custom equality. `===` by default.                                  |
| `beforeRead`  | `() => void`                  | Hook called before each tracked read (not on `.value`).             |
| `attach`      | `object \| SignalGroup`       | Attaches the signal to a group; group lifecycle owns it.            |

### `Signal<T>` instance

| Member            | Description                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `get(): T`        | Read **with** dependency tracking.                                                         |
| `get(cb)`         | **Deprecated.** Internally creates an effect with no handle. Use `onChange()` instead.     |
| `value` (getter)  | Read **without** dependency tracking.                                                      |
| `set(v, params?)` | Write. `v` may be a value or, with `{lazy: true}`, a factory — and only with it; a bare factory is a compile error, and so is a plain value carrying `{lazy: true}`. |
| `value = v`       | Setter shortcut for `set(v)`.                                                              |
| `touch()`         | Emit a change without changing the value.                                                  |
| `onChange(cb)`    | Subscribe to changes. Returns `() => void` unsubscribe. `cb` runs as a static-deps effect, so it does **not** fire on subscribe — an effect created inside it is a child effect and is destroyed on the next change (see below). |
| `muted`           | `boolean` getter/setter — pause/resume notifications. Writes still store their value.      |
| `destroyed`       | `boolean` getter — `true` once the signal has been destroyed. It stays usable as a plain value container; it just no longer notifies. |
| `destroy()`       | Destroy the signal (alias for `destroySignal(this)`).                                      |

`set(value, params)` accepts the union of `SignalParams<T>` and:

| Field    | Type      | Effect                                                  |
| -------- | --------- | ------------------------------------------------------- |
| `touch`  | `boolean` | If `true`, emit a notification even when the value is unchanged. |
| `lazy`   | `boolean` | If `true`, store `value` as a factory; evaluate on next read. Required for the factory form — `set(fn)` without it does not compile — and reserved for it: `set(v, {lazy: true})` on a plain value does not compile either. |

> ⚠️ **No updater function.** `set((v) => v + 1)` stores the function as the
> value. Use `set(sig.value + 1)` instead. Since TYPE-002 the nullary form
> `set(() => 42)` is rejected too — a factory needs `{lazy: true}` — so both
> shapes are compile errors and the storing behaviour is reachable only from
> untyped JS.

> ⚠️ **The factory form wants a literal `{lazy: true}`, not a variable.** Both
> overload sets discriminate on the *value* argument, and the factory branch
> only opens for a `lazy` that is statically `true`. `SignalParams<T>` and
> `SignalWriterParams<T>` declare `lazy?: boolean`, so a variable of either
> type keeps the branch shut and reports `TS2769` — even when it holds
> `{lazy: true}`. Four spellings satisfy it: the inline literal, `{lazy: true}
> as const`, an annotation of `SignalParams<T> & {lazy: true}`, and — the one
> nobody writes on purpose — `{lazy: flag}` where control flow has narrowed
> `flag` to `true`, which a `const flag: boolean = true` already does.
> Spreading (`{...params}`) does not — the spread keeps `lazy?: boolean`.

> ⚠️ **`set()` reserves that flag for the factory, and names its options
> exactly.** A params *variable* typed `SignalParams<T>` or
> `SignalWriterParams<T>` stays welcome on the value branch of both
> constructors: `createSignal(v, params)` and `set(v, params)` compile whatever
> the variable holds at runtime, for the same reason it does not open the
> factory branch — `lazy?: boolean` promises nothing either way. What `set`
> turns away there is each of the four statically-`true` spellings above, every
> one a `TS2769` on a plain value, because that flag promises a factory
> (BUG-014) — and any params type whose keys reach past
> `SignalWriterParams<T>`.
>
> The two constructors are **not** symmetric on that second point.
> `createSignal` still relies on freshness, so it catches a stray key only in
> an object *literal*: `createSignal(5, {lazy: false, labell: 'x'})` is an
> error, while `createSignal(5, myOpts)` with `interface MyOpts extends
> SignalParams<number> {label: string}` compiles, and so does a variable whose
> inferred type picked up the stray key. `set` forbids the keys in the
> signature itself, so it catches the variable too: `set(5, myOpts)` does not
> compile.
>
> **That exactness is what keeps `set(5, {lasy: true})` an error, and it costs
> nine shapes that used to compile.** Eight come from the key rule — an
> interface extending the params type, a variable with an inferred stray key,
> an unrelated type with an *optional* stray key, an intersection
> (`SignalWriterParams<T> & {mine: string}`), a class instance with a field
> beyond the options, the rest object of a destructuring, a pass-through
> wrapper generic in its own params (`<Q extends SignalWriterParams<T>>(q: Q)
> => sig.set(v, q)`), and a *pattern* index signature, whose key is a template
> literal type such as `data-${string}`. The ninth comes from the flag:
> `{lazy: flag}` with `flag` narrowed to `true`. Each is a loud `TS2769`, and
> the repair is to name the params type — annotate the variable
> `SignalWriterParams<T>` or assert it at the call; for the wrapper, drop the
> type parameter and call the argument `SignalWriterParams<T>`. **A spread
> repairs none of them** — it drops freshness, not keys. A params object
> carrying a plain `string`, `number` or `symbol` index signature
> (`Record<string, unknown>`, `{[k: number]: unknown}`, `Record<symbol,
> unknown>`) is exempt from the key rule and passes unchanged; a pattern key
> is not, which is why it stands in the list above.

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

> The same holds for `destroySignal()`, with the same exception: a throwing
> effect cleanup no longer ends the delivery, so a `link()`, a `SignalGroup`
> or a `SignalAutoMap` registered behind that effect still learns that the
> signal is gone instead of keeping a dead one. Several failures arrive as an
> `AggregateError` in delivery order, a lone one unchanged. Only effects are
> isolated — a throwing `'destroy'` listener on a link, or anything else on
> that queue, still ends the delivery, with the failures collected before it
> re-raised alongside. The frame is per signal: `destroySignal(a, b)` with a
> failing subscriber of `a` still leaves `b` alive and untouched.

### Top-level helpers

| Function                       | Purpose                                                                |
| ------------------------------ | ---------------------------------------------------------------------- |
| `isSignal(v)`                  | `true` for any `Signal`, `SignalReader`, or `SignalLike`.              |
| `destroySignal(...sigs)`       | Destroy one or more signals; subscriptions and groups are cleaned up.  |
| `muteSignal(sig)`              | Suppress notifications without destroying; reads and writes keep working. |
| `unmuteSignal(sig)`            | Resume notifications. Does not replay writes made while muted.         |
| `getSignalsCount()`            | Count of live signals — created, not destroyed, still reachable. Self-corrects once a dropped signal is collected, at a time you cannot observe or force (debugging / leak checks). |
| `value(sig \| [obj, key])`     | Untracked read (signal or `[host, name]`). Throws `TypeError` on anything else. |
| `touch(sig \| [obj, key])`     | Force a notify. Throws `TypeError` on anything else.                   |

> **A non-signal argument.** Three functions object to one: `link()`, `touch()` and `value()` throw a `TypeError` prefixed with `[signalize] <fn>:`. Four do not: `destroySignal()`, `muteSignal()`, `unmuteSignal()` and `unlink()` do nothing and report nothing — they are teardown-shaped, and a teardown that refuses an argument it does not recognise is harder to use than one that shrugs. `getLinksCount(notASignal)` answers `0`, the same answer a signal without links gives. Do not read that silence as confirmation that the argument was a signal; `isSignal(v)` is the way to ask.

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
The **first** run is the exception, because `createEffect()` performs it
itself and there is no `Effect` to keep: a throw out of it takes the creation
back — the effect is destroyed, nothing stays counted or subscribed, and the
error arrives at the `createEffect()` call. `attach` decides this, and it is
the only thing that decides it: with `{attach}` the effect survives its failed
first run, keeps its dependencies, runs again on the next change, and goes
down with `group.clear()` like any other member. Without it the creation is
taken back even where something else was holding the effect — one created
inside another effect's callback is a child of that parent and is rolled back
all the same, so a parent that catches the failure no longer keeps it.
Should the rollback itself fail (an
`onDestroyEffect()` handler or a cleanup throwing), both failures arrive
together as an `AggregateError`, creation error first.

**`options`** *(the call site takes `EffectOptionsWithSignalDeps` or
`EffectOptionsWithNameDeps`; `EffectOptions` is the wide form the
`EffectImpl` constructor takes and is refused here)*:

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
> the global cap (default `256`); beyond that a descriptive `Error`
> is thrown. Read it with `getMaxEffectDepth()` and tune it with
> `setMaxEffectDepth(n)`, but prefer breaking the cycle.

### `Effect` instance

| Member     | Description                                                                              |
| ---------- | ---------------------------------------------------------------------------------------- |
| `run()`    | Run the callback if dependencies have changed since the last run; otherwise no-op. Inside a `batch()`, queues the effect — and the queued run is carried out when the batch closes, `{autorun: false}` or not. |
| `destroy()`| Mark the effect destroyed, drop subscriptions, notify, then run cleanup and destroy child effects. |
| `destroyed`| `boolean` getter — `true` once the effect is gone, however it was destroyed: through this wrapper, through its group, or before `createEffect()` handed the wrapper out. |

> **Teardown order.** `destroy()` marks the effect as destroyed and
> unsubscribes it from all queues **before** it emits its destroy events and
> **before** the cleanup callback runs. Everything that observes the teardown
> — a cleanup callback, an `onDestroyEffect(cb)` handler — therefore sees an
> effect that no longer reacts: writing to a signal the effect depends on
> triggers no further run, and `run()` is a no-op. Repeated or re-entrant
> `destroy()` calls do nothing. Every step of the teardown is guarded on its
> own: a `DESTROY` listener on the effect, an `onDestroyEffect(cb)` handler
> and the cleanup callback each throw to the caller of `destroy()` without
> stopping the steps behind them — including the child effects, so a failing
> sibling never leaves a live effect behind. If more than one thing throws
> (several of the effect's own steps, its cleanup and a child's, or several
> children's), the caller gets an `AggregateError` whose `errors` array holds
> every failure in teardown order — the effect's own steps first, then one
> entry per failing child, nested rather than flattened. A lone error is
> rethrown unchanged.

### Top-level helpers

| Function                  | Purpose                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `getEffectsCount()`       | Live effect count.                                                                 |
| `onCreateEffect(cb, priority?)`  | Subscribe to effect-create events; returns an unsubscribe function. `cb` receives a `FailingEffect` — the real instance, typed down to `{id, destroy()}`. |
| `onDestroyEffect(cb, priority?)` | Subscribe to effect-destroy events; returns an unsubscribe function. `cb` receives a `FailingEffect`, already destroyed — `run()` on it does nothing. |
| `getMaxEffectDepth()`     | The current re-entrancy cap of an effect run (default `256`).                      |
| `setMaxEffectDepth(n)`    | Raise or lower that cap globally, from the next run on. Throws unless `n` is a finite integer `>= 1`. |
| `onEffectError(cb, priority?)` | Subscribe to effect failures with no caller left to throw at (async rejections, plus stale synchronous cleanups); returns an unsubscribe function. |
| `onSignalizeError(cb, priority?)` | Subscribe to every diagnostic with no caller left to throw at — finalizer failures, deprecation notices, the link threshold, and effect failures nobody took via `onEffectError()`; returns an unsubscribe function. |

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
> handler is registered it falls through to `onSignalizeError()` with
> `source: 'effect'`, and with nobody listening there either it goes to
> `console.error` with the effect id; registering a handler here replaces
> both.
>
> **The handler itself must be synchronous or catch its own errors.** Nothing
> awaits it: `onEffectError(async (p) => { await report(p); })` with a failing
> `report` is an unhandled rejection again, and the process is gone. Wrap the
> send in `.catch()`.

> ⚠️ **A throwing handler stops the dispatch.** A synchronous `throw` out of a
> handler does not escape — its failure goes to `console.error`, the original
> error takes the fallback route above — but eventize aborts the dispatch
> there, so handlers with a
> lower priority never see that event. One broken handler can blind the
> monitoring registered behind it. Keep handlers total, and give the one that
> must not miss anything the highest priority.

`priority` is the eventize priority (higher runs first) when several handlers
are registered.

### `onSignalizeError(cb, priority?): () => void`

```ts
const unsubscribe = onSignalizeError(({level, source, message, error}) => {
  report(message, {level, source, error});
});
```

The general channel for everything the library has to say when there is
nobody left to say it to. Some of it is a failure inside a
`FinalizationRegistry` callback, where a `throw` becomes an
`uncaughtException` and ends the process; some of it is a notice. All of it
used to go straight to the console, where no application could route it.

`cb` receives one `SignalizeErrorPayload`:

| Field     | Type                        | Meaning                                                     |
| --------- | --------------------------- | ------------------------------------------------------------ |
| `level`   | `'error' \| 'warn'`         | Which console method the message would have gone to without a handler. |
| `source`  | see below                   | Where the diagnostic came from. New members may appear in a minor release — a `switch` over it needs a `default`. |
| `message` | `string`                    | Always present, and exactly the text the console would have shown. |
| `error`   | `unknown \| undefined`      | The failure. **Absent for a notice** — no `Error` is invented to fill the field. |

| `source`             | Raised by                                                        |
| -------------------- | ---------------------------------------------------------------- |
| `effect`             | An effect failure that no `onEffectError()` handler took.        |
| `group-finalizer`    | A `SignalGroup` teardown threw in its registry callback.         |
| `link-finalizer`     | Releasing a collected link's queue subscriptions threw.          |
| `automap-finalizer`  | The same for a collected `SignalAutoMap`.                        |
| `link-count`         | 1000 links on one source signal — once per source.               |
| `deprecation`        | A deprecated call: `SignalGroup.destroy()`, `SignalGroup#destroy`, `signalReader(callback)`. |
| `multiple-instances` | More than one copy of the library in one process; once, when the second one loads. |
| `ignored-option`     | An option that does nothing in the combination it was passed in: `createMemo({name})` with a non-empty name and without `attach`. Every call. |

`multiple-instances` is the one source a handler will usually **not** see.
With two static imports both copies register while their modules are being
evaluated — before the first line of application code runs — so the message
goes to `console.error`, whatever is subscribed afterwards. Only a second copy
pulled in later, via `await import()`, can meet a handler that is already
there. Measured, both ways.

What a handler changes, exactly:

1. **No handler.** Every message goes to the console as before — same text,
   same argument shape. Nothing is taken away from code that does not know
   this channel exists.
2. **Handler registered.** The payload goes to the handler and the console
   stays quiet. Whoever installs this owns the message, **deprecation notices
   included** — if they should stay visible, log them.
3. **Handler throws synchronously.** Caught. Two lines follow: the handler's
   failure on `console.error`, then the original payload on the console method
   its own `level` names — a notice lands on `console.warn`, so a test that
   mocks `console.error` alone will not see it. Never a rethrow.
4. **A throwing handler starves its siblings.** eventize ends the dispatch,
   so lower-priority handlers never see the event — the payload still reaches
   the console afterwards, so nothing is lost.
5. **An `async` handler that rejects.** Nothing awaits it, so the rejection is
   unhandled — the very thing this channel exists to prevent. Wrap the send in
   `.catch()`, exactly as with `onEffectError()`.

> ⚠️ **Installing a handler silences the deprecation notices.** They are
> diagnostics with no caller too, so they travel this channel. That is the
> one surprise here: a reporting handler that only forwards `level: 'error'`
> makes them invisible.

**Against `onEffectError()`.** Both stay. An effect failure is offered to
`onEffectError()` first, with its structured payload (`effect`, `effectId`,
`phase`), and only reaches `onSignalizeError()` when nobody listens there — so
no handler ever sees the same failure twice. What arrives on the general
channel carries the effect id and the phase inside `message` as text, not as
fields. Take `onEffectError()` when you need them as fields, `onSignalizeError()`
when you want one place for everything.

`priority` is the eventize priority (higher runs first), in second place — as
in every subscribe function of this library, not in eventize's own argument
order.

---

## Memos

### `createMemo<T>(computer, options?): SignalReader<T>`

A memo is a signal driven by a high-priority effect. Reading the returned
function tracks the memo as a dependency.

**`computer`** — `() => T`. Any signals read inside become dependencies.
A throw out of the **first** compute — the one `createMemo()` runs itself —
leaves neither the memo signal nor its internal effect behind: the creation is
taken back and the error arrives at the `createMemo()` call, which never
returned a reader anybody could have used. With `{attach}` both stay, because
the group holds them and `clear()` reaches them; the same rule and the same
condition as `createEffect()`. `{lazy: true}` sidesteps the question — the
first compute then happens on the first read, at which point the reader exists.

**`options`** *(`CreateMemoOptions`)*:

| Field      | Type                          | Default      | Effect                                                                       |
| ---------- | ----------------------------- | ------------ | ---------------------------------------------------------------------------- |
| `lazy`     | `boolean`                     | `false`      | If `false`, the memo eagerly recomputes on dep change (acts as a computed signal). If `true`, recomputes on read only. |
| `priority` | `number`                      | `1000`       | Higher than default effects so memos resolve first in a flush.               |
| `attach`   | `object \| SignalGroup`       | `—`          | Lifecycle group.                                                             |
| `name`     | `string \| symbol`            | `—`          | Name within the attached group (`group.signal(name)`). Without `attach` it does nothing and is reported via `onSignalizeError()` (`source: 'ignored-option'`) on every such call. An empty string counts as no name at all and behaves exactly like omitting the option, with and without `attach`. |
| `batchWrites` | `boolean`                   | `false`      | Wrap the recompute in `batch()`. Groups side-effect writes with the memo's own; costs a full flush once the memo has a downstream effect. See below. |

**Eager (default) vs lazy.** Effects that depend on a memo only re-run if the
memo value changes. With `lazy: true` the memo is not evaluated on dep change,
so dependent effects are not notified until something reads the memo.

**`batchWrites`.** By default the recompute writes the memo's signal directly,
no `batch()` involved. Set `batchWrites: true` only if `computer` itself
writes to *other* signals as a side effect (uncommon — `computer` is meant to
read and return, not write) — the batch then groups those writes with the
memo's own write so a downstream effect depending on both sees one
consistent run instead of one per write with a torn intermediate value.

What that grouping costs depends on whether anything downstream reacts. A
memo with no dependent effect defers nothing, and since PERF-002 a batch with
an empty queue skips its flush entirely — measured, `batchWrites: true` is then
within single-digit percent of the default (it used to be about 2.5x slower).
As soon as the memo *has* a dependent effect, the recompute pays a complete
flush for that single deferred effect: a `Set`, an array, two temporary queue
subscriptions, a delivery frame, and one dispatch through eventize instead of
a direct call — measured at roughly 3x the cost of a recompute under the
default. That is why the default is `false`: the price lands exactly where
the option is used, and it only pays off when one recompute would otherwise
trigger the same downstream effect more than once.

It used to cost read freshness as well: a *composed* memo read from inside a
`batchWrites: true` callback while dirty came back stale, permanently so for a
`{lazy: true}` one. That no longer applies — a memo's `beforeRead` recomputes
at the read and walks past the open batch (its own write still goes into the
batch), so composed memos read fresh under either setting.

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
- **`target`** — `Signal<T>`, `SignalReader<T>`, or `(value: T) => void`. A
  callback target's parameter is inferred from `source`; an explicit
  annotation is still allowed and is checked against the source as usual.
- **`options.attach`** — `object` (lifecycle group).

The target receives the source's current value immediately (`touch()` on
construction).

`link()` is an overload pair — one signature for a signal target, one for a
callback target — because `SignalReader<T>` is itself callable and TypeScript
builds no contextual type for a union with more than one call signature.
`link` therefore carries two signatures now, and the cost is one rule:
anything that reduces it back to a single signature — an assignment to a
narrower one, generic inference, or a utility type — resolves to the callback
signature. Four examples of that rule, not a closed list:

- **A call whose target's static type is a union mixing a callback with a
  signal** — `Signal<T> | ValueCallback<T>`, a wider union built from it, or
  the same union reached through a variable, an object property, a ternary
  expression, or a type parameter constrained to it — reaches neither
  overload and reports `TS2769`. Narrow it first
  (`typeof target === 'function'` splits both branches cleanly), split the
  call, or cast at the call site. A union of `SignalReader<T> |
  ValueCallback<T>` is *not* affected — it is entirely assignable to
  `ValueCallback<T>` and still goes through, landing on the callback
  overload.
- **A generic pass-through whose parameter is written as a call signature**
  (`<A extends unknown[], R>(fn: (...a: A) => R, ...a: A)`) reports `TS2345`
  instead: generic inference over an overloaded type picks one signature, and
  `ValueType` falls to `unknown`. A wrapper whose parameter is a bare type
  parameter (`<T extends (...a: any[]) => any>(impl: T): T`) keeps the whole
  overload set and is unaffected.
- **Treating `link` itself as a value, not calling it** — assigning or
  passing the bare function to a variable, an object or class property, an
  array element, a `Map#set()` call, a default parameter, or a `satisfies`
  expression typed with a monomorphic signature that spells the union out by
  hand — reports `TS2322` (`TS2345` at an argument position; `TS2769` where
  the target position is itself overloaded, as the `Map` constructor is): an
  overloaded function type isn't assignable to a narrower one.
- **A utility type that reduces the overloaded type to one signature**
  resolves it to the callback overload, not the union: `Parameters<typeof
  link>[1]` is `ValueCallback<unknown>` now, so a variable typed from it no
  longer accepts a signal. `ReturnType<typeof link>` is unaffected — both
  overloads return the same type.

The repair is the same across all four, with the same caveat: annotate the
target `typeof link` when you own the signature being annotated, otherwise
wrap the call in an arrow that narrows inside before delegating, or cast at
the call site (`link as …`) when neither is available.

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
source, `link()` says so once, via `console.warn` — or to `onSignalizeError()`
with `source: 'link-count'`, if someone listens there. A diagnostic, not a
limit: nothing is thrown and nothing is refused.

### `unlink(source, target?)`

Drop a specific `(source, target)` link, or all links from `source` if no
target is given.

> **Teardown errors.** Every matching link is torn down, even if an earlier
> one's `DESTROY` listener throws. The failures are collected and raised
> afterwards: a lone one unchanged, several as an `AggregateError` whose
> `errors` array holds them in teardown order — the same shape `clear()` and
> `off()` use above.

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
| `source`                | The source signal, as a narrow read-only view (`LinkSource<T>`): `id`, `value`, `muted`, `destroyed`. |
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

> **On the spelling.** This class names its state flags `isMuted` /
> `isDestroyed`; `Signal` names its pair `muted` / `destroyed`, and `Effect`
> — which has no mute concept at all — names its one flag `destroyed`. Each
> class is consistent with itself; the spelling never changes in the middle
> of one.

### `nextValue(options?)` / `asyncValues(stop?, options?)`

`options.signal` — an `AbortSignal` (typed as `AbortSignalLike`, a
structural subset every real `AbortSignal` satisfies) — aborts the wait: an
already-aborted signal rejects immediately, and one that aborts while a value is pending
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
sampler, not a lossless stream. Within one iterator every propagated value
arrives at most once — a read with nothing new waits for the next
propagation. Several `asyncValues()` iterators can run
over the same link concurrently; they share that one retained slot, and it
is only released once the *last* of them stops (finishes, breaks, or is
`.return()`ed) — an earlier one finishing does not cut a still-running
sibling off from the next value. Released means switched off, not just
emptied: once the last iterator is gone, `'value'` is no longer retained at
all, so a later `nextValue()` waits for the next value instead of resolving
with one that arrived while nobody was iterating. The other side of that
coin — `asyncValues()` claims the retain policy of the `'value'` event for
itself and gives it up at the end, so a `retain(link, 'value')` you set
yourself does not survive an `asyncValues()` run. Closing a manually driven
iterator works at any time, including while it is waiting for a value that
never comes: `.return()` and `.throw()` cancel the pending read, so they
settle instead of queueing behind it forever.

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
throws `TypeError` if `callback` returns a thenable — wrapped in an
`AggregateError` as `errors[0]` if the flush that follows fails as well — and
its signature rejects an `async` callback (or anything typed to return
`Promise`/`PromiseLike`) at `tsc` time. Writes made before the check — i.e.
everything the callback did synchronously before returning — are still
flushed; only what runs after the callback returns is left unbatched.

This is a synchronous throw at the `batch()` call site, unlike an async
*effect* callback's rejection, which cannot be thrown at any caller and goes
to `onEffectError()` instead (see `createEffect`).

An effect that throws during the flush no longer holds up the remaining
delayed effects; its failure reaches the `batch()` caller after the flush is
complete, several failures as an `AggregateError`. If `callback` and the flush
both fail, both failures arrive together as an `AggregateError`, the callback's
error first — the flush no longer replaces what the callback threw.

Reading a memo inside the callback recomputes it there and then, instead of
handing back the value it had before the batch — a memo whose dependency was
written in the same batch reads the new value, and one *created* inside the
batch reads a value at all. The recompute's own write stays inside the batch
and is deduplicated with everything else, so downstream effects still run once,
after the callback. Explicitly calling `effect.run()` inside the callback
queues that run and carries it out at the flush, even for an `{autorun: false}`
effect; a plain signal write still leaves such an effect alone.

> **Only one level.** This reaches a memo the batch itself marked dirty. A memo
> that is stale only *through another memo* — it reads no signal written in this
> batch, just another memo that does — is not pulled forward: nothing marked it
> dirty, since its upstream's write is precisely what the batch is holding back.
> Inside the batch it still reads its pre-batch value. It catches up at the
> flush if that upstream is eager; a `{lazy: true}` upstream never pushes, so
> the downstream memo stays on its old value after the flush too, until
> something reads the lazy one outside the batch.
>
> **Read the upstream first.** That is the way out, and it works for both: read
> the upstream memo inside the same batch, before the downstream one. The
> upstream's own read pulls its recompute forward, its write marks the
> downstream memo dirty, and the downstream read then finds work to do instead
> of returning early. `batch(() => { dep.set(2); inner(); outer(); })` reads
> fresh where `batch(() => { dep.set(2); outer(); })` does not.
>
> Pulling a chain forward also costs a recompute — but only for a memo that
> reads *both* a signal written in this batch *and* an upstream memo. Such a
> memo recomputes twice per batch: once at the read, and once at the flush,
> because the upstream's write lands in the batch and marks the reader dirty
> again a moment after it read that very value. A memo that reads only the
> upstream memo is the case above and recomputes once. Values and downstream
> runs are correct either way; a `{batchWrites: true}` memo whose `computer`
> writes other signals performs those side writes twice.

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
restored on exit, including after a throw — whether the throw came from
`callback` or from the flush below. Stackable.

`hibernate()` returns whatever `callback` returns, and — like `batch()` and
`beQuiet()` — rejects an `async`/thenable-returning `callback` at compile
time, because the saved context is restored at the first `await`.

> If a batch was active, its queued effects are flushed before the callback
> runs (so they aren't lost or re-batched). The queue is emptied even when an
> effect in it throws, so the restored batch never recalls anyone a second
> time; the failure is reported once, here at the `hibernate()` caller.

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
| `SignalGroup.delete(obj)`           | Clear and remove the group. Passing the group itself works too, like `get()` / `findOrCreate()`. |
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
`onSignalizeError()` — `console.error` while nobody listens there — and never
re-raised: a registry callback has no caller left to receive it.

### Instance

| Method                                  | Purpose                                                                |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `attachSignal(sig)`                     | Add a signal; group destroys it on `clear()`. Returns the argument with its own type intact — `Signal<number>` in, `Signal<number>` out. |
| `attachSignalByName(name, sig?)`        | Add and register a name. The name is the group's only hold on the signal unless `attachSignal()` was called for it too — so rebinding the name **destroys** the signal it displaces. Exempt: signals held by another name, and explicitly attached ones. Passing `undefined` releases the name the same way — which is why the return type is the argument's own type *or* `undefined`. |
| `detachSignal(sig)`                     | Remove a signal (does **not** destroy it). Returns the argument with its own type intact. |
| `hasSignal(name)`                       | Lookup walks parent chain.                                             |
| `signal<T>(name)`                       | Returns the named `Signal<T>` (parent fallback) or `undefined`. Without a type argument that is `Signal<unknown>` — the group cannot know what a name holds. |
| `attachEffect(eff)` / `runEffects()`    | Track an effect / run all attached and child effects. `eff` is the `Effect` from `createEffect()` or the internal instance — the method unwraps and gives the argument back with its own type, like `attachSignal()` and `attachLink()`. Throws on an already destroyed effect in either shape. A destroyed effect takes itself out of the group by itself. |
| `attachLink(link)` / `detachLink(link)` | Track / untrack a link. A destroyed link takes itself out of the group, whichever route attached it. Both return the argument with its own type intact. |
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
> `onSignalizeError()` instead — and to `console.error` while nobody is
> listening there.

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
SignalAutoMap.fromProps<P>(obj: P, keys?: Extract<keyof P, string | symbol>[])
```

### Methods

| Method                                  | Behaviour                                                              |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `get<T>(key): Signal<T>`                | Returns existing signal or creates one (initial value `undefined`).    |
| `has(key): boolean`                     | Membership check.                                                      |
| `update(map: Map<string \| symbol, unknown>)` | Apply a `Map` of values; missing keys are created. Wrapped in `batch()`. |
| `updateFromProps(obj, keys?)`           | Apply object props; missing keys created. Wrapped in `batch()`. `keys` is restricted to `Extract<keyof T, string \| symbol>[]` — a numeric key cannot be named. |
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
| `findObjectSignals(obj)`                | `Signal<unknown>[] \| undefined`.                                        |
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
| `attach`      | `object \| SignalGroup`       | An **additional** group. The instance group stays — the signal is a member of both, and destroying the additional group destroys the signal. |

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
| `SignalWriter<T>`            | The callable form of `signal.set`, as an overload pair: a value — with params that name only declared options and never a statically `true` `lazy` — or a factory with `{lazy: true}`. |
| `SignalLike<T>`              | Internal brand that only `createSignal()` produces. `$signal` is not exported, so the type is inspectable but not implementable from the outside — use `isSignal(v)` to recognise one. `T` defaults to `unknown`. |
| `SignalParams<T>`            | Options for `createSignal` (`lazy`, `compare`, `beforeRead`, `attach`). |
| `SignalWriterParams<T>`      | Options for `set()` (extends `SignalParams`, adds `touch`). Its `lazy?: boolean` is *not* narrow enough for the factory overload — that one wants a statically `true` `lazy`. |
| `SignalValueParams`          | The `{touch?: boolean}` half of `SignalWriterParams`, on its own.  |
| `NonThenable<T>`             | `T` unless `T` is promise-like, in which case `never`. What makes an `async` callback a compile error in `batch()`, `beQuiet()` and `hibernate()`. |
| `Effect`                     | The wrapper returned by `createEffect()`.                        |
| `EffectOptions`              | The wide options form the `EffectImpl` constructor takes. A `createEffect()` call site refuses it (`TS2769`) — its `dependencies` may hold names while `attach` stays optional. Name one of the two below instead. |
| `EffectOptionsWithSignalDeps` | Options whose `dependencies` hold only `SignalLike` entries; `attach` optional. |
| `EffectOptionsWithNameDeps`  | Options whose `dependencies` may hold string/symbol names; `attach` required, because the lookup needs a group. |
| `EffectDeps`                 | `(SignalLike<any> \| string \| symbol)[]` — the positional deps array in its wide form. |
| `SignalLikeDeps`             | `SignalLike<any>[]` — the positional deps array without names. |
| `EffectCallback`             | `() => void \| (() => void)`.                                    |
| `CreateMemoOptions`          | Options for `createMemo`.                                        |
| `EffectErrorPayload`         | The single argument an `onEffectError()` handler receives: `{effect, effectId, error, phase}`. |
| `EffectErrorPhase`           | `'callback' \| 'cleanup'` — which half of the effect run failed. |
| `EffectErrorCallback`        | `(payload: EffectErrorPayload) => void`.                         |
| `FailingEffect`              | The narrow view of the failed effect inside that payload: `id` and `destroy()`, nothing else. |
| `SignalLink<T>`, `ValueCallback<T>` | Link types. `T` defaults to `unknown` in both.             |
| `LinkOptions`                | Options for `link()` (`attach`).                                 |
| `SignalAutoMapKeyType`       | `string \| symbol` — the key type a `SignalAutoMap` accepts.     |
| `LinkSource<T>`              | The narrow read-only view of a link's source signal: `id`, `value`, `muted`, `destroyed`. |
| `SignalizeErrorPayload`      | The single argument an `onSignalizeError()` handler receives: `{level, source, message, error?}`. |
| `SignalizeErrorCallback`     | `(payload: SignalizeErrorPayload) => void`.                      |
| `AbortSignalLike`            | Structural subset of `AbortSignal` accepted by `nextValue()` / `asyncValues()`. |
| `CompareFunc<T>`             | `(a: T, b: T) => boolean`.                                       |
| `BeforeReadFunc`             | `() => void`.                                                    |
| `VoidFunc`                   | `() => void`.                                                    |
| `ValueChangedCallback<T>`    | `(value: T) => void \| (() => void)`.                            |

From `@spearwolf/signalize/decorators`:
`SignalDecoratorOptions`, `SignalReaderDecoratorOptions`.
