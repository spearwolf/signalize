# Pitfalls — `@spearwolf/signalize`

Behaviours that surprise people (and models) coming from React, Solid, Vue or MobX. Most fail *silently*: no error, no warning, just an effect that never fires or a value that never updates. The first six are also summarised in `SKILL.md`.

## Reading and writing

**1 — `set()` takes a value, not an updater.** `signal.set((v) => v + 1)` stores the **function** as the value; it is never invoked. TypeScript rejects this on typed signals, but `any` and untyped paths slip through. Use `signal.set(signal.value + 1)`.

**2 — `signal.get()` tracks, `signal.value` does not.** The single most common reactivity bug: writing `c.value` inside an effect callback when `c.get()` was meant produces an effect that runs once and never again. Conversely, `.value` is the correct tool for deliberately reading without subscribing.

**3 — `beforeRead` fires on tracked reads only.** That includes `sig.get()` and the deprecated `sig.get(cb)` form. `.value` and `value(sig)` skip it. Do not put invariants there that must hold on *every* observation.

**4 — Lazy is not sticky.** `createSignal(fn, {lazy: true})` stays lazy only until the first read. After a plain `set(v)` the signal is non-lazy; pass `{lazy: true}` again to restore it. And `set(fn)` *without* `{lazy: true}` stores the function as the value (see pitfall 1).

**5 — `createSignal(otherSignal)` is a passthrough.** It returns the existing signal — no new signal, no counter increment. Useful for "accept a value or a signal" helpers; wrong if a copy was intended.

**6 — `set(v, {touch: true})` is suppressed on muted or destroyed signals.** So is `signal.touch()`. Unmute first if a forced emit is genuinely needed.

## Effects

**7 — Static deps disable autorun *and* auto-tracking.** `createEffect(cb, [a, b])` — and equally `{dependencies: [a, b]}` — does not run at creation time, and signals read inside the callback are not subscribed. Only the listed deps trigger reruns. Call `.run()` once when an initial pass is wanted.

**8 — Dynamic deps may shrink between runs.** Signals read in run N but not in run N+1 are unsubscribed at the end of run N+1. `if (a.get()) b.get()` is entirely fine — conditional subscription is the point of dynamic tracking.

**9 — Synchronous self-write recursion is bounded, not forbidden.** An effect that writes a signal it depends on re-enters `run()` synchronously. The depth is capped at `EffectImpl.maxDepth = 256`; beyond that a descriptive `Error` is thrown rather than a stack overflow. Prefer breaking the cycle — `beQuiet` around the self-write, a conditional guard, or splitting the effect. Raise `EffectImpl.maxDepth` only when the recursion is intentional.

**10 — Nested effects are recreated on every parent rerun.** Order on a rerun: parent's own cleanup → child effects destroyed (each child's cleanup runs as part of its destroy) → parent callback re-executes → fresh inner effects created. Do not stash an inner `Effect` handle in long-lived state.

**11 — Async callbacks do not make propagation async.** An effect callback may be `async`, and a returned cleanup is called when the promise settles, but propagation itself stays synchronous. There is no microtask debounce; write one if the use case needs it.

## Memos

**12 — Eager vs lazy changes downstream behaviour.** Default `lazy: false` makes the memo a computed signal: dependent effects re-run when its deps change. With `lazy: true` dependents are **not** notified — the memo is only recomputed when read. **`@memo()` is always lazy**; use `createMemo()` directly for an eager class memo.

## Batching and context modes

**13 — `batch()` is a hint, not a guarantee.** Most flushes are deduplicated and priority-ordered, but internal consistency rules can still cause partial propagation. "Exactly one effect run per batch" is not a correctness invariant to build on.

## Lifecycles

**14 — `SignalGroup.findOrCreate(group)` returns the group itself.** Passing an existing `SignalGroup` is an identity no-op. `findOrCreate(null)` throws.

**15 — `SignalGroup.delete(obj)` ≠ `g.clear()`.** Both clear; the static form additionally looks the group up by the host object. `g.off()` is the softer variant — it destroys attached effects and links and drops external subscriptions but keeps the signals alive. The instance method `destroy()` is deprecated and warns; use `clear()`.

**16 — Attaching a group does not keep the host object alive.** The registry is a `WeakMap` and the back-pointer a `WeakRef`, by design.

**16a — There *is* a GC backstop, but do not rely on it.** `SignalGroup` registers its host object with a `FinalizationRegistry`; when that object becomes unreachable without an explicit `SignalGroup.delete(obj)` or `group.clear()`, the callback runs `clear()` and the attached signals, effects and links are reclaimed. Three limits make it insurance rather than a lifecycle:

- FR callbacks fire non-deterministically and may never run before the process exits, so nothing observable is guaranteed at any point in time.
- It only covers resources reachable through a group with a *host object*. A self-keyed group (`findOrCreate()` with no argument, where `object === this`) is deliberately not registered, and anything created without `attach` is owned by nobody — it stays subscribed to the global queues until destroyed by hand.
- Because timing is unobservable, leak assertions in tests must still use explicit teardown plus the counters; a passing `getSignalsCount()` check cannot be attributed to the registry.

**17 — `link()` deduplicates by `(source, target)` pair.** Calling it twice with the same pair returns the *existing* link rather than creating a second one. Links auto-destroy when the source or a signal target is destroyed.

**18 — `SignalAutoMap` retains destroyed signals.** Calling `destroySignal()` on an entry leaves it in the map: reads return the last value and writes are silent no-ops. Prefer `map.clear()`, or attach the signals to a `SignalGroup`.

**19 — Decorator signals live in the instance's group.** `@signal` and `@memo` register against `SignalGroup.findOrCreate(this)`. Full cleanup is `SignalGroup.delete(this)`; `destroyObjectSignals(this)` clears signals only and leaves attached effects and links running.

## Deprecated surface

**20 — `signal.get(callback)` is deprecated.** It creates an internal effect with no unsubscribe handle, so only destroying the signal cleans it up, and it emits a once-per-process `console.warn`. Use `sig.onChange(cb)`, which returns an unsubscribe function.

## Working inside the signalize repo

**21 — In-source imports carry a `.js` extension** (NodeNext resolution): `import {x} from './foo.js'` even though the source file is `foo.ts`. This applies to code written *inside* the package; consumers are unaffected.
