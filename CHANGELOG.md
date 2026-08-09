# CHANGELOG

## Unreleased

### Features

- New `onEffectError(cb, priority?)` export: subscribes to rejections of `async` effect and cleanup callbacks, which cannot be thrown at a caller. The handler receives `{error, effect, effectId, phase}` (ASYNC-001)
- `createMemo(fn, {batchWrites})`: new option (default `false`) to wrap the memo's recompute write in `batch()`. Only needed when `fn` itself writes to other signals as a side effect — the default trades that grouping away for read consistency on composed memos, see the Breaking Changes entry below (PERF-001)
- `SignalAutoMap#delete(key)` destroys the signal for that key and removes the entry, returning `true` if the key was in the map — previously only `clear()` could tear anything down (MEM-009)
- `link()` warns once per source signal, via `console.warn`, as soon as 1000 links hang off that one source — the point where the register is more likely unbounded than intended, and where a write to that source already costs two orders of magnitude more than it did empty. The warning names the four teardown routes (`destroy()`, `unlink()`, a cleared `{attach}` group, destroying source or target) and `getLinksCount(source)`; nothing is thrown and no link is refused (MEM-005, audit 2026-08-07)

### Bug Fixes

- A rejecting `async` effect callback no longer becomes an unhandled rejection — which, since Node 15, terminates the process by default. It goes to `onEffectError()`, or to `console.error` with the effect id while no handler is registered (ASYNC-001)
- A rejecting `async` cleanup callback is reported through the same channel with `phase: 'cleanup'` instead of being swallowed
- An effect callback that returns something other than a function no longer throws `TypeError: cleanupCallback is not a function` on the next run — the value counts as "no cleanup". Mostly hits `Signal.onChange(cb)`, whose callback is free to return `any`
- An effect created inside a **static-deps** effect callback is now registered as a child effect. It used to be orphaned: every rerun of the parent left another live effect subscribed to the global signal queue, without limit. Also hits `Signal.onChange()` and `createMemo()` calls in such a callback (MEM-001, audit 2026-08-06)
- Static deps still disable auto-tracking — signals read inside the callback do not subscribe. Only the effect context came back, not the tracking
- `Effect.destroy()` unsubscribes the effect before running its cleanup callback, so a cleanup that writes to a signal the effect depends on no longer triggers one last run whose own cleanup would never be called (MEM-007, audit 2026-08-06)
- `Effect.destroy()` marks the effect as destroyed before it emits its destroy events, so an `onDestroyEffect()` handler no longer receives an effect whose `run()` still executes the callback (BUG-008, audit 2026-08-06)
- A re-entrant `Effect.destroy()` (from a cleanup callback or a destroy handler) is now a no-op instead of decrementing `getEffectsCount()` a second time
- A cleanup callback that throws no longer leaves the effect half-destroyed — child effects, subscriptions and `getEffectsCount()` are settled either way, and the error still reaches the caller
- A child effect whose cleanup throws no longer aborts the destruction of its siblings. They used to survive their parent as zombies — still subscribed, still reacting to signal writes
- `Effect.destroy()` reports every failing cleanup instead of only the last one. Several errors (own cleanup plus a child's, or several children's) arrive as an `AggregateError` in teardown order; a single error is rethrown unchanged
- `createMemo()` called inside an effect body, without `{attach}`, no longer leaks its internal signal on every rerun. The memo's internal effect was already destroyed as a child effect (MEM-001, audit 2026-08-06), but the memo signal itself lived on unreachable and uncounted; it is now destroyed together with that effect (MEM-005, audit 2026-08-06)
- An effect no longer destroys itself mid-run when its dependencies vanish while it is rebuilding them — the verdict "nothing can trigger me anymore" is postponed to the end of the outermost run and re-checked there
- An effect whose only dependencies are memos it creates in its own body therefore keeps rerunning; it used to stop firing after the first change and leave a zombie effect behind
- An effect that really did lose every dependency still dies, one run later than before
- An error thrown by a cleanup during that deferred teardown goes to `onEffectError()` with `phase: 'cleanup'` instead of surfacing at whoever wrote the signal
- `createEffect(callback, dependencies, options)` no longer mutates the caller's `options` object by writing `dependencies` into it. Reusing one options object across several `createEffect()` calls used to make every call after the first inherit the previous one's dependencies (BUG-005, audit 2026-08-06)
- A string/symbol dependency that cannot be resolved to a signal — the name is not registered in the attached group, or no group is attached at all — now throws an error naming the dependency instead of an opaque `TypeError: Cannot read properties of undefined` (BUG-003, audit 2026-08-06)
- `batch(callback)` now throws `[signalize] batch: …` (`TypeError`) if `callback` returns a thenable, instead of silently unbatching every write made after the first `await`. `callback`'s signature is also narrowed to reject `async` functions (and anything else typed to return `Promise`/`PromiseLike`) at `tsc` time; the runtime check additionally catches a synchronous callback that merely returns a duck-typed thenable (ASYNC-003)
- `link()` with an invalid `source` (not a signal) now throws `[signalize] link: source must be a signal` immediately, before touching the internal registry. It used to insert an entry keyed by `undefined` first and only then fail inside the `SignalLink` constructor with an opaque `TypeError`, leaving that stale empty entry behind (BUG-007, audit 2026-08-06)
- `link(source, target, {attach})` called again for a `(source, target)` pair that already has a link now attaches the existing link to the new group too, instead of silently dropping `attach`. The link is destroyed as soon as any one of its attached groups clears (BUG-004, audit 2026-08-06)
- `SignalLink.attach()` (and therefore `link()`'s `{attach}` option) is idempotent: attaching the same group again — including on repeated `link()` calls for an already-cached pair — no longer registers a second internal destroy listener on the link. It used to grow the link's own listener count without bound when the same `{attach}` group was passed on every render or effect rerun
- `link()`'s internal registry (`gLinks`) now keys on the source signal via `WeakMap` instead of `Map`, so it no longer pins signals that are otherwise fully unreferenced (MEM-002, audit 2026-08-06)
- `getLinksCount()` without a `source` argument now tracks an internal counter instead of iterating the registry — a `WeakMap` cannot be iterated (MEM-002, audit 2026-08-06)
- `SignalLink`'s two subscriptions on `globalSignalQueue`/`globalDestroySignalQueue`, and `SignalLinkToSignal`'s extra subscription for its target signal, now go through a `WeakRef` to `this` instead of capturing it directly. Those queues are permanent module-level roots, so a strong closure there pinned every link — signal-target and callback-target alike — in memory for the process lifetime, regardless of `gLinks` (MEM-002, audit 2026-08-06)
- An orphaned link — never `destroy()`d, never `.attach()`d, no other references left — is now reclaimed by garbage collection once its source signal is unreachable too, for both signal and callback targets; a link whose source is still reachable is not reclaimed this way (MEM-002, audit 2026-08-06)
- `SignalLink.destroy()` now releases its `once(globalDestroySignalQueue, ...)` subscription(s) — one for a callback-target link, two for a signal-target link (source and target). They used to survive `destroy()` and dangle on that permanent module-level queue until the other side's signal was destroyed too, which for a link torn down ahead of its signals never happened (MEM-004, audit 2026-08-06)
- `SignalLink.nextValue()` and `asyncValues()` take an optional `{signal}` (`AbortSignal`): an already-aborted signal rejects immediately, one that aborts while a value is pending rejects at that point, and the internal abort listener is removed again once the call settles either way (ASYNC-004)
- `SignalLink.nextValue({signal})` no longer leaks its `DESTROY` listener and, worse, its caller-owned `AbortSignal`'s abort listener whenever it resolves through a *retained* `VALUE` replay — which eventize delivers synchronously, inside the subscribe call itself, before any of the call's other listeners were registered. This is the common case once an `asyncValues()` iterator is running on the same link (it retains `VALUE`, see ASYNC-005): every `nextValue({signal})` call after the first leaked one abort listener on the caller's signal, unbounded
- `SignalLink.asyncValues()` no longer lets one iterator's cleanup cut off a sibling: several `asyncValues()` iterators can run over the same link at once, sharing one retained slot, and that slot is now only cleared once the *last* active iterator stops instead of the first (ASYNC-005)
- `SignalLink.asyncValues({signal})` now throws the abort reason out of the loop when the signal aborts, instead of ending the iteration silently as if `stopAction` had returned `true`. The link being destroyed still ends the loop quietly — only an externally requested abort is now distinguishable from a normal stop
- `SignalLink.asyncValues({signal})` no longer misreads a `destroy()` as an abort when both happen in the same synchronous block (a teardown that destroys whatever owns the link and then cancels its own controller, in that order) — it now matches the rejection itself against `signal.reason` instead of only checking whether the signal is currently aborted, so the loop still ends quietly for that destroy instead of rethrowing it as if it were the abort
- `SignalLink.nextValue()` called on a link that is already destroyed now rejects immediately with `Error('SignalLink destroyed before the next value arrived')` instead of never settling. It used to hang forever — `DESTROY` is never emitted again after `destroy()` — leaving its `VALUE`/`DESTROY` subscriptions (and, with `{signal}`, the abort listener) on the dead link for as long as the promise was referenced
- `SignalLink.destroy()` no longer leaves a link half torn down if one of its internal destroy-queue unsubscribe handles throws: the remaining handles, the `DESTROY` emit, `off(this)` and the `isDestroyed`/freeze steps all still run, and the collected error(s) are rethrown afterward — a single error unchanged, several as an `AggregateError`, the same shape `EffectImpl.destroy()` already uses
- `SignalGroup.attachGroup()` rejects an edge that would close a cycle in the group graph (`a.attachGroup(b); b.attachGroup(a)`), the way it already rejected `group.attachGroup(group)`. Such a cycle used to send `hasSignal()`, `signal()`, `runEffects()`, `off()` and `clear()` into unbounded recursion (BUG-002, audit 2026-08-06)
- `hasSignal()`, `signal()`, `runEffects()`, `off()` and `clear()` additionally refuse to re-enter a walk they are already inside, so neither a cycle that arose some other way nor user code re-entering from a listener can exhaust the stack. This matters most for `clear()`: it runs from the `FinalizationRegistry` callback, where a `RangeError` is out of reach for any application-level `try`/`catch` — it is caught and reported there now, but the recursion would still have burnt the stack first (BUG-002, audit 2026-08-06)
- `SignalGroup.attachSignalByName(name, signal)` no longer accumulates every signal a name ever held. Binding a name is the group's only hold on a signal unless `attachSignal()` was called for it too, so rebinding the name destroys the signal it displaces — signals held by another name and explicitly attached ones are exempt (MEM-003, audit 2026-08-06)
- `SignalGroup.attachSignalByName(name, undefined)` releases the name the same way instead of only deleting the lookup entry. The name used to read as gone while every signal ever bound to it stayed attached and was destroyed by the next `clear()` (MEM-003, audit 2026-08-06)
- `createMemo(fn, {attach, name})` called in an effect body no longer leaves one dead memo signal per rerun in the group. The memo's internal effect dies as a child effect, but its signal was reachable only through the name the next rerun rebinds — it is now destroyed at that point (MEM-003, follow-up to MEM-005, audit 2026-08-06)
- The instance methods `group.clear()` and `group.off()` run the teardown to the end when a cleanup callback or a `DESTROY`/`OFF` listener throws. A single failure used to abort everything after it: sibling effects stayed alive and subscribed, signals were not destroyed, links not torn down, and the group stayed registered in the store. Failures are now collected and rethrown afterwards — one unchanged, several as an `AggregateError` in teardown order, the same shape `Effect.destroy()` already uses. `off()` additionally emits its `OFF` event either way
- A destroyed effect or signal takes itself out of the `SignalGroup` that holds it, instead of sitting in the group's internal sets until the next `clear()`. A long-lived group (a component host, a `@signal`-decorated object) with effect or signal churn used to accumulate every dead `EffectImpl` — callback closure included — and every destroyed signal, while `getEffectsCount()`/`getSignalsCount()` correctly reported them gone
- Destroying a signal that was attached by name also releases the name: `hasSignal(name)` turns `false`, and a remaining candidate under that name takes the slot over by the same rule `detachSignal()` uses. This is the path the `@signal` decorator takes, where `attachSignalByName()` is the only way into the group
- An effect that destroys itself in the middle of its own callback (or is destroyed by an `onCreateEffect()` handler before it ever ran) no longer subscribes to any more signal reads afterward. Those late subscriptions used to be unremovable — `destroy()` had already discarded its unsubscribe handles — pinning the effect and its callback closure on the global queues forever
- An effect that becomes untriggerable is destroyed regardless of the order in which its dependencies stop tracking it — including when one was hard-destroyed (`signal.destroy()`) before a later `SignalGroup.off()` soft-detaches the rest. Such an effect used to survive as a zombie, permanently subscribed to the global effect queue with no way left to wake it
- An effect that destroys itself in the middle of its own callback no longer loses the cleanup that same callback returns. `run()` still finishes the callback after `destroy()` has already run its own cleanup, but that cleanup is now executed right away instead of being stored where nothing will ever call it
- A memo's internal effect now unsubscribes from the global destroy queue when it dies before its signal does — e.g. its last live dependency was destroyed. That subscription used to stay behind indefinitely, holding the dead effect and its callback closure alive for as long as the memo signal itself lived, which for a memo whose inputs are gone is the remaining process lifetime
- `createMemo(fn, {attach})` **without** `name`, called inside an effect body, no longer leaves a new signal in the group on every parent rerun — the signal now dies with the effect that created it, the same way the named case already did through its rebind
- `createMemo(fn, {attach, name})` called inside an effect body no longer outlives the effect that created it: destroying the parent, or a `group.off()` on the attached group, used to leave such a signal live and still resolvable by name — both now destroy it along with the effect, the same as the unnamed case
- The static `SignalGroup.clear()` now sweeps every registered group even when one of them throws during teardown, instead of aborting at the first failure and leaving the remaining groups fully built up and registered — the caller used to have to call it in a loop to be sure the registry was empty. Errors are collected and rethrown afterward — a single one unchanged, several as an `AggregateError`
- A `SignalGroup` teardown that throws from the `FinalizationRegistry` callback no longer takes the process down: the error is now reported via `console.error` instead, since a registry callback has no caller left to hand it to
- A link callback that destroys its own link mid-propagation no longer throws `TypeError: Cannot assign to read only property 'lastValue'` out of the `signal.set()` that started the delivery, and the remaining links on that source are served to the end. `updateValue()` re-checks `isDestroyed` after handing control to application code (BUG-001)
- `SignalLink.destroy()` sets `isDestroyed` before it emits `DESTROY`, so an `on()` listener that calls `destroy()` again hits the guard instead of recursing into an unprotected teardown until the stack overflows (BUG-002, audit 2026-08-07)
- A propagation overtaken by a feedback write no longer appends its stale value afterwards: `'value'` and `lastValue` carry the value that survived, so a `nextValue()`/`asyncValues()` consumer never sees a regression to an older value (BUG-008, audit 2026-08-07)
- An effect run inside `beQuiet()` keeps its dependencies instead of unsubscribing them. This hit the `{autorun: false}` pattern, where the owner wraps its own `run()` in a quiet frame: the effect went permanently deaf afterwards — no write reached it, `run()` was a no-op — and kept counting in `getEffectsCount()` (BUG-005, audit 2026-08-07)
- An effect callback that throws *after* reading still unsubscribes the signals it stopped reading — the pruning now sits in a `finally`. A deterministically failing effect used to keep a live RECALL subscription on a signal it no longer read, running into the same error on every write to it (BUG-006, audit 2026-08-07)
- A callback that throws *before* its first read keeps every dependency instead of committing the empty set it never got to build, so a single transient failure no longer leaves the effect permanently deaf (BUG-006, audit 2026-08-07)
- An effect that writes a signal it depends on now runs the cleanup of **every** nested run instead of storing only the oldest. A superseded or displaced cleanup runs right away, the same way a superseded `async` run's cleanup does (BUG-007, audit 2026-08-07)
- A superseded cleanup that throws synchronously now reports to `onEffectError()` with `phase: 'cleanup'` instead of surfacing at whoever wrote the signal — for the `destroy()` path that throw used to escape the teardown entirely (BUG-007, audit 2026-08-07)
- A cleanup that writes a signal can now trigger further effect runs, because it actually runs at the point it is superseded rather than being dropped (BUG-007, audit 2026-08-07)
- An effect callback that throws no longer ends the delivery of a signal write: every subscribed effect runs, in priority order, and the failures reach whoever wrote afterwards — a single one unchanged, several as an `AggregateError` in delivery order. Lower-priority effects used to be skipped and never learned that the value had changed (BUG-004, audit 2026-08-07)
- The same holds for the flush of a `batch()`: a throwing effect no longer holds up the remaining delayed effects, and its failure arrives at the `batch()` caller once the flush is complete (BUG-004, audit 2026-08-07)
- A synchronous effect-callback failure still does **not** go through `onEffectError()` — that channel stays reserved for failures with no caller left to throw at (BUG-004, audit 2026-08-07)
- **Changed shape of what a write throws** when a signal has both a failing effect and a throwing `link()` callback: the write now raises an `AggregateError` over both, where it used to raise the effect's error alone — the link callback never ran, because the effect's throw had already ended the delivery. A link callback is still not isolated and still ends the delivery; it just no longer takes the failures collected before it with it (BUG-004, audit 2026-08-07)
- An effect with static `dependencies` that survives a `SignalGroup.off()` hears its detached group signal again from its next run onwards. It re-declares its dependency set at the start of every run instead of only at construction time; it used to stay deaf to that signal for the rest of its life, because its callback runs without auto-tracking and nothing re-subscribed afterwards (BUG-003, audit 2026-08-07)
- `off()` remains a pause: until that next run the effect misses every write to the detached signal, and an effect whose only dependency was a group signal is still destroyed by `off()` (BUG-003, audit 2026-08-07)
- A destroyed dependency is skipped whenever the declared set is subscribed — at construction time as well as on every run. `createEffect(cb, [alreadyDestroyed, live])` used to subscribe to both, and the effect then survived the destruction of `live` as a deaf shell holding two unremovable subscriptions; a signal destroyed after a `SignalGroup.off()` detach is not subscribed again either (BUG-003, audit 2026-08-07)
- `beQuiet(action)` now returns what `action` returns (previously `void`) — the documented untracked peek was always `undefined`, without a type error; the change is runtime-only and unchanged for every caller that ignores the value (BUG-010)
- The signature also — like `batch()` — rejects an `async`/thenable-returning `action` at compile time: the quiet frame ends at the first `await`, and every read and write after that point is tracked and loud again. No runtime check, unlike `batch()` (BUG-010)
- The static `SignalGroup.clear()` no longer throws a group created *during* the sweep — e.g. from a `DESTROY` listener — out of the registry. It stayed in `store` and was still handed out by `findOrCreate()`, but no longer counted by `getSignalGroupsCount()`, was unreachable by any further sweep, and its `FinalizationRegistry` backstop could never fire again (BUG-009)
- A link that becomes unreachable together with its source signal now releases its subscriptions on `globalSignalQueue`/`globalDestroySignalQueue` as well — two for a callback target, three for a signal target — instead of only correcting `getLinksCount()`. Measured before the fix: 10 000 dropped pairs left 10 000 entries on each queue and ~2.2 KB of heap per pair behind while `getLinksCount()` reported 0 (MEM-001, audit 2026-08-07)
- A release handle that throws while a collected link is being cleaned up is reported through `console.error` instead of taking the process down out of the `FinalizationRegistry` callback, and the remaining handles are released regardless (MEM-001, audit 2026-08-07)
- The error of a failed `SignalLink` teardown now reads `[signalize] N errors while tearing down a SignalLink` (previously "… while releasing SignalLink destroy-queue subscriptions") — the collection covers `DESTROY` listeners and the `globalSignalQueue` release too, not just the destroy-queue handles (MEM-001, audit 2026-08-07)
- A link attached through `SignalGroup#attachLink()` takes itself out of the group when it is destroyed. Only a link attached via `link(…, {attach})` or `link.attach(obj)` used to do that; a directly attached one stayed in the group's internal set for the lifetime of the group, keeping its source `SignalImpl` and its callback closure reachable (MEM-002, audit 2026-08-07)
- That counter-edge is delivered with `Priority.Max`, so it also runs when a `'destroy'` listener of the same link throws — eventize aborts delivery at a throwing listener, and until now the registration order decided whether the group got rid of its dead link. The guarantee covers every listener below `Priority.Max`; `Priority.Max` is `+Infinity` and not an exclusive slot, so a listener registered at that same priority *before* the attach still runs first and can still swallow the counter-edge. Named side effect: a `'destroy'` listener no longer sees the link in the group in any case (MEM-002, audit 2026-08-07)
- The last `asyncValues()` iterator switches retaining of `'value'` off instead of only clearing the stored value. Until now the first `asyncValues()` call put a link into retain mode permanently: every further propagated value landed in the slot with nobody listening, and a later `nextValue()` resolved synchronously with that stale value instead of waiting for the next one (MEM-004, audit 2026-08-07)
- Behaviour change that follows from it: a `retain(link, 'value')` set by the caller no longer survives an `asyncValues()` run. `asyncValues()` has always claimed that event's retain policy for itself; it now gives it up at the end instead of leaving it standing (MEM-004, audit 2026-08-07)
- `getSignalsCount()` corrects itself through a `FinalizationRegistry` when a signal is dropped instead of destroyed, so it counts reachable signals rather than created ones (measured: 2000 dropped signals took the count from 2000 to 0, where it used to stay at 2000 for the lifetime of the process). The correction is eventually consistent — it lands at a moment that cannot be observed or forced (MEM-006, audit 2026-08-07)
- `SignalAutoMap` evicts an entry whose signal is destroyed from the outside instead of keeping the corpse cached: `has(key)` is `false` in the same synchronous turn and `get(key)` creates a fresh, live signal (measured: 1000 dead keys → 0). A soft detach via `SignalGroup#off()` is not a destruction and leaves the entry alone (MEM-007, audit 2026-08-07)
- A `SignalAutoMap` that is dropped without `clear()` releases its per-entry destroy-queue subscriptions itself, through a `FinalizationRegistry`, and stays collectible (measured: 400 subscriptions → 0). Its signals are collected with it, not destroyed (MEM-007, audit 2026-08-07)
- The three module-level roots of `SignalGroup` hold a group weakly: the set of live groups stores `WeakRef`s, the `FinalizationRegistry`'s held value is a `WeakRef` instead of the group, and the per-signal destroy-queue listener knows both group and signal through `WeakRef`s. A host whose only back-reference is a signal value — the `@signal() accessor self = this` shape — is now collected together with its group (measured: 1000 of 1000 hosts survived a `gc()` before, 0 of 1000 after) (MEM-003, audit 2026-08-07)
- A `SignalGroup` collected together with its host releases its subscriptions on `globalDestroySignalQueue` through a second `FinalizationRegistry` (measured: 2000 listeners → 0). Without it the leak would only have moved from the group to the queue (MEM-003, audit 2026-08-07)
- Unchanged limit, now stated with its measured cause: an attached effect whose callback closure captures the host still prevents collection, because every live effect is reachable from the global effect queue for as long as it exists — with or without a group (measured: 500 hosts → 500, and 200 group-less effects pin 200 of 200 hosts) (MEM-003, audit 2026-08-07)
- A `SignalGroup` collected together with its host has not run `clear()`: it emits no `DESTROY` event, and its signals are collected rather than destroyed (MEM-003, audit 2026-08-07)

### Documentation

- Documented the condition under which automatic `SignalGroup` cleanup via `FinalizationRegistry` cannot fire: any strong reference path from the group back to the user object — an attached signal whose value holds the object and an attached effect whose closure captures it are the two ordinary ones, and both block reclamation equally. For `@signal accessor` fields storing a reference to `this`, explicit `SignalGroup.delete()` or `group.clear()` in a destructor remains the reliable cleanup path (MEM-006, audit 2026-08-06)
- Corrected the documented condition under which the `SignalGroup` GC backstop does not fire (the entry above it, from the previous release cycle): the signal-value half no longer applies at all, and the effect half is caused by the global effect queue rather than by the group holding the effect. The new, fourth limit — a silently collected group never runs `clear()` — is documented alongside it in `docs/api.md`, `docs/architecture.md` and the pitfalls reference (MEM-003, audit 2026-08-07)
- Documented the actual lifetime of a `SignalLink`: while its source is reachable, it is held by an internal registry keyed on that source until `destroy()`, `unlink()`, a cleared `{attach}` group, or the destruction of source/target — not by garbage collection alone, even once every external reference to the link itself is dropped. A link that becomes unreachable together with its source is eventually reclaimed too, but only its count, not its queue subscriptions. The comments in `link.ts`/`SignalLink.ts` that previously promised a weakly-held link now describe what the code does

### Chores

- Removed the child-effect slot-recycling machinery from `EffectImpl` (`curChildEffectSlot`, `getCurrentChildEffect()`). It was unreachable — `run()` clears the child list before every callback — and suggested an optimization that never existed. `childEffects` is a plain list now; behaviour is unchanged (IMP-001)
- `SignalGroup.findOrCreate()` checks `store.get(object)` before constructing, instead of unconditionally building a full `SignalGroup` (four `Set`s, two `Map`s, a `WeakMap`, `WeakRef`, `FinalizationRegistry.register`, `eventize(this)`) and discarding it on every cache hit. The private constructor's own `store.has()` check stays in place as a safety net for direct/re-entrant construction, it just no longer carries the common case (PERF-002)
- `SignalAutoMap.updateFromProps()` now computes its entries and returns before opening a `batch()` when there are none, matching the guard `update()` already had for an empty `Map` (PERF-004)
- Added `fast-check` as a devDependency for the new ordering property suite

### Tests

- New microbenchmark suite under `bench/` (Vitest Bench, `pnpm bench`) covering signal writes (with/without subscribers), memo recompute, effect create/destroy, `SignalGroup.findOrCreate`, and `batch()` overhead. CI runs it informatively — no regression gate yet (PERF-003)
- `assertEffectSubscriptionsCountChange()` double-counted the baseline against a non-zero starting subscription count, an error masked only because its one caller always started from zero (TEST-007). `unsubscribeEffect.spec.ts` — cited by `CLAUDE.md` and `AGENTS.md` as the reference for verifying subscription leaks — now actually carries a subscription-count balance (TEST-010)
- `SignalGroup.spec.ts`'s `detachGroup() removes child group` and `clear() detaches from parent group` now assert `getGroupMemberCounts()` after the detach instead of arguing through a re-attach that proved nothing. Every collection point in `SignalGroup.off()`/`clear()` that catches a throwing teardown step (a child group, a link, a detach listener, an `OFF`/`DESTROY` listener, a destroy-queue subscription) now has its own test proving the rest of the teardown still runs to completion. The second branch of the parent-chain cycle guard in `attachGroup()` — reachable only through a cyclic parent chain that the public API itself refuses to construct — is now exercised via the new `@internal` test seam `$setParentGroup` (TEST-001, TEST-004, TEST-009)
- `Signal#muted`, `findObjectSignals()` and the other `object-signals.ts` lookups on a store-less object, the `@signal({readAsValue: true})` decorator option, the `[obj, name]` tuple overload of `touch()` (including its no-op guards), and the priority splice inside `batch()` now have tests — the new `src/object-signals.spec.ts` is this module's first spec file (TEST-002, TEST-003)
- The one assertion in the project that hung on a wall-clock threshold — the `Promise.race` in the ASYNC-005 `SignalLink.spec.ts` test — now races against a macrotask sentinel (`setImmediate`) instead of a 200 ms `setTimeout`, so the outcome is decided by event-loop ordering rather than a shared CI runner's timing. The two remaining `rejects.toBeDefined()` calls in `SignalLink.spec.ts` now pin down the concrete rejection reason (`controller.signal.reason`), matching the other eight rejection assertions in the file (TEST-011, TEST-015)
- Coverage thresholds are now per file instead of one global average, staggered across three tiers (a floor under every file, 100% for every file outside the current audit worklist, and a 100%-with-slack tier for the files still on it) (TEST-006)
- A new smoke test (`smoke/dist-smoke.test.ts`, `pnpm test:smoke`) loads the built `dist/` through the package's own `exports` map on plain Node, instead of anything in `src/`. It is the first test where a `@signal() accessor` application is lowered by **tsc**, the way a consumer's own compiler would, rather than by SWC's `decoratorVersion: '2022-03'`, which every other decorator test runs through (TEST-008)
- A new fast-check property suite (`src/ordering.property.spec.ts`) pins the ordering invariants that only ever had one or two handwritten examples: priority order with and without a batch, dedup and final-value visibility in a batch flush, nested batches behaving like one flat batch, nested effects rebuilding in pre-order on every rerun, and a memo read during a flush never seeing a stale value. All five `it()` blocks run against a fixed seed for reproducible failures (TEST-012)
- The four `*.gc.spec.ts` suites fail instead of skipping themselves when the run has no `--expose-gc` (BUILD-016)

### Build System

- `pnpm test` now runs the GC suites (`SignalGroup.gc.spec.ts`, `link.gc.spec.ts`) itself, via a dedicated `gc` project in `vitest.config.ts` (`--expose-gc`, Vitest's default `forks` pool), so they are measured in the same coverage run as everything else instead of only under `pnpm test:gc`. `pnpm world` now includes the `test:gc` step (TEST-005, TEST-014)
- `pnpm world` and CI now also run `checkPkgTypes` and `test:smoke`, both against a freshly built `lib/`/`dist/` (`pnpm dist`, which runs before either); `pnpm smoke` runs the smoke test's build-and-run pair on its own, and `pnpm clean` removes `smoke/build` along with the other generated directories (TEST-008, BUILD-008)
- `pnpm checkPkgTypes` now runs `attw --pack --profile esm-only` instead of the unprofiled `attw --pack`, and is bestable for the first time: the unprofiled check always failed, because `node10` and `node16 (from CJS)` cannot pass for a package that is ESM-only and uses a subpath export — the profile excludes exactly those two modes and leaves `node16 (from ESM)` and `bundler` checked in full (BUILD-008)
- New `pnpm typecheck` script (`tsc --noEmit -p tsconfig.json`) runs a real compiler pass over specs, benchmarks and the Vitest configs — code that was previously only transpiled by SWC and never type-checked. Wired into `pnpm world` (after `check`, before `compile`) and into CI, right after the `pnpm check` step (BUILD-003)
- CI runs on pull requests against `main` now too, so a PR from a fork is actually checked (BUILD-002)
- A push to `main` runs the same CI workflow as any feature branch, via `workflow_call`, before the deploy job publishes — previously only `pnpm lint` and `pnpm test` (BUILD-002)
- `scripts/publishPackage.cjs` now exits with code 1 when `npm show` fails, and reports a failed `npm publish` with npm's own error output instead of crashing with `ERR_INVALID_ARG_TYPE` (BUILD-010)
- `vitest.config.ts` refuses to start when a coverage threshold glob group matches no file — an empty group used to pass silently and enforce nothing (BUILD-015)
- the published tarball is an allowlist (`package.json#files`) instead of an `.npmignore` denylist — 125 files / 550 kB down to 42 files / 319 kB, and an internal planning document no longer ships (BUILD-001)
- `lib/*.js` and `lib/*.js.map` are no longer published; no resolution path ever reached them and they were 25 % of the tarball (BUILD-006)
- the test-only assertion helper moved to `src/__testing__/` and is excluded from the declaration build, so the published package no longer carries a module that calls Vitest's global `expect` (ARCH-004)

### Breaking Changes

- **Removed the `@memo` decorator** and its `MemoDecoratorOptions` type from `@spearwolf/signalize/decorators`. Syntax and semantics were not settled — replace `@memo() foo() {...}` with a class field `foo = createMemo(() => ..., {attach: this})`, which is eager by default. `createMemo()` itself is unchanged
- The cleanup an `async` effect callback resolves to is no longer picked up lazily at the next run or at `destroy()` — the promise returned by the callback is followed as soon as it settles instead. The cleanup of the current run is stored and never lost; the cleanup of a superseded or destroyed run runs right then, as soon as its promise settles, rather than being stored at all (ASYNC-002)
- Internal `Symbol.for` keys now use the `@spearwolf/signalize/` namespace (`signal`, `effect`, `recall`, `destroySignal`, `createEffect`, `destroyEffect`) to prevent collisions with unrelated code. Pre-fix versions will not recognize signals created by post-fix versions, but all post-fix versions recognize each other (BUG-006, audit 2026-08-06)
- `SignalLink.nextValue()` now rejects with `Error('SignalLink destroyed before the next value arrived')` instead of `undefined` when the link is destroyed while the call is pending. A `catch` that checked `err === undefined`, or otherwise depended on the rejection reason being empty, observes a different value now (ASYNC-004)
- `SignalGroup.attachSignalByName()` gives the name ownership of the signal: rebinding the name, or passing `undefined`, destroys the signal that was bound to it. Code that rebound a name and kept using the old signal now holds a destroyed one — it still works as a value container, but no longer drives effects. Attach such a signal explicitly with `attachSignal()` to keep it alive. Conversely, `clear()` no longer destroys the pile of signals a repeatedly rebound name used to accumulate; they are gone by then (MEM-003, audit 2026-08-06)
- `batch(callback)`'s signature now rejects an `async` callback (or anything else typed to return `Promise`/`PromiseLike`) at `tsc` time, and throws `TypeError` at runtime if `callback` returns a thenable. Code that passed an `async` callback previously compiled and appeared to work — it silently stopped batching at the first `await` — and now fails both to compile and, if the type error is ignored or the callback is untyped, at runtime (ASYNC-003)
- `createMemo()`'s recompute no longer wraps `si.set(callback())` in `batch()` by default. This fixes a read-consistency bug present since `batch()` was unconditional: `EffectImpl.run()` defers any run while a batch is open, including another memo's recompute triggered by reading it (a memo's tracked read runs it via exactly that path) — so a `callback` that read a dirty *composed* memo got that memo's stale, pre-recompute value, permanently so for a `{lazy: true}` one (its deferred run inside the batch flush is a no-op, since `autorun` is `false`). Composed memos are the common case; removing the batch stops that specific deferral, so the default no longer turns an already-dirty one's read stale on that account. The trade-off: if `callback` itself writes to *other* signals as a side effect (uncommon), those writes used to be grouped with the memo's own write so a dependent effect tracking both saw one deduplicated run — without the batch it now sees one run per write, with a torn intermediate value on the first of the two. Pass `{batchWrites: true}` to restore the old grouping, at the cost of reintroducing the staleness risk above (PERF-001)
- A `'destroy'` listener on a `SignalLink` now sees `isDestroyed === true`, because the flag is set before the event is emitted. Every method that guards on that flag therefore behaves as it does on an already-dead link when called from such a listener: `attach(obj)` throws `Cannot attach a destroyed link to a group` instead of quietly attaching a dead link to a group, `mute()`/`unmute()`/`toggleMute()` change nothing and emit no `'mute'`/`'unmute'`, `touch()` propagates nothing, and `nextValue()` rejects immediately instead of waiting for a value (BUG-002, audit 2026-08-07)
- A propagation run that a feedback write overtakes drops its `'value'` emission instead of emitting the superseded value after the newer one. Per write, one emission fewer can arrive at a `'value'` listener, a `nextValue()` or an `asyncValues()` iterator than before — the one that arrives is the value both signals actually hold (BUG-008, audit 2026-08-07)
- `SignalAutoMap#delete(key)` returns `false` for a key whose signal was destroyed from the outside, where it used to return `true`. The entry now leaves the map together with its signal, so by the time the call happens there is nothing left to remove — `has(key)` is already `false`. `Map.prototype.delete` semantics are unchanged; only the precondition disappeared. Code that used `delete()` as the cleanup for externally destroyed entries can drop the call; code that branched on its return value sees the other branch (MEM-007, audit 2026-08-07)
- `getSignalsCount()` now counts reachable signals instead of created ones, and settles eventually rather than immediately: a signal dropped without `destroySignal()` is subtracted only once the garbage collector reclaims it, at a moment that cannot be observed or forced. Code that reads the count right after a teardown as a deterministic leak assertion — `src/__testing__/assert-helpers.ts` does exactly this — can see a stale, too-high number even though nothing actually leaked. Poll the count (or force a collection with `--expose-gc`) instead of reading it once (MEM-006, audit 2026-08-07)
- A `set()` on a signal with both a failing effect and a throwing `link()` callback now throws an `AggregateError` over both failures, where it used to throw the effect's error alone. A `catch` that assumes the thrown value *is* the effect's error — an `instanceof` check against a specific error type, or a direct read of `.message` — now sees the `AggregateError` wrapper instead and needs to unwrap `err.errors` to reach the original failures (BUG-004, audit 2026-08-07)
- A `retain(link, 'value')` set by the caller no longer survives an `asyncValues()` run on that link: `asyncValues()` claims the `'value'` retain policy for itself for the duration of the iteration and gives it up again once the last iterator stops, taking the caller's own retain setting down with it. Code that relies on `'value'` staying retained after an `asyncValues()` loop has finished needs to call `retain(link, 'value')` again afterwards (MEM-004, audit 2026-08-07)

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
