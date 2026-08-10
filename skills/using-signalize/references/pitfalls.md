# Pitfalls — `@spearwolf/signalize`

Behaviours that surprise people (and models) coming from React, Solid, Vue or MobX. Most fail *silently*: no error, no warning, just an effect that never fires or a value that never updates. The first six are also summarised in `SKILL.md`.

## Reading and writing

**1 — `set()` takes a value, not an updater.** `signal.set((v) => v + 1)` stores the **function** as the value; it is never invoked. TypeScript rejects this on typed signals, but `any` and untyped paths slip through. Use `signal.set(signal.value + 1)`.

**2 — `signal.get()` tracks, `signal.value` does not.** The single most common reactivity bug: writing `c.value` inside an effect callback when `c.get()` was meant produces an effect that runs once and never again. Conversely, `.value` is the correct tool for deliberately reading without subscribing.

**3 — `beforeRead` fires on tracked reads only.** That includes `sig.get()` and the deprecated `sig.get(cb)` form. `.value` and `value(sig)` skip it. Do not put invariants there that must hold on *every* observation.

**4 — Lazy is not sticky.** `createSignal(fn, {lazy: true})` stays lazy only until the first read. After a plain `set(v)` the signal is non-lazy; pass `{lazy: true}` again to restore it. And `set(fn)` *without* `{lazy: true}` stores the function as the value (see pitfall 1).

**5 — `createSignal(otherSignal)` is a passthrough.** It returns the existing signal — no new signal, no counter increment. Useful for "accept a value or a signal" helpers; wrong if a copy was intended.

**6 — Muting silences the notification, not the write.** On a muted or destroyed signal `set(v)` still stores `v` — later `.get()`/`.value` reads return it — and only the emit is suppressed. So is `signal.touch()` and `set(v, {touch: true})`; unmute first if a forced emit is genuinely needed. Unmuting replays nothing: the value is already stored, so re-setting it compares equal and stays silent. `touch()` after `unmuteSignal()` is the way to push the current value. A destroyed signal cannot be revived at all — it stays a plain value container.

## Effects

**7 — Static deps disable autorun *and* auto-tracking.** `createEffect(cb, [a, b])` — and equally `{dependencies: [a, b]}` — does not run at creation time, and signals read inside the callback are not subscribed. Only the listed deps trigger reruns. Call `.run()` once when an initial pass is wanted. The declared set is re-subscribed at the start of every run, so a static-deps effect that survives a `SignalGroup.off()` hears the detached signal again from its next run onwards.

**7a — Static deps do not disable the effect *context*.** The callback still runs as the current effect, so effects created inside it — directly, or via `Signal.onChange()` — are child effects and die with the parent (pitfall 10). Only the subscribe-on-read is suppressed. `hibernate()` is the escape hatch when an inner effect must outlive its parent. `createMemo()` in an effect body follows the same rule for its internal effect — it is a child and dies with the parent, so the memo stops recomputing. Its signal dies too, with or without `{attach}`, so a handle that escapes the callback reads a destroyed signal: still a usable frozen constant (last computed value), just no longer live. `{attach}` gives the signal a group membership and, optionally, a name, but not a lifetime of its own — it still dies on the same rerun as an unattached one. `{attach}` saves neither the value nor the computation when the memo lives inside an effect body; `hibernate()` is the only way to keep a memo itself recomputing (and its signal alive) past the parent.

**8 — Dynamic deps may shrink between runs.** Signals read in run N but not in run N+1 are unsubscribed at the end of run N+1. `if (a.get()) b.get()` is entirely fine — conditional subscription is the point of dynamic tracking.

**9 — Synchronous self-write recursion is bounded, not forbidden.** An effect that writes a signal it depends on re-enters `run()` synchronously. The depth is capped at `EffectImpl.maxDepth = 256`; beyond that a descriptive `Error` is thrown rather than a stack overflow. Prefer breaking the cycle — `beQuiet` around the self-write, a conditional guard, or splitting the effect. Raise `EffectImpl.maxDepth` only when the recursion is intentional. Every nested run gets its own cleanup, and it runs the moment the next run overtakes it rather than as the next one — nothing is dropped.

**9a — `beQuiet()` and effect runs.** A run inside a quiet frame executes its callback and keeps its dependencies; it just cannot realign them, because its reads do not count. An effect *created* inside a quiet frame gets none at all and never runs again. `hibernate()` is the way out when a run is meant to track.

**10 — Nested effects are recreated on every parent rerun.** Order on a rerun: parent's own cleanup → child effects destroyed (each child's cleanup runs as part of its destroy) → parent callback re-executes → fresh inner effects created. Nothing is recycled — every run yields new instances with new ids. Do not stash an inner `Effect` handle in long-lived state. Applies to static-deps parents as well (pitfall 7a).

**11 — Async callbacks do not make propagation async.** An effect callback may be `async`, but propagation itself stays synchronous: nothing waits for the promise. There is no microtask debounce; write one if the use case needs it.

**11a — The cleanup of an `async` run still runs once the run is superseded — just late.** The cleanup function only exists when the promise settles. If the effect re-ran or was destroyed by then, that cleanup runs **right then**, instead of being stored as the next one — it is the only thing that will ever release what that run acquired. Nothing bounds *when*: the timing sits anywhere from "immediately" to "well after the next run already acquired its own resource," so a brief overlap between the two is possible. Acquire before the first `await`, or bind the resource to an `AbortController` aborted from a synchronous cleanup, if the release must be synchronous with the run it replaces.

```ts
createEffect(async () => {
  const socket = await connect();
  return () => socket.close();     // runs once this settles, timing unbound
});

createEffect(() => {
  const ctrl = new AbortController();
  void doWork(ctrl.signal);
  return () => ctrl.abort();       // ✓ synchronous, never dropped
});
```

**11b — A rejecting `async` callback is reported, not thrown.** It cannot reach the caller — the stack is long gone — so it goes to `onEffectError(cb)`, and to `console.error` with the effect id while no handler is registered, instead of becoming an unhandled rejection (which would terminate Node). Same for a rejecting `async` cleanup, reported with `phase: 'cleanup'`. A *synchronous* throw normally propagates to whoever triggered the run — except a cleanup whose throw can no longer reach a legitimate caller: a superseded run, an effect already destroyed, or one destroying itself as its own run winds down. Those have none, full stack or not, and land here too with `phase: 'cleanup'`.

**11c — An `async` `onEffectError` handler re-opens the hole it was meant to close.** Nothing awaits the handler, so a rejected promise coming out of it is an unhandled rejection like any other — and reporting to a remote service is the handler everyone writes first. Keep the handler synchronous and `.catch()` the send yourself. A handler that throws *synchronously* is caught, but eventize then aborts the dispatch: handlers with a lower priority never see that event.

**11d — A throwing callback no longer silences the other effects of that write.** It used to: the first synchronous throw ended the whole fan-out, every effect with a lower priority was skipped, and none of them ever learned that the value had changed — the write was lost for them for good. Callbacks are isolated now, so all of them run and the failure is re-raised at the end of the delivery. Two things to know about the new shape: `set()` (and `touch()`, and `batch()`) can now throw an `AggregateError` when several effects of one write fail, `errors` in delivery order — a single failure still arrives unchanged. `destroySignal()` isolates its own delivery the same way and throws the same shape when several effect cleanups fail. `batch()` has one more way into that shape: if its own callback throws (or trips the thenable guard) *and* the flush fails too, both arrive together, callback error first and the flush's bundle after it — so those `errors` are not in delivery order, and a nested `AggregateError` in second place is the flush's own bundle, not a flattened one. And a `link()` callback is not an effect: it is not isolated and does end the delivery, though the failures collected before it are re-raised with it. There is a second route into the collected form, at the other end of an effect's life: a `createEffect()` (or `createMemo()`) whose first run throws takes the creation back, and if that rollback fails too, both arrive as an `AggregateError` with the creation error first. And a third route is not tied to a delivery at all: `unlink(source)` tears every link down and collects, so a failing `DESTROY` listener on one link still lets its siblings go. None of this goes through `onEffectError()`; the write is the caller, so catch at the write.

**11e — A first run that throws destroys the effect, unless `attach` is set.** Every *later* failing run leaves the effect alone (11d). The first one is different: `createEffect()` performs it before it hands out an `Effect`, so a throw there takes the whole creation back — the effect is destroyed, the counters go back down, and the error arrives at the `createEffect()` call. `attach` is the only thing that changes this, not "somebody still holds it": an effect created inside another effect's callback is a child of that parent and is rolled back too, so a parent that catches the failure no longer keeps it alive. `createMemo()` follows the same rule with its memo signal — but do not mistake the `{attach}` survivor for a working memo. The compute threw before `createMemo()` finished wiring it up, so that signal has neither the read hook a lazy memo recomputes through nor the binding that lets `destroySignal()` take its effect down. It is a group member to be cleared, not a memo to be used; create it again.

## Memos

**12 — Eager vs lazy changes downstream behaviour.** Default `lazy: false` makes the memo a computed signal: dependent effects re-run when its deps change. With `lazy: true` dependents are **not** notified — the memo is only recomputed when read.

## Batching and context modes

**13 — `batch()` is a hint, not a guarantee.** Most flushes are deduplicated and priority-ordered, but internal consistency rules can still cause partial propagation. "Exactly one effect run per batch" is not a correctness invariant to build on.

**13a — `batch(async () => ...)` throws, it does not silently stop batching.** An `async` callback stops being batched at its first `await` — writes before it are still batched, writes after it run completely unbatched, and the result used to look exactly like working code. `batch()` now throws `TypeError` if the callback returns a thenable, and the signature rejects `async` callbacks at `tsc` time too (ASYNC-003). Unlike 11b's rejecting `async` *effect* callback — which cannot be thrown at any caller and goes to `onEffectError()` — this is a synchronous throw at the `batch()` call site, because its caller is still on the stack.

## Lifecycles

**14 — `SignalGroup.findOrCreate(group)` returns the group itself.** Passing an existing `SignalGroup` is an identity no-op. `findOrCreate(null)` throws.

**15 — `SignalGroup.delete(obj)` ≠ `g.clear()`.** Both clear; the static form additionally looks the group up by the host object. `g.off()` is the softer variant — it destroys attached effects and links and drops external subscriptions but keeps the signals alive — except a memo signal `{attach}`ed inside an effect body, which belongs to that effect and dies with it, name and all (7a). The instance method `destroy()` is deprecated and warns; use `clear()`.

**16 — Attaching a group does not keep the host object alive.** The registry is a `WeakMap` and the back-pointer a `WeakRef`, by design.

**16a — There *is* a GC backstop, but do not rely on it.** `SignalGroup` registers its host object with a `FinalizationRegistry`; when that object becomes unreachable without an explicit `SignalGroup.delete(obj)` or `group.clear()`, the callback runs `clear()` and the attached signals, effects and links are reclaimed; if that teardown throws, the error goes to `console.error`, because a registry callback has no caller to hand it to. **Five** limits make it insurance rather than a lifecycle:

- **The one thing that still blocks it is a live effect, and the group is not what holds it.** Every `EffectImpl` subscribes itself to the global effect queue in its constructor and stays there until `destroy()` — that subscription is the delivery path for a write, and it makes the effect reachable from a module-level root for its whole life. Whatever its callback closure captures is held by that root, with or without a group: measured, 200 effects created with *no* group keep 200 of 200 hosts alive, and `destroy()` takes it to 0. This is the same limit as "anything created without `attach` is owned by nobody" — it stays subscribed to the global queues until it is destroyed by hand. An attached signal whose *value* holds the host no longer does this: since the group's own roots went weak, host and group are collected together (measured 1000 → 0, against effect closures unchanged at 500 → 500). `@signal() accessor self = this` is therefore covered; `createEffect(() => use(this.foo))` is not.
- FR callbacks fire non-deterministically and may never run before the process exits, so nothing observable is guaranteed at any point in time.
- A self-keyed group — one whose store key is the group itself — is deliberately not registered with the host backstop: it cannot outlive itself. The public API cannot build one (`findOrCreate()` requires an object and throws on `null`), so this is a property of the constructor, not a shape you can reach. It does release its queue subscriptions when it is collected, like every other group.
- **A group collected with its host never ran `clear()`.** It emits no `DESTROY` and its signals are collected rather than destroyed, so a `DESTROY` listener is not a cleanup hook the GC path will ever call. The counters still come back down — the signal counter corrects itself per signal, and a second registry on the group releases its `globalDestroySignalQueue` subscriptions — but "the numbers are back at baseline" is not evidence that any teardown ran.
- Because timing is unobservable, leak assertions in tests must still use explicit teardown plus the counters; a passing `getSignalsCount()` check cannot be attributed to the registry — and since MEM-006 there are two registries that can move that number, the group's and the per-signal one behind `getSignalsCount()` itself.

**17 — `link()` deduplicates by `(source, target)` pair.** Calling it twice with the same pair returns the *existing* link rather than creating a second one. Links auto-destroy when the source or a signal target is destroyed. Passing `{attach}` on a call that hits the cache attaches the existing link to that group *too*, instead of being ignored — a link with several attached groups dies with whichever one clears first. Re-passing the same group (on a cache hit, via a direct `link.attach(g)` call, or via `group.attachLink(link)`) is itself idempotent and safe to do every render or effect rerun. While its source is reachable, a link is held until one of four things happens — `destroy()`, `unlink()`, a cleared `{attach}` group, or the destruction of source/target — and *not* by garbage collection alone: a hot path that keeps `link()`ing fresh callbacks against a long-lived source without ever `unlink()`ing the old ones accumulates every one of them, unbounded, on that source. (A link that becomes unreachable *together with* its still-never-destroyed source is eventually collected too, and that corrects the count *and* releases its queue subscriptions; it still is not a teardown you can schedule.) Because this is exactly the hot path that runs away, `link()` warns once per source signal — a single `console.warn` — as soon as 1000 links hang off one source. It is a diagnostic marker, not a limit: nothing throws, nothing is refused.

**17a — A link callback may destroy its own link, and a feedback write swallows the *outer* run.** `destroy()` from inside the callback is a supported "take the first value, then unsubscribe": the `set()` that started the delivery returns normally, sibling links on the same source are still served, and `lastValue` stays `undefined`. If the callback — or an effect on the target signal — writes the source again, the nested propagation completes first and the outer one drops its stale value. A `nextValue()`/`asyncValues()` consumer on *that* link therefore never sees an old value after a newer one. The deduplication is per link, not per write: a second link on the same source starts its own outer frame after the nested write and legitimately announces the new value again, so watching two links on one source can still show the same value twice.

**18 — `SignalAutoMap` drops an entry the moment its signal is destroyed — including from the outside.** The map subscribes to the destruction of every signal it hands out, so `destroySignal(sig)` evicts the entry in the same synchronous turn. The surprise runs the other way from what you might expect of a cache: if you kept the `Signal` object, you now hold a corpse that is no longer in the map, and `get(key)` gives you a *different*, live signal rather than the same one back (reads and writes on the corpse still work and still notify nobody — pitfall 6). `delete(key)` on such a key therefore reports `false`; the entry was already gone. A soft detach (`SignalGroup#off()`) is not a destruction and leaves the entry in place. `map.delete(key)` remains the one-step teardown for a single live entry, `map.clear()` for all of them. One small limit: a map dropped without `clear()` releases its per-entry queue subscriptions through a `FinalizationRegistry`, at a time nobody can name — and its signals are collected with it, never destroyed.

**19 — Decorator signals live in the instance's group.** `@signal` registers against `SignalGroup.findOrCreate(this)`. Full cleanup is `SignalGroup.delete(this)`; `destroyObjectSignals(this)` clears signals only and leaves attached effects and links running.

## Deprecated surface

**20 — `signal.get(callback)` is deprecated.** It creates an internal effect with no unsubscribe handle, so only destroying the signal cleans it up, and it emits a once-per-process `console.warn`. Use `sig.onChange(cb)`, which returns an unsubscribe function.

## Working inside the signalize repo

**21 — In-source imports carry a `.js` extension** (NodeNext resolution): `import {x} from './foo.js'` even though the source file is `foo.ts`. This applies to code written *inside* the package; consumers are unaffected.
