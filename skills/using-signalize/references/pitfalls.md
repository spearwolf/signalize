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

**7 — Static deps disable autorun *and* auto-tracking.** `createEffect(cb, [a, b])` — and equally `{dependencies: [a, b]}` — does not run at creation time, and signals read inside the callback are not subscribed. Only the listed deps trigger reruns. Call `.run()` once when an initial pass is wanted.

**7a — Static deps do not disable the effect *context*.** The callback still runs as the current effect, so effects created inside it — directly, or via `Signal.onChange()` — are child effects and die with the parent (pitfall 10). Only the subscribe-on-read is suppressed. `hibernate()` is the escape hatch when an inner effect must outlive its parent. `createMemo()` in an effect body follows the same rule for its internal effect — it is a child and dies with the parent, so the memo stops recomputing. Its signal dies too, with or without `{attach}`, so a handle that escapes the callback reads a destroyed signal: still a usable frozen constant (last computed value), just no longer live. `{attach}` gives the signal a group membership and, optionally, a name, but not a lifetime of its own — it still dies on the same rerun as an unattached one. `{attach}` saves neither the value nor the computation when the memo lives inside an effect body; `hibernate()` is the only way to keep a memo itself recomputing (and its signal alive) past the parent.

**8 — Dynamic deps may shrink between runs.** Signals read in run N but not in run N+1 are unsubscribed at the end of run N+1. `if (a.get()) b.get()` is entirely fine — conditional subscription is the point of dynamic tracking.

**9 — Synchronous self-write recursion is bounded, not forbidden.** An effect that writes a signal it depends on re-enters `run()` synchronously. The depth is capped at `EffectImpl.maxDepth = 256`; beyond that a descriptive `Error` is thrown rather than a stack overflow. Prefer breaking the cycle — `beQuiet` around the self-write, a conditional guard, or splitting the effect. Raise `EffectImpl.maxDepth` only when the recursion is intentional.

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

**11b — A rejecting `async` callback is reported, not thrown.** It cannot reach the caller — the stack is long gone — so it goes to `onEffectError(cb)`, and to `console.error` with the effect id while no handler is registered, instead of becoming an unhandled rejection (which would terminate Node). Same for a rejecting `async` cleanup, reported with `phase: 'cleanup'`. A *synchronous* throw still propagates to whoever triggered the run.

**11c — An `async` `onEffectError` handler re-opens the hole it was meant to close.** Nothing awaits the handler, so a rejected promise coming out of it is an unhandled rejection like any other — and reporting to a remote service is the handler everyone writes first. Keep the handler synchronous and `.catch()` the send yourself. A handler that throws *synchronously* is caught, but eventize then aborts the dispatch: handlers with a lower priority never see that event.

## Memos

**12 — Eager vs lazy changes downstream behaviour.** Default `lazy: false` makes the memo a computed signal: dependent effects re-run when its deps change. With `lazy: true` dependents are **not** notified — the memo is only recomputed when read.

## Batching and context modes

**13 — `batch()` is a hint, not a guarantee.** Most flushes are deduplicated and priority-ordered, but internal consistency rules can still cause partial propagation. "Exactly one effect run per batch" is not a correctness invariant to build on.

**13a — `batch(async () => ...)` throws, it does not silently stop batching.** An `async` callback stops being batched at its first `await` — writes before it are still batched, writes after it run completely unbatched, and the result used to look exactly like working code. `batch()` now throws `TypeError` if the callback returns a thenable, and the signature rejects `async` callbacks at `tsc` time too (ASYNC-003). Unlike 11b's rejecting `async` *effect* callback — which cannot be thrown at any caller and goes to `onEffectError()` — this is a synchronous throw at the `batch()` call site, because its caller is still on the stack.

## Lifecycles

**14 — `SignalGroup.findOrCreate(group)` returns the group itself.** Passing an existing `SignalGroup` is an identity no-op. `findOrCreate(null)` throws.

**15 — `SignalGroup.delete(obj)` ≠ `g.clear()`.** Both clear; the static form additionally looks the group up by the host object. `g.off()` is the softer variant — it destroys attached effects and links and drops external subscriptions but keeps the signals alive. The instance method `destroy()` is deprecated and warns; use `clear()`.

**16 — Attaching a group does not keep the host object alive.** The registry is a `WeakMap` and the back-pointer a `WeakRef`, by design.

**16a — There *is* a GC backstop, but do not rely on it.** `SignalGroup` registers its host object with a `FinalizationRegistry`; when that object becomes unreachable without an explicit `SignalGroup.delete(obj)` or `group.clear()`, the callback runs `clear()` and the attached signals, effects and links are reclaimed. Three limits make it insurance rather than a lifecycle:

- FR callbacks fire non-deterministically and may never run before the process exits, so nothing observable is guaranteed at any point in time.
- It only covers resources reachable through a group with a *host object*. A self-keyed group (`findOrCreate()` with no argument, where `object === this`) is deliberately not registered, and anything created without `attach` is owned by nobody — it stays subscribed to the global queues until destroyed by hand.
- Because timing is unobservable, leak assertions in tests must still use explicit teardown plus the counters; a passing `getSignalsCount()` check cannot be attributed to the registry.

**17 — `link()` deduplicates by `(source, target)` pair.** Calling it twice with the same pair returns the *existing* link rather than creating a second one. Links auto-destroy when the source or a signal target is destroyed. Passing `{attach}` on a call that hits the cache attaches the existing link to that group *too*, instead of being ignored — a link with several attached groups dies with whichever one clears first. Re-passing the same group (on a cache hit, or via a direct `link.attach(g)` call) is itself idempotent and safe to do every render or effect rerun.

**18 — `SignalAutoMap` retains destroyed signals.** Calling `destroySignal()` on an entry leaves it in the map: reads return the last value, and writes still update it without notifying anyone (see pitfall 6). Prefer `map.clear()`, or attach the signals to a `SignalGroup`.

**19 — Decorator signals live in the instance's group.** `@signal` registers against `SignalGroup.findOrCreate(this)`. Full cleanup is `SignalGroup.delete(this)`; `destroyObjectSignals(this)` clears signals only and leaves attached effects and links running.

## Deprecated surface

**20 — `signal.get(callback)` is deprecated.** It creates an internal effect with no unsubscribe handle, so only destroying the signal cleans it up, and it emits a once-per-process `console.warn`. Use `sig.onChange(cb)`, which returns an unsubscribe function.

## Working inside the signalize repo

**21 — In-source imports carry a `.js` extension** (NodeNext resolution): `import {x} from './foo.js'` even though the source file is `foo.ts`. This applies to code written *inside* the package; consumers are unaffected.
