# CHANGELOG

Which of these changes you may rely on depends on the version they ship in —
see [Versioning & stability](./README.md#versioning--stability). Entries under
`## Unreleased` have not shipped in any version yet.

## Unreleased

### Breaking Changes

- `SignalGroup#attachEffect(eff)` now takes the `Effect` that `createEffect()` returns and gives the argument back with its own type; a wrapper that previously only got in with `as any` is unwrapped on the way. A **destroyed** wrapper now throws instead of being quietly accepted, and an attached wrapper takes itself out of the group on `destroy()` instead of staying in it until `clear()` (API-001)
- The callbacks of `onCreateEffect()` and `onDestroyEffect()` are typed `(effect: FailingEffect) => void` instead of `(...args: unknown[])`; a handler demanding a wider parameter is rejected, and the eventize-native subscribe forms (`onCreateEffect(priority, cb)`, `onCreateEffect(listenerObject)`) are no longer part of the contract — priority now sits in second place, as it does on `onEffectError()` (API-002)
- The recursion guard's message names `setMaxEffectDepth(n)` instead of `raise EffectImpl.maxDepth`; code matching on the message text needs updating — the `maxDepth=N` part is unchanged (API-003)
- **Removed the `@memo` decorator** and its `MemoDecoratorOptions` type from `@spearwolf/signalize/decorators`. Syntax and semantics were not settled — replace `@memo() foo() {...}` with a class field `foo = createMemo(() => ..., {attach: this})`, which is eager by default. `createMemo()` itself is unchanged
- The cleanup an `async` effect callback resolves to is no longer picked up lazily at the next run or at `destroy()` — the promise returned by the callback is followed as soon as it settles instead. The cleanup of the current run is stored and never lost; the cleanup of a superseded or destroyed run runs right then, as soon as its promise settles, rather than being stored at all (ASYNC-002, 2026-07 audit)
- Internal `Symbol.for` keys now use the `@spearwolf/signalize/` namespace (`signal`, `effect`, `recall`, `destroySignal`, `createEffect`, `destroyEffect`) to prevent collisions with unrelated code. Pre-fix versions will not recognize signals created by post-fix versions, but all post-fix versions recognize each other — a process that ends up with one of each shares nothing, so upgrade every copy of the package together (BUG-006, audit 2026-08-06)
- `SignalLink.nextValue()` now rejects with `Error('[signalize] SignalLink destroyed before the next value arrived')` instead of `undefined` when the link is destroyed while the call is pending. A `catch` that checked `err === undefined`, or otherwise depended on the rejection reason being empty, observes a different value now (ASYNC-004, 2026-08-06 audit)
- `SignalGroup.attachSignalByName()` gives the name ownership of the signal: rebinding the name, or passing `undefined`, destroys the signal that was bound to it. Code that rebound a name and kept using the old signal now holds a destroyed one — it still works as a value container, but no longer drives effects. Attach such a signal explicitly with `attachSignal()` to keep it alive. Conversely, `clear()` no longer destroys the pile of signals a repeatedly rebound name used to accumulate; they are gone by then (MEM-003, audit 2026-08-06)
- `batch(callback)`'s signature now rejects an `async` callback (or anything else typed to return `Promise`/`PromiseLike`) at `tsc` time, and throws `TypeError` at runtime if `callback` returns a thenable. Code that passed an `async` callback previously compiled and appeared to work — it silently stopped batching at the first `await` — and now fails both to compile and, if the type error is ignored or the callback is untyped, at runtime (ASYNC-003, 2026-07 audit)
- `beQuiet(action)` returns what `action` returns instead of `void`, and its signature rejects an `async` action (or anything else typed to return `Promise`/`PromiseLike`) at `tsc` time — the same narrowing `batch()` got, for the same reason: the quiet frame is closed by its `finally` the moment an `async` action hands back its pending promise at the first `await`, so every read and write from there on is tracked and loud again. Unlike `batch()` there is **no** runtime check, so an untyped caller returning a duck-typed thenable still gets a silently broken frame; do the awaiting outside and pass a synchronous action. Callers that ignored the return value are unaffected by the widened return type (BUG-010)
- `createMemo()`'s recompute no longer wraps `si.set(callback())` in `batch()` by default. If `callback` itself writes to *other* signals as a side effect (uncommon), those writes used to be grouped with the memo's own write so a dependent effect tracking both saw one deduplicated run — without the batch it now sees one run per write, with a torn intermediate value on the first of the two. Pass `{batchWrites: true}` to restore that grouping; the default leaves its cost unpaid for every memo that does not need it — a full batch flush per recompute, once the memo has a dependent effect (see the Performance entries, PERF-002, audit 2026-08-08) (PERF-001, 2026-07 audit)
- A `'destroy'` listener on a `SignalLink` now sees `isDestroyed === true`, because the flag is set before the event is emitted. Every method that guards on that flag therefore behaves as it does on an already-dead link when called from such a listener: `attach(obj)` throws `[signalize] Cannot attach a destroyed link to a group` instead of quietly attaching a dead link to a group, `mute()`/`unmute()`/`toggleMute()` change nothing and emit no `'mute'`/`'unmute'`, `touch()` propagates nothing, and `nextValue()` rejects immediately instead of waiting for a value (BUG-002, audit 2026-08-07)
- A propagation run that a feedback write overtakes drops its `'value'` emission instead of emitting the superseded value after the newer one. Per write, one emission fewer can arrive at a `'value'` listener, a `nextValue()` or an `asyncValues()` iterator than before — the one that arrives is the value both signals actually hold (BUG-008, audit 2026-08-07)
- `getSignalsCount()` now counts reachable signals instead of created ones, and settles eventually rather than immediately: a signal dropped without `destroySignal()` is subtracted only once the garbage collector reclaims it, at a moment that cannot be observed or forced. Code that reads the count right after a teardown as a deterministic leak assertion — `src/__testing__/assert-helpers.ts` does exactly this — can see a stale, too-high number even though nothing actually leaked. Poll the count (or force a collection with `--expose-gc`) instead of reading it once (MEM-006, audit 2026-08-07)
- A write to a signal with **several** failing effects now throws an `AggregateError` over all of them, in delivery order, where it used to throw the first effect's error alone and skip every effect queued behind it. The flush of a `batch()` behaves the same way and hands the wrapper to the `batch()` caller once the flush is complete. A `catch` that assumes the thrown value *is* the effect's error — an `instanceof` check against a specific error type, or a direct read of `.message` — needs to unwrap `err.errors`; a write with a single failing effect is unchanged and still rethrows that error unchanged (BUG-004, audit 2026-08-07)
- That same `AggregateError` now also covers a throwing `link()` callback: a `set()` on a signal with both a failing effect and a throwing callback raises both failures, where it used to raise the effect's error alone — the link callback never ran, because the effect's throw had already ended the delivery. A link callback is still not isolated and still ends the delivery; it just no longer takes the failures collected before it with it (BUG-004, audit 2026-08-07)
- An `asyncValues()` iterator no longer resolves a read for which nothing new was propagated. `iter.next()` used to settle immediately with the previous value whenever the retained slot still held one — from the first propagated value on, that was every read — and now waits for the next propagation instead. Code that drove such an iterator by hand and relied on a read returning at once, or that counted the values a loop saw per write, observes the change; a `for await` that consumes what it is given does not. `nextValue()` called directly is exempt and still settles on the retained value (ASYNC-005, audit 2026-08-07)
- A `retain(link, 'value')` set by the caller no longer survives an `asyncValues()` run on that link: `asyncValues()` claims the `'value'` retain policy for itself for the duration of the iteration and gives it up again once the last iterator stops, taking the caller's own retain setting down with it. Code that relies on `'value'` staying retained after an `asyncValues()` loop has finished needs to call `retain(link, 'value')` again afterwards (MEM-004, audit 2026-08-07)
- A `batch()` that fails on both sides — its callback throws, or it returns a thenable and trips the guard, *and* the flush afterwards fails too — now throws an `AggregateError` over both, where it used to throw the effect's error alone and drop the other without a trace. A `catch` that reads `.message`, or does an `instanceof` check on the thrown value (`TypeError` included), sees the wrapper now and needs to unwrap `err.errors`; a batch in which only one side fails is unchanged and still rethrows that error unchanged (BUG-012, audit 2026-08-08)
- `destroySignal()` on a signal with two failing effect cleanups now throws an `AggregateError` over both, in delivery order, where it used to throw the first one alone and abandon the rest of the delivery. A `catch` that reads `.message` or does an `instanceof` check sees the wrapper and needs to unwrap `err.errors`; a destroy with a single failing subscriber is unchanged and still rethrows that error unchanged, and so is `destroySignal(a, b)`, which still stops at the failing signal because the frame is per signal (BUG-011, audit 2026-08-08)
- `Effect.destroy()` with several failing teardown steps now throws an `AggregateError` over all of them, in teardown order, where it used to report only the first — the steps behind it never ran, so their failures did not exist. A `catch` that reads `.message` or does an `instanceof` check sees the wrapper and needs to unwrap `err.errors`; a single failing step is unchanged and still rethrows that error unchanged (MEM-008, audit 2026-08-08)
- A `createEffect()` or `createMemo()` whose creation fails **and** whose rollback fails on top of it now throws an `AggregateError` over both, creation error first, where the creation error used to arrive alone — there was no rollback to fail. Reached through a throwing `onDestroyEffect()` handler, a throwing cleanup, or a throwing subscriber of the memo signal's destruction; a `catch` that reads `.message` or does an `instanceof` check sees the wrapper. A creation that fails on its own — the overwhelmingly common case — is unchanged and still throws that error unchanged (audit follow-up, package 7b)
- An effect created inside another effect's callback, whose own first run throws, is now destroyed with the rest of that failed creation. It used to survive as a child of the parent effect and rerun on the next write — observable wherever the parent catches the failure instead of letting it through, which is the only case in which the parent lives long enough to notice. Only `{attach}` keeps such an effect now; being held by a parent no longer does (audit follow-up, package 7b)
- `unlink(source)` throws an `AggregateError` over every failed link instead of the first failure alone; `errors` is in teardown order. A single failure is unchanged — the same shape `clear()`, `Effect.destroy()` and `destroySignal()` already use (MEM-011, audit 2026-08-08)
- A `DESTROY` listener now sees the bookkeeping already done, not still pending: `SignalGroup`'s hook for an attached effect and `link()`'s registry hook run on `Priority.Max`, so such a listener finds the destroyed effect gone from its group and `getLinksCount()` already brought down, where an ordinary-priority listener used to observe both from before the teardown. Code that read either from a `'destroy'`/`DESTROY` listener as a "still there" check sees the other answer. Same caveat as `attachLink()`'s counter-edge: `Priority.Max` is `+Infinity` and not an exclusive slot, so a listener registered at that same priority *before* the hook still runs first — the guarantee covers every priority below it (MEM-009, MEM-010, audit 2026-08-08)
- `SignalGroup#attachEffect(effect)` throws `[signalize] Cannot attach a destroyed effect to a group` where it used to accept an already-destroyed effect silently and hold it until the next `clear()` — the same rule `attachSignal()` and `attachLink()` already applied (CONS-006, audit 2026-08-08)
- An `{autorun: false}` effect now runs when a batch that queued its explicitly requested `effect.run()` closes. Code that called `effect.run()` inside a `batch()` and relied on nothing happening — knowingly or not — sees the callback run once per batch it asked in (ASYNC-002, audit 2026-08-08)
- A memo read inside a `batch()` now recomputes at the read instead of returning its pre-batch value. Downstream effects are unaffected — the recompute's write goes into the same batch and is flushed with everything else — but code that read a memo inside a batch and compared it against the pre-batch value now sees the new one. `batchWrites` still defaults to `false`, because a memo with a dependent effect pays a full flush per recompute (see the Performance entries, PERF-002, audit 2026-08-08) (ASYNC-003, audit 2026-08-08)
- A memo that reads *both* a signal written in an open `batch()` *and* another memo now recomputes twice per batch instead of once, when it is read inside that batch. The upstream memo's recompute is pulled forward by the read and writes into the open batch, which marks the reader dirty again a moment after it read the fresh value, and the flush honours that second entry. A memo that reads only the upstream memo is not pulled forward at all and still recomputes once. Values and downstream effect runs are unchanged; what doubles is the number of `computer` invocations, and with `{batchWrites: true}` the side writes such a `computer` makes. An unbatched write plus read has always cost two (ASYNC-003, audit 2026-08-08)
- An effect that throws in the flush `hibernate()` performs is no longer recalled a second time when the surrounding batch closes, and that second, duplicate failure no longer arrives at the `batch()` caller. It is reported once, at the `hibernate()` caller (audit follow-up, package 12, audit 2026-08-08)
- `SignalGroup.delete(group)` tears the group down. Code that passed a group where a host object was expected used to get a silent no-op and now gets the full teardown — every attached signal, effect, link and child group is destroyed (API-014, audit 2026-08-08)
- `touch(x)` / `value(x)` throw for an `x` that is neither a signal nor an array. An *iterable* non-signal — a string, a `Set`, a generator — used to be spread into the object-signal lookup and answered `undefined` silently; it throws now. Both overloads already rejected such an argument at `tsc` time, so only untyped JavaScript callers can reach it (CONS-007, audit 2026-08-08)
- The type-parameter defaults of the published types are `unknown` instead of `any` (`SignalLike`, `SignalLink`, `ValueCallback`, `SignalGroup#signal()`); whoever annotated one of them without a type argument now names it — `SignalLike<number>` instead of `SignalLike`; where the annotation genuinely means "some signal, any value type" — a heterogeneous `SignalLike[]`, or a parameter of one's own wrapper — the replacement is `SignalLike<any>`, not `SignalLike<unknown>`: none of these type parameters widens to `unknown` — invariant in the signal types, contravariant in `ValueCallback` — so only `any` fits every value type. `SignalLink<T>` is the exception since API-007 below: it is covariant now, and a bare `SignalLink` accepts a `SignalLink<number>` again (TYPE-001, audit 2026-08-08)
- `SignalGroup#signal(name)`, `findObjectSignals()` and `SignalAutoMap#signals()`/`#entries()` hand out `Signal<unknown>` instead of `Signal<any>`; an assignment to a concrete type that used to pass in silence is a compile error now, closed with a type argument (`group.signal<string>('theme')`) or a check (TYPE-001, audit 2026-08-08)
- `attachSignal()`, `detachSignal()`, `attachSignalByName()`, `attachLink()` and `detachLink()` return the argument's own type instead of flattening it to `SignalLike<any>`/`SignalLink<any>` — a chain like `group.attachSignal(createSignal(1)).value` keeps `number`; for `attachSignalByName()` the return type is `S | undefined`, because the call without a signal stays legal (TYPE-003, audit 2026-08-08)
- `signal.set(fn)` and `createSignal<T>(fn)` without `{lazy: true}` are compile errors instead of silently storing the function as the value; `SignalWriter<T>` is an overload pair and `{lazy: true}` is required in the factory branch, not optional. What was almost always meant is the lazy form — give it its `{lazy: true}`; whoever really stores the function as a value names the type (`createSignal<() => number>(fn)`) (TYPE-002, audit 2026-08-08)
- `createSignal(fn)` without a type argument now infers `Signal<() => R>` instead of `Signal<R>` — the inference names what the signal really holds, and reports no error while doing so; the first compile error appears where the value is used (TYPE-002, audit 2026-08-08)
- `createSignal(fn, params)` and `signal.set(fn, params)` with a params *variable* typed `SignalParams<T>`/`SignalWriterParams<T>` no longer compile, even when that variable holds `{lazy: true}`: those types declare `lazy?: boolean`, and `boolean` is not a promise that the flag is `true`, so the factory branch stays shut and `TS2769` is reported. Write the literal at the call site (`createSignal(fn, {lazy: true})`), pin it (`{lazy: true} as const`), or annotate the variable `SignalParams<T> & {lazy: true}`; spreading (`{...params}`) does **not** help, the spread keeps `lazy?: boolean`. The value branch is untouched — `createSignal(v, params)`, `createSignal<T>(v, params)` and `set(v, params)` take any `SignalParams<T>`/`SignalWriterParams<T>`, variable or literal (TYPE-002, audit 2026-08-08)
- `SignalAutoMap#update()` takes `Map<string | symbol, unknown>` instead of `Map<any, unknown>`, and `fromProps()`/`updateFromProps()` take keys from `Extract<keyof T, string | symbol>` only; a numeric key used to create an entry that `keys()` afterwards claimed to be `string | symbol` (TYPE-005, audit 2026-08-08)
- `SignalLink#source` is a `LinkSource<T>` instead of an `ISignalImpl<T>` — four readable members (`id`, `value`, `muted`, `destroyed`) in place of the implementation layer. `source.writer(v)`, `source.reader()`, `source.object`, `source.valueFn`, `source.compare`, `source.lazy`, `source.beforeRead` and the assignments to `source.value` / `source.muted` are compile errors now; a link is a one-way read connection, not a second way to drive its own source. Whoever wrote through the link holds the `Signal` it was made from and writes there. In the same breath a retraction: because the narrow view carries no contravariant position any more, `SignalLink<T>` is covariant, and `const l: SignalLink = link(s, cb)` — a form the TYPE-001 entry above lists as broken — compiles again (API-007)
- `ISignalImpl` is no longer exported from `@spearwolf/signalize`. Whoever annotated the type got it through `SignalLink#source` and takes `LinkSource<T>` instead; there was no second way to reach it (API-007)
- `signal.set(v, {lazy: true})` with a plain value is a compile error (`TS2769`) instead of building a signal whose next read dies with `TypeError: this.valueFn is not a function`. The value overload of `SignalWriter<T>` is generic in its params now, closes for a statically `true` `lazy` — the literal, `{lazy: true} as const`, a variable annotated `SignalWriterParams<T> & {lazy: true}`, and `{lazy: flag}` where control flow has narrowed `flag` to `true` alike — and carries an exactness clause, so that inferring those params does not cost the excess property check: `set(5, {lasy: true})` stays the error it has always been. Untouched: an object literal naming declared options, a `SignalWriterParams<T>` variable including one that holds `{lazy: true}` (its `lazy?: boolean` is still not a static promise), a pass-through argument typed `SignalWriterParams<T>`, and a params object carrying a plain `string`, `number` or `symbol` index signature (`Record<string, unknown>`, `{[k: number]: unknown}`, `Record<symbol, unknown>` — those three key kinds are exempt from the exactness clause by design, a template-literal key pattern is not). Nine shapes that used to compile no longer do, each a loud `TS2769`: an options type that *extends* `SignalWriterParams<T>` with fields of its own, a variable whose inferred type carries a key the params type does not declare, an unrelated annotated type with an *optional* stray key, an intersection (`SignalWriterParams<T> & {mine: string}`), a class instance with a field beyond the options, the rest object of a destructuring, a pass-through wrapper generic in its params (`<Q extends SignalWriterParams<T>>(q: Q) => sig.set(v, q)`), a *pattern* index signature whose key is a template literal type such as `data-${string}`, and `{lazy: flag}` with `flag` narrowed to `true`. The repair for every one of them is to name the params type — annotate the variable `SignalWriterParams<T>` or assert it at the call site; for the wrapper, write `<T>(…, p: SignalWriterParams<T>) => sig.set(v, p)` instead of constraining a type parameter. **A spread repairs none of them**, measured: `{...opts}` drops freshness, not keys. Not symmetric with `createSignal`, which still leans on freshness and therefore rejects a stray key only inside an object literal, never in a variable (BUG-014, audit 2026-08-12)
- `createSignal(v, {lazy: true})` with a plain value is a compile error (`TS2769`) instead of building a signal whose first read dies with `TypeError: this.valueFn is not a function` — the constructor half of the `SignalWriter<T>` entry above, and it takes the same three clauses onto the value overload of `createSignal`. Refused are the four statically-`true` spellings of the flag: the literal, `{lazy: true} as const`, a variable annotated `SignalParams<T> & {lazy: true}`, and `{lazy: flag}` where control flow has narrowed `flag` to `true`. `createSignal(existingSignal, {lazy: true})` falls with them, which closes the one discarded passthrough parameter that could do damage. The no-initial-value overload carries the same clauses, because `undefined` is the single value that reaches it and would otherwise be the way around all of them — `createSignal(undefined, {lazy: true})` is refused under `strictNullChecks: true` (with the flag off, `undefined` is assignable to `() => Type` and the call reaches the factory overload instead), and `createSignal(undefined, strayOptions)` is refused under both. Untouched: an object literal naming declared options, a `SignalParams<T>` variable including one that holds `{lazy: true}` (`lazy?: boolean` is still not a static promise), a pass-through argument typed `SignalParams<T>`, and a params object carrying a plain `string`, `number` or `symbol` index signature. The exactness clause comes along because the flag fix requires it — refusing `{lazy: true}` while admitting `lazy?: boolean` needs a generic params type, and a generic params type costs the excess property check, so without it `createSignal(5, {lasy: true, compare})` would start compiling. What that costs is one rule rather than a tally, and the rule is about what the compiler infers for the params type, because that is what the clause tests. **(1) The inference resolves to a concrete key set** — refused with a loud `TS2769` if that set holds a key `SignalParams<T>` does not declare, required or optional, declared or inferred. Sharing keys with the options is not the deciding factor: a *pattern* index key such as `data-${string}` survives `Exclude` whole, so its entire key set counts as beyond and it is refused although it shares nothing. Shapes that land here: an interface extending `SignalParams<T>`, a variable with an inferred stray key, an unrelated annotated type with an *optional* stray key, an intersection, a class instance with a field of its own, the rest object of a destructuring that kept a valid key, and that pattern index key. **(2) The inference resolves to nothing testable** — refused outright, with no stray key anywhere: a bare type parameter, which is what a wrapper generic in its *own* params hands over (`<Q extends SignalParams<T>>(q: Q) => createSignal(v, q)`); `keyof Q` is unknown, the conditional stays deferred, and nothing is assignable to a deferred conditional. **(3) The inference never gets that far**, because the argument fails the constraint — it falls back to `SignalParams<T>`, the clause goes vacuous and the call compiles. That third outcome is the second cost and it runs the other way: TypeScript's weak-type check (`has no properties in common with`) used to refuse exactly that shape, and generic params give it up, because an intersection is never weak. A disjoint object *literal* is still refused by freshness ("Object literal may only specify known properties"); a disjoint *variable* such as `{label: string}` now compiles and does nothing at runtime. The repair for the first two outcomes is to name the params type — annotate the variable `SignalParams<T>` or assert it at the call site, and for the wrapper type the argument `SignalParams<T>` instead of constraining a type parameter; **a spread repairs none of them**, it drops freshness, not keys. A params object carrying a plain `string`, `number` or `symbol` index signature is exempt from the first outcome. `SignalWriter<T>` paid the same price in the entry above when it turned generic — that entry describes its cost as a key set reaching past the params type, which is the same imprecision and holds for `set()` too. One gap remains and is structural: naming the type argument switches both params conditions off (`createSignal<number>(5, {lazy: true})` compiles), because TypeScript has no partial type argument inference and an uninferred params type carries nothing to test — drop the type argument, the value infers it, and typo protection is unaffected either way. This also retracts the closing sentence of the `SignalWriter<T>` entry above, "Not symmetric with `createSignal`": the two are symmetric on exactness now (BUG-014, audit 2026-08-12)
- `createSignal<T>()` without an initial value returns `Signal<T | undefined>` instead of `Signal<T>` — the signal holds `undefined` until the first write, and the type finally says so. Under `strictNullChecks: true` every assignment of `.value`, `get()` or `value(sig.get)` to a bare `T` is a `TS2322` and needs a check, a default or a non-null assertion; under `strictNullChecks: false` the union collapses to `T` and nothing changes. `createSignal()` without a type argument stays `Signal<unknown>`, and `createSignal<T>(undefined, {attach: host})` — no value, but a holder — keeps working (API-013, audit 2026-08-12)
- `hibernate(callback)` rejects an `async`/thenable-returning `callback` at `tsc` time, the same narrowing `batch()` and `beQuiet()` carry: the saved batch, quiet counter and effect stack are restored by the `finally` at the first `await`, so everything past it runs outside hibernation. Like `beQuiet()` there is no runtime check. A generic pass-through wrapper stops compiling too — `<T>(fn: () => T) => hibernate(fn)` takes `() => NonThenable<T>` as its own parameter type now (ASYNC-004, 2026-08-12 audit — a different finding from the two `SignalLink.nextValue()` entries carrying that id from the 2026-08-06 audit)
- `run()`, `runImmediately()` and `destroy()` on the `EffectImpl` instance that `onCreateEffect()`, `onDestroyEffect()` and `onEffectError()` hand out as a `FailingEffect` are prototype methods now, not bound properties: `const {destroy} = effect; destroy()` throws a `TypeError` instead of running. Call them on the object instead — `effect.destroy()` is unaffected and is the fix. The `Effect` that `createEffect()` returns is untouched: its `run`/`runImmediately`/`destroy` stay bound, and so does the unsubscribe function `Signal#onChange()` returns (PERF-009, audit 2026-08-12)
- `Object.keys()` on that same `FailingEffect` instance now lists five own properties instead of nine — `run`, `runImmediately`, `destroy` and `childEffects` are gone from it; `childEffects` is a `#`-field now and neither readable nor writable from outside. Code that wrote to `.childEffects` from an `onCreateEffect()`/`onDestroyEffect()`/`onEffectError()` handler used to corrupt the effect's teardown; that assignment now lands on an inert own property instead (PERF-009, READ-006, audit 2026-08-12)
- `link()` is an overload pair now — one signature for a signal target, one for a callback target — so `link(sig, (v) => …)` infers the parameter from `source` instead of reporting `TS7006: Parameter 'v' implicitly has an 'any' type` under `noImplicitAny`, and instead of falling silently to `any` in a project without it. The workaround `docs/api.md` used to recommend, annotating the parameter, still compiles and is no longer needed. `link` carries two signatures now, and the cost is one rule: anything that reduces it back to one — an assignment to a narrower signature, generic inference, or a utility type — lands on the callback signature. Four examples of that rule, not a closed list: a *call* whose target's static type is a union mixing a callback with a signal — a variable, an object property, a ternary expression, or a type parameter constrained to the union, whatever the syntax that produced it — reaches neither overload and reports `TS2769` (a union of `SignalReader<T> | ValueCallback<T>` is exempt and still goes through, entirely assignable to `ValueCallback<T>`); narrow it first (`typeof target === 'function'` splits both branches cleanly), split the call, or assert at the call site. A generic pass-through whose parameter is written as a call signature (`<A extends unknown[], R>(fn: (...a: A) => R, ...a: A)`) reports `TS2345`, because generic inference over an overloaded type takes one signature and `ValueType` falls to `unknown`; a wrapper whose parameter is a bare type parameter keeps the whole overload set instead. Treating `link` itself as a *value* instead of calling it — assigning or passing the bare function to a variable, an object/class property, an array element, a `Map#set()` call, a default parameter, or a `satisfies` expression typed with a monomorphic signature that spells the union out by hand — reports `TS2322` (`TS2345` at an argument position; `TS2769` where the target position is itself overloaded, as the `Map` constructor is). And a utility type that reduces the overloaded type to one signature resolves it to the callback overload, not the union: `Parameters<typeof link>[1]` is `ValueCallback<unknown>` now, so a variable typed from it no longer accepts a signal (`ReturnType<typeof link>` is unaffected — both overloads return the same type). The repair for all four is the same, with the same caveat: annotate the target `typeof link` when you own the signature being annotated, otherwise wrap the call in an arrow that narrows inside before delegating, or cast at the call site (`link as …`) when neither is available. `unlink()` is unchanged (TYPE-007, audit 2026-08-12)
- Every error message this library authors now begins with `[signalize] ` — thrown, rejected out of `nextValue()`/`asyncValues()`, or reported through `onSignalizeError()`. Code that compares an error message to an exact string needs the prefix; a substring or unanchored regex match is unaffected, and no error type, code path or timing changed. The rule is held by `src/message-prefix.spec.ts`, which reads the source rather than a hand-kept list, so it covers messages added later too (CONS-002, audit 2026-08-12)
- `SignalGroup.destroy(obj)` and `SignalGroup#destroy()` report their deprecation once per process instead of on every call — the strategy `signalReader(callback)` already used. Code that counted the notices, or asserted one per call, sees one in total; the call itself is unchanged (CONS-004, audit 2026-08-12)
- `SignalAutoMap#clear()` with several failing cleanups now throws an `AggregateError` over all of them, in teardown order, where it used to throw the first one alone and leave every entry behind it alive but unreachable — already out of the map, so `has()` reported `false` and `get()` created a fresh one. A `catch` that reads `.message` or does an `instanceof` check sees the wrapper and needs to unwrap `err.errors`; a single failing cleanup is unchanged and still rethrows that error unchanged (MEM-013, audit 2026-08-12)
- `destroyObjectSignals(...objects)` with several failing cleanups now throws an `AggregateError` over all of them, in teardown order, where it used to throw the first one alone and skip every remaining signal of that object and every object behind it. A `catch` that reads `.message` or does an `instanceof` check sees the wrapper and needs to unwrap `err.errors`; a single failing cleanup is unchanged and still rethrows that error unchanged (BUG-015, audit 2026-08-12)
- `Signal#onChange(cb)` takes a `ValueChangedCallback<T>` — `(value: T) => void | (() => void)` — instead of `(val: T) => any`. A callback returning anything else no longer compiles: an expression body such as `sig.onChange((v) => arr.push(v))` or `(v) => v` fails with `TS2322` at the return expression, while a block body with a `return` and a pre-typed `(v: T) => unknown` fail with `TS2345` at the argument. A returned function is still the cleanup, and the runtime still ignores a non-function return — the block-body form, the cleanup form, a `(v: T) => any` variable and a zero-argument callback are unaffected (TYPE-006, audit 2026-08-12)
- `Signal#onChange(cb)` also refuses an `async` callback now (`TS2345` at the argument) — and that call form was not dead weight before: the effect subsystem already accepted a cleanup resolved late from such a callback's promise, same as a synchronous one. `ValueChangedCallback<T>` is synchronous by design, so the call form no longer compiles at all; switch to `createEffect()`, which still takes an `async` callback and still honors its resolved cleanup (TYPE-006, audit 2026-08-12)
- `unlink(source)` refuses a source that is not a signal with `TypeError: [signalize] unlink: source must be a signal`, the same refusal `link()` gives for that argument. It used to return without a word, which read as a completed teardown. `LinkableSource<T>` already rejects a non-signal at `tsc` time, so only untyped JavaScript callers reach it

### Features

- New `setMaxEffectDepth(n)` / `getMaxEffectDepth()` exports make the recursion cap reachable from outside for the first time — `EffectImpl` is exported from no entry point and the `exports` map bars deep imports, so the `EffectImpl.maxDepth = N` recommended by six documentation sites was unusable. `setMaxEffectDepth()` throws unless `n` is a finite integer `>= 1` (API-003)
- The five options and deps types of `createEffect()` — `EffectOptions`, `EffectOptionsWithSignalDeps`, `EffectOptionsWithNameDeps`, `EffectDeps`, `SignalLikeDeps` — are importable from `@spearwolf/signalize`. `docs/api.md` listed `EffectOptions` as exported while `import type` failed with `TS2305` (API-004)
- New `onEffectError(cb, priority?)` export: subscribes to rejections of `async` effect and cleanup callbacks, which cannot be thrown at a caller. The handler receives `{error, effect, effectId, phase}` (ASYNC-001, 2026-07 audit)
- `createMemo(fn, {batchWrites})`: new option (default `false`) to wrap the memo's recompute write in `batch()`. Only needed when `fn` itself writes to other signals as a side effect — the default trades that grouping away, see the Breaking Changes entry above (PERF-001, 2026-07 audit)
- `SignalAutoMap#delete(key)` destroys the signal for that key and removes the entry, returning `true` if the key was in the map — previously only `clear()` could tear anything down. A key whose signal was destroyed from the outside answers `false`: the entry has already left the map together with its signal by then, and `has(key)` is `false` too (MEM-009, 2026-07 audit)
- `link()` warns once per source signal, via `console.warn`, as soon as 1000 links hang off that one source — the point where the register is more likely unbounded than intended, and where a write to that source already costs two orders of magnitude more than it did empty. The warning names the four teardown routes (`destroy()`, `unlink()`, a cleared `{attach}` group, destroying source or target) and `getLinksCount(source)`; nothing is thrown and no link is refused (MEM-005, audit 2026-08-07)
- `Signal#destroyed` and `Effect#destroyed`: `boolean` getters that say whether the primitive is still alive. `SignalLink` keeps `isDestroyed` — the spelling is consistent per class, and does not change in the middle of one. Nothing is taken away (API-008)
- New `onSignalizeError(cb, priority?)` export: catches the diagnostics that have no caller to throw at — errors out of the `FinalizationRegistry` callbacks of `SignalGroup`, `link()` and `SignalAutoMap`, the deprecation notices, the 1000-links threshold, a second copy of the library in the same process, and an option that does nothing in the combination it was passed in. The handler receives `{level, source, message, error?}`, with `source` one of `'effect'`, `'group-finalizer'`, `'link-finalizer'`, `'automap-finalizer'`, `'link-count'`, `'deprecation'`, `'multiple-instances'` and `'ignored-option'` — a `switch` over it needs a `default`, because new members may appear in a minor release (CONS-001, ARCH-001, API-009 — all audit 2026-08-08)
- Without a registered handler every one of those messages stays verbatim on `console.warn`/`console.error`; **with** a handler the handler owns them, deprecation notices included (CONS-001)
- An effect failure that no `onEffectError()` handler takes now goes to `onSignalizeError()` before it reaches the console (CONS-001)
- Loading more than one copy of `@spearwolf/signalize` into one process is reported once, when the second copy loads, through `onSignalizeError()` with `source: 'multiple-instances'` and the load paths of every copy; without a handler the message goes to `console.error`. Two copies share no signals, effects, groups or links — `isSignal()` says `true` across the boundary and nothing else works (ARCH-001)
- When both copies of the library are loaded via static `import`, the multiple-instances message is registered during module evaluation, before any handler can exist, so it always reaches `console.error`; only a copy loaded later via `await import()` can meet an `onSignalizeError()` handler (ARCH-001)
- A copy that cannot write to the multiple-instances register — a squatter on the symbol, a frozen register, a frozen `globalThis` under SES `lockdown()` — stays silent instead of failing the `import` (ARCH-001)

### Bug Fixes

#### Effects und Memos

- A rejecting `async` effect callback no longer becomes an unhandled rejection — which, since Node 15, terminates the process by default. It goes to `onEffectError()`, or to `console.error` with the effect id while no handler is registered (ASYNC-001, 2026-07 audit)
- A rejecting `async` cleanup callback is reported through the same channel with `phase: 'cleanup'` instead of being swallowed
- An effect callback that returns something other than a function no longer throws `TypeError: cleanupCallback is not a function` on the next run — the value counts as "no cleanup". Mostly hits `Signal.onChange(cb)`, whose callback is free to return `any`
- An effect created inside a **static-deps** effect callback is now registered as a child effect. It used to be orphaned: every rerun of the parent left another live effect subscribed to the global signal queue, without limit. Also hits `Signal.onChange()` and `createMemo()` calls in such a callback (MEM-001, audit 2026-08-06)
- An effect created inside a static-deps effect callback still has auto-tracking disabled by its own static deps — signals read inside its callback do not subscribe. Only the effect context came back with it, not the tracking
- `Effect.destroy()` unsubscribes the effect before running its cleanup callback, so a cleanup that writes to a signal the effect depends on no longer triggers one last run whose own cleanup would never be called (MEM-007, audit 2026-08-06)
- `Effect.destroy()` marks the effect as destroyed before it emits its destroy events, so an `onDestroyEffect()` handler no longer receives an effect whose `run()` still executes the callback (BUG-008, audit 2026-08-06)
- A re-entrant `Effect.destroy()` (from a cleanup callback or a destroy handler) is now a no-op instead of decrementing `getEffectsCount()` a second time
- A cleanup callback that throws no longer leaves the effect half-destroyed — child effects, subscriptions and `getEffectsCount()` are settled either way, and the error still reaches the caller
- A child effect whose cleanup throws no longer aborts the destruction of its siblings. They used to survive their parent as zombies — still subscribed, still reacting to signal writes
- `Effect.destroy()` reports every failing cleanup instead of only the last one. Several errors (own cleanup plus a child's, or several children's) arrive as an `AggregateError` in teardown order; a single error is rethrown unchanged
- `createMemo()` called inside an effect body, without `{attach}`, no longer leaks its internal signal on every rerun. The memo's internal effect was already destroyed as a child effect (MEM-001, audit 2026-08-06), but the memo signal itself lived on unreachable and uncounted; it is now destroyed together with that effect (MEM-005, audit 2026-08-06)
- An effect no longer destroys itself mid-run when its dependencies vanish while it is rebuilding them — the verdict "nothing can trigger me anymore" is postponed to the end of the outermost run and re-checked there
- An effect whose only dependencies are memos it creates in its own body therefore keeps rerunning; it used to stop firing after the first change and leave a zombie effect behind
- An effect whose dependencies really are all gone still dies — one run later than before, now that the verdict is postponed to the end of the outermost run
- An error thrown by a cleanup during that deferred teardown goes to `onEffectError()` with `phase: 'cleanup'` instead of surfacing at whoever wrote the signal
- `createEffect(callback, dependencies, options)` no longer mutates the caller's `options` object by writing `dependencies` into it. Reusing one options object across several `createEffect()` calls used to make every call after the first inherit the previous one's dependencies (BUG-005, audit 2026-08-06)
- A string/symbol dependency that cannot be resolved to a signal — the name is not registered in the attached group, or no group is attached at all — now throws an error naming the dependency instead of an opaque `TypeError: Cannot read properties of undefined` (BUG-003, audit 2026-08-06)
- `createMemo(fn, {attach, name})` called in an effect body no longer leaves one dead memo signal per rerun in the group. The memo's internal effect dies as a child effect, but its signal was reachable only through the name the next rerun rebinds — it is now destroyed at that point (MEM-003, follow-up to MEM-005, audit 2026-08-06)
- An effect that destroys itself in the middle of its own callback (or is destroyed by an `onCreateEffect()` handler before it ever ran) no longer subscribes to any more signal reads afterward. Those late subscriptions used to be unremovable — `destroy()` had already discarded its unsubscribe handles — pinning the effect and its callback closure on the global queues forever
- An effect that becomes untriggerable is destroyed regardless of the order in which its dependencies stop tracking it — including when one was hard-destroyed (`signal.destroy()`) before a later `SignalGroup.off()` soft-detaches the rest. Such an effect used to survive as a zombie, permanently subscribed to the global effect queue with no way left to wake it
- An effect that destroys itself in the middle of its own callback no longer loses the cleanup that same callback returns. `run()` still finishes the callback after `destroy()` has already run its own cleanup, but that cleanup is now executed right away instead of being stored where nothing will ever call it
- A memo's internal effect now unsubscribes from the global destroy queue when it dies before its signal does — e.g. its last live dependency was destroyed. That subscription used to stay behind indefinitely, holding the dead effect and its callback closure alive for as long as the memo signal itself lived, which for a memo whose inputs are gone is the remaining process lifetime
- `createMemo(fn, {attach})` **without** `name`, called inside an effect body, no longer leaves a new signal in the group on every parent rerun — the signal now dies with the effect that created it, the same way the named case already did through its rebind
- `createMemo(fn, {attach, name})` called inside an effect body no longer outlives the effect that created it: destroying the parent, or a `group.off()` on the attached group, used to leave such a signal live and still resolvable by name — both now destroy it along with the effect, the same as the unnamed case
- An effect callback that throws *after* reading still unsubscribes the signals it stopped reading — the pruning now sits in a `finally`. A deterministically failing effect used to keep a live RECALL subscription on a signal it no longer read, running into the same error on every write to it (BUG-006, audit 2026-08-07)
- A callback that throws *before* its first read keeps every dependency instead of committing the empty set it never got to build, so a single transient failure no longer leaves the effect permanently deaf (BUG-006, audit 2026-08-07)
- An effect that writes a signal it depends on now runs the cleanup of **every** nested run instead of storing only the oldest. A superseded or displaced cleanup runs right away, the same way a superseded `async` run's cleanup does (BUG-007, audit 2026-08-07)
- A superseded cleanup that throws synchronously now reports to `onEffectError()` with `phase: 'cleanup'` instead of surfacing at whoever wrote the signal — for the `destroy()` path that throw used to escape the teardown entirely (BUG-007, audit 2026-08-07)
- A cleanup that writes a signal can now trigger further effect runs, because it actually runs at the point it is superseded rather than being dropped (BUG-007, audit 2026-08-07)
- An effect callback that throws no longer ends the delivery of a signal write: every subscribed effect runs, in priority order, and the failures reach whoever wrote afterwards — a single one unchanged, several as an `AggregateError` in delivery order. Lower-priority effects used to be skipped and never learned that the value had changed (BUG-004, audit 2026-08-07)
- A synchronous effect-callback failure still does **not** go through `onEffectError()` — that channel stays reserved for failures with no caller left to throw at (BUG-004, audit 2026-08-07)
- **Changed shape of what a write throws** when a signal has both a failing effect and a throwing `link()` callback: the write now raises an `AggregateError` over both, where it used to raise the effect's error alone — the link callback never ran, because the effect's throw had already ended the delivery. A link callback is still not isolated and still ends the delivery; it just no longer takes the failures collected before it with it (BUG-004, audit 2026-08-07)
- An effect with static `dependencies` that survives a `SignalGroup.off()` hears its detached group signal again from its next run onwards. It re-declares its dependency set at the start of every run instead of only at construction time; it used to stay deaf to that signal for the rest of its life, because its callback runs without auto-tracking and nothing re-subscribed afterwards (BUG-003, audit 2026-08-07)
- `off()` remains a pause: until that next run the effect misses every write to the detached signal, and an effect whose only dependency was a group signal is still destroyed by `off()` (BUG-003, audit 2026-08-07)
- A destroyed dependency is skipped whenever the declared set is subscribed — at construction time as well as on every run. `createEffect(cb, [alreadyDestroyed, live])` used to subscribe to both, and the effect then survived the destruction of `live` as a deaf shell holding two unremovable subscriptions; a signal destroyed after a `SignalGroup.off()` detach is not subscribed again either (BUG-003, audit 2026-08-07)
- An effect whose cleanup throws no longer ends the `destroySignal()` delivery, the way a write was already isolated. Every subscriber registered behind that effect used to be skipped, leaving a `SignalLink` attached to the dead source, a `SignalGroup` holding the dead signal and a `SignalAutoMap` entry standing. Only effects are isolated: anything else on that queue that throws still ends the delivery, exactly as for a write (BUG-011, audit 2026-08-08)
- `Effect.destroy()` guards each of its four teardown steps on its own, so a throwing `DESTROY` listener or `onDestroyEffect()` handler no longer costs the effect its `off(this)`, its destroy notification and — the expensive one — its cleanup callback, on an instance that already counts as destroyed and gets no second attempt (MEM-008, audit 2026-08-08)
- `createEffect()` no longer leaks the effect when its first run throws. The constructor had already counted it and subscribed it to the global effect queue, plus one `RECALL` and one destroy watch per signal the callback managed to read, while `new Effect(effect)` was never reached — leaving an effect nobody could destroy, still reacting to writes. The creation is taken back instead; an effect with `{attach}` is exempt, because the group holds it (audit follow-up, package 7b)
- A throwing `onCreateEffect()` handler gets the same rollback: it sits two lines ahead of the first run and left exactly the same behind (audit follow-up, package 7b)
- `createMemo()` no longer leaks its memo signal — and, through the entry above, its internal effect — when the first compute throws. The signal is created before the effect and has no holder until the `return` that never happens, so without `{attach}` it was unreachable and permanently counted. With `{attach}` both stay in the group, which is what `clear()` is for (audit follow-up, package 7b)
- `createMemo(fn, {name})` without `{attach}` reports the ignored name through `onSignalizeError()` with `source: 'ignored-option'`, on every such call, instead of dropping it in silence. A name is a slot inside a `SignalGroup`; without one there is nowhere to file it (API-009, audit 2026-08-08)
- `createMemo(fn, {name: ''})` no longer reports the empty name as an ignored option when `{attach}` is missing. An empty name is no name in either branch now — with `attach` the memo has always joined the group unnamed, without it the call was the only one of the two to complain (CONS-015)
- `createSignal(existingSignal, params)` reports the options it drops through `onSignalizeError()` with `source: 'ignored-option'`, on every such call, instead of dropping them in silence. Passing a signal returns that same signal, so nothing in `params` has anything to configure — `attach` is the exception and applies on both branches. What changes for callers who were on the silent path: a new `console.warn` where no handler is installed, an extra payload where one is. Which options get named will move with the options; what does not move is the rule — nothing that configures a *new* signal has anything to configure when none is created. `createSignal(sig.get, {lazy: true})` is the same call through the reader (a `SignalReader<T>` is the `() => T` the factory overload asks for, and `isSignal()` still routes it to the passthrough) and reports the same way (API-012, audit 2026-08-12)
- An effect releases both of a signal's subscriptions whenever it lets that signal go — a rerun that stops reading it, a `SignalGroup.off()` detach, or the destruction of the signal itself — even if freeing the first handle throws. The second used to stay subscribed forever whenever that happened
- An effect that loses its last dependency still destroys itself when freeing an earlier dependency's subscription threw. That signal used to stay listed as a live dependency, so the effect reported dependencies it no longer had and never destroyed itself again
- An effect that stops depending on several signals in the same rerun keeps releasing the rest even after one of them fails the same way. It used to abandon every signal behind the failing one, each left fully subscribed

#### Links

- `link()` with an invalid `source` (not a signal) now throws `[signalize] link: source must be a signal` immediately, before touching the internal registry. It used to insert an entry keyed by `undefined` first and only then fail inside the `SignalLink` constructor with an opaque `TypeError`, leaving that stale empty entry behind (BUG-007, audit 2026-08-06)
- `link(source, target, {attach})` called again for a `(source, target)` pair that already has a link now attaches the existing link to the new group too, instead of silently dropping `attach`. The link is destroyed as soon as any one of its attached groups clears (BUG-004, audit 2026-08-06)
- `SignalLink.attach()` (and therefore `link()`'s `{attach}` option) is idempotent: attaching the same group again — including on repeated `link()` calls for an already-cached pair — no longer registers a second internal destroy listener on the link. It used to grow the link's own listener count without bound when the same `{attach}` group was passed on every render or effect rerun
- `link()`'s internal registry (`gLinks`) now keys on the source signal via `WeakMap` instead of `Map`, so it no longer pins signals that are otherwise fully unreferenced (MEM-002, audit 2026-08-06)
- `getLinksCount()` without a `source` argument now tracks an internal counter instead of iterating the registry — a `WeakMap` cannot be iterated (MEM-002, audit 2026-08-06)
- `SignalLink`'s two subscriptions on `globalSignalQueue`/`globalDestroySignalQueue`, and `SignalLinkToSignal`'s extra subscription for its target signal, now go through a `WeakRef` to `this` instead of capturing it directly. Those queues are permanent module-level roots, so a strong closure there pinned every link — signal-target and callback-target alike — in memory for the process lifetime, regardless of `gLinks` (MEM-002, audit 2026-08-06)
- An orphaned link — never `destroy()`d, never `.attach()`d, no other references left — is now reclaimed by garbage collection once its source signal is unreachable too, for both signal and callback targets; a link whose source is still reachable is not reclaimed this way (MEM-002, audit 2026-08-06)
- `SignalLink.destroy()` now releases its `once(globalDestroySignalQueue, ...)` subscription(s) — one for a callback-target link, two for a signal-target link (source and target). They used to survive `destroy()` and dangle on that permanent module-level queue until the other side's signal was destroyed too, which for a link torn down ahead of its signals never happened (MEM-004, audit 2026-08-06)
- `SignalLink.nextValue()` and `asyncValues()` take an optional `{signal}` (`AbortSignal`): an already-aborted signal rejects immediately, one that aborts while a value is pending rejects at that point, and the internal abort listener is removed again once the call settles either way (ASYNC-004, 2026-08-06 audit)
- `SignalLink.nextValue({signal})` no longer leaks its `DESTROY` listener and, worse, its caller-owned `AbortSignal`'s abort listener when it resolves through a *retained* `VALUE` replay, which eventize delivers synchronously inside the subscribe call. This is the common case while an `asyncValues()` iterator retains `VALUE` on the same link (ASYNC-005, audit 2026-08-06): every `nextValue({signal})` call after the first leaked one more abort listener, unbounded
- `SignalLink.asyncValues()` no longer lets one iterator's cleanup cut off a sibling: several `asyncValues()` iterators can run over the same link at once, sharing one retained slot, and that slot is now only cleared once the *last* active iterator stops instead of the first (ASYNC-005, audit 2026-08-06)
- `SignalLink.asyncValues({signal})` now throws the abort reason out of the loop when the signal aborts, instead of ending the iteration silently as if `stopAction` had returned `true`. The link being destroyed still ends the loop quietly — only an externally requested abort is now distinguishable from a normal stop
- `SignalLink.asyncValues({signal})` no longer misreads a `destroy()` as an abort when both happen in the same synchronous block (a teardown that destroys whatever owns the link and then cancels its own controller, in that order) — it now matches the rejection itself against `signal.reason` instead of only checking whether the signal is currently aborted, so the loop still ends quietly for that destroy instead of rethrowing it as if it were the abort
- `SignalLink.asyncValues()` no longer hands the same value to the same iterator over and over. Each iterator now tracks the propagation it last consumed and waits for the next one instead of being served the retained value again (ASYNC-005, audit 2026-08-07)
- A `for await` over `asyncValues()` without a `stopAction` terminates. It used to spin as a microtask hot loop that starved every timer in the process — measured: 500 000 iterations of one value, not a single macrotask getting through (ASYNC-005, audit 2026-08-07)
- A value that arrives while an `asyncValues()` consumer is busy between two reads is still delivered, and several iterators still share one retained slot (ASYNC-005, audit 2026-08-07)
- `SignalLink.nextValue()` called on its own is unchanged — it still settles on whatever sits in the retained slot (ASYNC-005, audit 2026-08-07)
- `asyncValues()` iterators can be closed while they are waiting for a value. `.return()` and `.throw()` used to be queued behind the pending read and never settled if no value came, leaving the iterator's subscriptions on the link and its retain policy claimed until `destroy()` — the caller-closes-what-it-opens contract the method documents was not callable in that state (W1)
- `SignalLink.nextValue()` called on a link that is already destroyed now rejects immediately with `Error('[signalize] SignalLink destroyed before the next value arrived')` instead of never settling. It used to hang forever — `DESTROY` is never emitted again after `destroy()` — leaving its `VALUE`/`DESTROY` subscriptions (and, with `{signal}`, the abort listener) on the dead link for as long as the promise was referenced
- `SignalLink.destroy()` no longer leaves a link half torn down if one of its internal destroy-queue unsubscribe handles throws: the remaining handles, the `DESTROY` emit, `off(this)` and the `isDestroyed`/freeze steps all still run, and the collected error(s) are rethrown afterward — a single error unchanged, several as an `AggregateError`, the same shape `EffectImpl.destroy()` already uses
- A link callback that destroys its own link mid-propagation no longer throws `TypeError: Cannot assign to read only property 'lastValue'` out of the `signal.set()` that started the delivery, and the remaining links on that source are served to the end. `updateValue()` re-checks `isDestroyed` after handing control to application code (BUG-001)
- `SignalLink.destroy()` sets `isDestroyed` before it emits `DESTROY`, so an `on()` listener that calls `destroy()` again hits the guard instead of recursing into an unprotected teardown until the stack overflows (BUG-002, audit 2026-08-07)
- A propagation overtaken by a feedback write no longer appends its stale value afterwards: `'value'` and `lastValue` carry the value that survived, so a `nextValue()`/`asyncValues()` consumer never sees a regression to an older value (BUG-008, audit 2026-08-07)
- A link that becomes unreachable together with its source signal now releases its subscriptions on `globalSignalQueue`/`globalDestroySignalQueue` as well — two for a callback target, three for a signal target — instead of only correcting `getLinksCount()`. Measured before the fix: 10 000 dropped pairs left 10 000 entries on each queue and ~2.2 KB of heap per pair behind while `getLinksCount()` reported 0 (MEM-001, audit 2026-08-07)
- A release handle that throws while a collected link is being cleaned up is reported through `console.error` instead of taking the process down out of the `FinalizationRegistry` callback, and the remaining handles are released regardless (MEM-001, audit 2026-08-07)
- The error of a failed `SignalLink` teardown now reads `[signalize] N errors while tearing down a SignalLink` (previously "… while releasing SignalLink destroy-queue subscriptions") — the collection covers `DESTROY` listeners and the `globalSignalQueue` release too, not just the destroy-queue handles (MEM-001, audit 2026-08-07)
- The last `asyncValues()` iterator switches retaining of `'value'` off instead of only clearing the stored value. Until now the first `asyncValues()` call put a link into retain mode permanently: every further propagated value landed in the slot with nobody listening, and a later `nextValue()` resolved synchronously with that stale value instead of waiting for the next one (MEM-004, audit 2026-08-07)
- A `retain(link, 'value')` set by the caller no longer survives an `asyncValues()` run on that link, following from the fix above: `asyncValues()` has always claimed that event's retain policy for itself; it now gives it up at the end instead of leaving it standing (MEM-004, audit 2026-08-07)
- `link()`'s registry hook now runs on `Priority.Max` as well. A throwing higher-priority `DESTROY` listener used to leave `getLinksCount()` too high for the life of the process and the registry entry standing; a `DESTROY` listener above normal priority now sees the counter already brought down (MEM-010, audit 2026-08-08)
- `unlink(source)` tears down every link even when an earlier one's `DESTROY` listener throws. It used to stop the loop there, leaving every not-yet-visited link fully subscribed and the registry unemptied (MEM-011, audit 2026-08-08)
- `unlink(source)` names an argument it does not recognise instead of answering a typo with a silent, successful-looking teardown

#### SignalGroup

- `SignalGroup.attachGroup()` rejects an edge that would close a cycle in the group graph (`a.attachGroup(b); b.attachGroup(a)`), the way it already rejected `group.attachGroup(group)`. Such a cycle used to send `hasSignal()`, `signal()`, `runEffects()`, `off()` and `clear()` into unbounded recursion (BUG-002, audit 2026-08-06)
- `hasSignal()`, `signal()`, `runEffects()`, `off()` and `clear()` additionally refuse to re-enter a walk they are already inside, so neither a cycle that arose some other way nor user code re-entering from a listener can exhaust the stack. This matters most for `clear()`, which runs from the `FinalizationRegistry` callback where a `RangeError` is unreachable by any `try`/`catch` — caught and reported there now, though the recursion would still burn the stack first (BUG-002, audit 2026-08-06)
- `SignalGroup.attachSignalByName(name, signal)` no longer accumulates every signal a name ever held. Binding a name is the group's only hold on a signal unless `attachSignal()` was called for it too, so rebinding the name destroys the signal it displaces — signals held by another name and explicitly attached ones are exempt (MEM-003, audit 2026-08-06)
- `SignalGroup.attachSignalByName(name, undefined)` releases the name the same way instead of only deleting the lookup entry. The name used to read as gone while every signal ever bound to it stayed attached and was destroyed by the next `clear()` (MEM-003, audit 2026-08-06)
- The instance methods `group.clear()` and `group.off()` run the teardown to the end when a cleanup callback or a `DESTROY`/`OFF` listener throws; failures are collected and rethrown afterwards — one unchanged, several as an `AggregateError` in teardown order, the same shape `Effect.destroy()` already uses. `off()` additionally emits its `OFF` event either way
- A destroyed effect or signal takes itself out of the `SignalGroup` that holds it, instead of sitting in the group's internal sets until the next `clear()`. A long-lived group (a component host, a `@signal`-decorated object) with effect or signal churn used to accumulate every dead `EffectImpl` — callback closure included — and every destroyed signal, while `getEffectsCount()`/`getSignalsCount()` correctly reported them gone
- Destroying a signal that was attached by name also releases the name: `hasSignal(name)` turns `false`, and a remaining candidate under that name takes the slot over by the same rule `detachSignal()` uses. This is the path the `@signal` decorator takes, where `attachSignalByName()` is the only way into the group
- The static `SignalGroup.clear()` now sweeps every registered group even when one of them throws during teardown, instead of aborting at the first failure and leaving the remaining groups fully built up and registered — the caller used to have to call it in a loop to be sure the registry was empty. Errors are collected and rethrown afterward — a single one unchanged, several as an `AggregateError`
- A `SignalGroup` teardown that throws from the `FinalizationRegistry` callback no longer takes the process down: the error is now reported via `console.error` instead, since a registry callback has no caller left to hand it to
- The static `SignalGroup.clear()` no longer throws a group created *during* the sweep — e.g. from a `DESTROY` listener — out of the registry. It stayed in `store` and was still handed out by `findOrCreate()`, but no longer counted by `getSignalGroupsCount()`, was unreachable by any further sweep, and its `FinalizationRegistry` backstop could never fire again (BUG-009)
- A link attached through `SignalGroup#attachLink()` takes itself out of the group when it is destroyed. Only a link attached via `link(…, {attach})` or `link.attach(obj)` used to do that; a directly attached one stayed in the group's internal set for the lifetime of the group, keeping its source `SignalImpl` and its callback closure reachable (MEM-002, audit 2026-08-07)
- A link's removal from its group is delivered with `Priority.Max`, so it also runs when a `'destroy'` listener of the same link throws. The guarantee covers every listener below `Priority.Max`; `Priority.Max` is `+Infinity` and not an exclusive slot, so a listener registered at that same priority *before* the attach still runs first and can still swallow the counter-edge (MEM-002, audit 2026-08-07)
- The three module-level roots of `SignalGroup` hold a group weakly: the set of live groups stores `WeakRef`s, the `FinalizationRegistry`'s held value is a `WeakRef` instead of the group, and the per-signal destroy-queue listener knows both group and signal through `WeakRef`s. A host whose only back-reference is a signal value — the `@signal() accessor self = this` shape — is now collected together with its group (measured: 1000 of 1000 hosts survived a `gc()` before, 0 of 1000 after) (MEM-003, audit 2026-08-07)
- A `SignalGroup` collected together with its host releases its subscriptions on `globalDestroySignalQueue` through a second `FinalizationRegistry` (measured: 2000 listeners → 0). Without it the leak would only have moved from the group to the queue (MEM-003, audit 2026-08-07)
- An attached effect whose callback closure captures the host still prevents collection — an unchanged limit, now stated with its measured cause: every live effect is reachable from the global effect queue for as long as it exists, with or without a group (measured: 500 hosts → 500, and 200 group-less effects pin 200 of 200 hosts) (MEM-003, audit 2026-08-07)
- A `SignalGroup` collected together with its host has not run `clear()`: it emits no `DESTROY` event, and its signals are collected rather than destroyed (MEM-003, audit 2026-08-07)
- A `SignalGroup` lets a destroyed effect go even when a higher-priority `DESTROY` listener throws first — the bookkeeping hook now runs on `Priority.Max`, like `attachLink()`'s. It used to keep the dead `EffectImpl` and its callback closure in the group until the next `clear()` (MEM-009, audit 2026-08-08)
- `SignalGroup.delete(group)` clears the group it is handed instead of doing nothing. A group made by `findOrCreate(host)` is filed in the store under `host`, so the lookup this method did found nothing — the documented public destructor was a silent no-op for exactly the argument `get()` and `findOrCreate()` accept. The deprecated `SignalGroup.destroy(group)`, which routes through it, is fixed with it (API-014, audit 2026-08-08)
- `group.clear()` finishes the whole teardown even when releasing a signal's destroy-queue subscription throws — the last of `clear()`'s five teardown loops now collects the failure and keeps going, the same shape the four loops above it already had. `#dropSignalSubscription()`, the internal helper that `detachSignal()` and a rebound name route through, now takes its own bookkeeping out of both registers in a `finally` regardless of whether the unsubscribe throws (CONS-005, audit 2026-08-12)
- `group.detachSignal(sig)` takes the signal out of the group completely even when releasing its destroy-queue subscription throws; the signal used to stay in the group's own registers — the signal set, the direct-ownership set and every name it was bound to — while its subscription was already gone

#### Batching und Frames

- `batch(callback)` now throws `[signalize] batch: …` (`TypeError`) if `callback` returns a thenable, instead of silently unbatching every write made after the first `await`. `callback`'s signature is also narrowed to reject `async` functions (and anything else typed to return `Promise`/`PromiseLike`) at `tsc` time; the runtime check additionally catches a synchronous callback that merely returns a duck-typed thenable (ASYNC-003, 2026-07 audit)
- An effect run inside `beQuiet()` keeps its dependencies instead of unsubscribing them. This hit the `{autorun: false}` pattern, where the owner wraps its own `run()` in a quiet frame: the effect went permanently deaf afterwards — no write reached it, `run()` was a no-op — and kept counting in `getEffectsCount()` (BUG-005, audit 2026-08-07)
- A `batch()` flush behaves the same way: a throwing effect no longer holds up the remaining delayed effects, and its failure arrives at the `batch()` caller once the flush is complete (BUG-004, audit 2026-08-07)
- `beQuiet(action)` now returns what `action` returns (previously `void`) — the documented untracked peek was always `undefined`, without a type error; the change is runtime-only and unchanged for every caller that ignores the value (BUG-010)
- `beQuiet()`'s signature also — like `batch()`'s — rejects an `async`/thenable-returning `action` at compile time: the quiet frame ends at the first `await`, and every read and write after that point is tracked and loud again. No runtime check, unlike `batch()` (BUG-010)
- `hibernate()` restores the batch, the quiet counter and the effect stack even when the flush of the saved batch throws — the flush now runs inside the same `try` as the callback. A failing effect in it used to leave the process with all three cleared in the middle of frames that were still open, and the quiet counter one below where it started, silently and for the rest of its life (ASYNC-001, audit 2026-08-08)
- `batch()` no longer loses the error its callback threw when a delayed effect fails in the flush afterwards. Both arrive as an `AggregateError`, callback error first. The same holds for the `TypeError` of the thenable guard, which used to vanish entirely whenever any effect in the same batch failed — it now reaches the caller either as itself, or, when the flush failed too, as `errors[0]` of that `AggregateError` (BUG-012, audit 2026-08-08)
- `effect.run()` inside an open `batch()` is no longer dropped for an `{autorun: false}` effect. The run was queued and then discarded at the flush — silently, with no return value and no error — because `[RECALL]` only runs an effect it redispatches when `autorun` is set. The batch now carries the request through: an explicitly requested run happens when the batch closes, a plain signal write still leaves a non-autorun effect alone (ASYNC-002, audit 2026-08-08)
- Reading a memo inside a `batch()` returns its current value instead of the one from before, for a memo the batch itself marked dirty. The memo's recompute used to be deferred like any other run, so a memo whose dependency was written in the same batch read stale — and one *created* in the batch read `undefined`, having no previous value at all (ASYNC-003, audit 2026-08-08)
- A batch flushed by `hibernate()` empties its queue even when an effect in it throws. It used to keep the whole queue, and the restored batch then recalled every delayed effect a second time when it closed — one write, two runs of the same callback, and the same failure reported at two different callers (audit follow-up, package 12, audit 2026-08-08)

#### Signale, Zähler und SignalAutoMap

- `getSignalsCount()` corrects itself through a `FinalizationRegistry` when a signal is dropped instead of destroyed, so it counts reachable signals rather than created ones (measured: 2000 dropped signals took the count from 2000 to 0, where it used to stay at 2000 for the lifetime of the process). The correction is eventually consistent — it lands at a moment that cannot be observed or forced (MEM-006, audit 2026-08-07)
- `SignalAutoMap` evicts an entry whose signal is destroyed from the outside instead of keeping the corpse cached: `has(key)` is `false` in the same synchronous turn and `get(key)` creates a fresh, live signal (measured: 1000 dead keys → 0). A soft detach via `SignalGroup#off()` is not a destruction and leaves the entry alone (MEM-007, audit 2026-08-07)
- A `SignalAutoMap` that is dropped without `clear()` releases its per-entry destroy-queue subscriptions itself, through a `FinalizationRegistry`, and stays collectible (measured: 400 subscriptions → 0). Its signals are collected with it, not destroyed (MEM-007, audit 2026-08-07)
- `touch()` and `value()` reject a source that is neither a signal nor an `[object, propertyName]` tuple with `[signalize] touch: …` / `[signalize] value: …` (`TypeError`), the shape `link()` already used. The unchecked case used to run into a spread and produce `Spread syntax requires ...iterable[Symbol.iterator] to be a function`, which names neither the function nor its argument (CONS-007, audit 2026-08-08)
- `SignalAutoMap.fromProps(obj, propKeys)` no longer orphans a signal when `propKeys` names the same key twice — the duplicate used to create a second signal under that key, silently displacing the first without releasing its destroy-queue subscription or destroying it. `propKeys` is deduplicated before it drives the create loop (MEM-012, audit 2026-08-12)
- `SignalAutoMap#clear()` finishes the whole teardown even when an effect cleanup throws: every entry is dropped and every signal destroyed, the failures are collected and raised at the end. A signal behind the failing one used to stay alive while its entry was already gone from the map — unreachable, and a second `clear()` found nothing left to do. `#drop()` now takes the entry out of all three registers in a `finally` regardless of whether the unsubscribe throws, the same shape `SignalGroup#dropSignalSubscription()` has had since CONS-005 (MEM-013, CONS-016, audit 2026-08-12)
- `destroyObjectSignals(...objects)` visits every object even when an effect cleanup throws, instead of ending at the first failure with the remaining signals of that object, every object behind it and their stores untouched (BUG-015, audit 2026-08-12)
- `Signal#onChange(cb)` hands its callback the tracked read, so a `beforeRead` hook fires for it and a `{lazy: true}` memo recomputes before the callback sees the value; it used to read past the hook and hand over whatever the last read through the reader had stored, `undefined` where there had been none. On such a memo the recompute writes from inside the callback, so the callback can run twice per notification — both times with the fresh value

### Performance

- An effect rerun no longer allocates an error list when the effect has no child effects (PERF-001, audit 2026-08-08)
- A `batch()` whose writes reached no effect skips the flush entirely — measured 629 ns → 50 ns for an empty `batch()` (PERF-002, audit 2026-08-08)
- An effect run outside a batch flush no longer emits on `globalEffectCalledQueue`, the queue only a running flush listens on (PERF-003, audit 2026-08-08)
- A signal write with ten dependent effects runs about a third faster — `bench/signal-write.bench.ts`, 373,783 → 510,935 ops/s (PERF-001, PERF-003, audit 2026-08-08)
- `{batchWrites: true}` no longer costs a memo without a dependent effect anything worth measuring — `bench/memo.bench.ts`, 756,036 → 2,244,935 ops/s, within 5 % of the default (PERF-002, audit 2026-08-08)
- An empty `SignalGroup` retains 1081 instead of 2513 bytes: nine of its eleven member containers are only allocated on first write (PERF-004, audit 2026-08-08)
- An `EffectImpl` retains 232 fewer bytes: `run`, `runImmediately` and `destroy` are prototype methods now, not one bound-function closure per instance — no measurable change in run/destroy speed (PERF-009, audit 2026-08-12)
- A reported effect failure no longer scans every subscribed event name of the global effect queue to find out whether an `onEffectError()` handler exists — a module-local counter replaces the scan, measured 15,96 µs → 0,013 µs at 8000 live effects, and about 78 % less time end-to-end for a write-then-report cycle at the same count (PERF-005, audit 2026-08-12)
- The same scan against the same queue, run a second time on the fallback path when no `onEffectError()` handler is registered, is gone too — not itself an audit finding, folded into PERF-005 while the queue and its cost were already in view (PERF-005, audit 2026-08-12)
- A signal write no longer builds a fresh default-equality closure on every call — one shared comparer is reused when no `compare` option is given, about 48 fewer bytes of garbage per write and half the minor-GC rate on a write with no consumers; no measurable change in write throughput (PERF-006, audit 2026-08-12)

### Documentation

- New `docs/conventions.md` — the canonical rules for writing code here (language, naming, imports and layering, TypeScript, the public surface, comments, error messages, tests, tooling, documentation and CHANGELOG discipline). Written for contributors and coding agents alike; `README.md`, `CONTRIBUTING.md`, `AGENTS.md` and `CLAUDE.md` point at it
- New rules for inline documentation, recorded in `docs/conventions.md` and applied across the tree: comments name the hazard directly instead of referencing an issue, audit finding or bug number; no code archaeology; a constraint becomes a test rather than a prose specification; an architecture decision is recorded in `docs/architecture.md` rather than argued at the call site. Every such reference has been removed from `src/`, `bench/`, `smoke/`, `scripts/`, `rollup/`, `docs/`, `skills/`, `AGENTS.md` and `CLAUDE.md` — `CHANGELOG.md` keeps its own, being history
- `docs/architecture.md` gained an "Architecture decisions" register: fifteen decisions in context → decision → consequence form, covering synchronous propagation, the eventize queues, symbol namespacing, multi-copy detection, the effect-hook placeholder, top-level side effects, the named export surface, weak lifetimes, eventually consistent counters, collecting teardown, the diagnostics channel, notice frequency, isolated delivery, the absent browser run and the reproducible banner
- `CONTRIBUTING.md` reworked as the process document — the command table now matches `package.json` (`typecheck`, `bundle`, `dist` and `bench` were missing, and `pnpm world` was listed without `typecheck`), the source tree listing matches `src/`, and the coding rules moved to `docs/conventions.md`
- Documented the condition under which automatic `SignalGroup` cleanup via `FinalizationRegistry` cannot fire: an attached effect whose callback closure captures the user object blocks reclamation, and it does so because every live effect is reachable from the global effect queue — with or without a group. An attached signal whose *value* holds the object, the `@signal() accessor self = this` shape included, does not block it. The fourth limit is documented alongside it in `docs/api.md`, `docs/architecture.md` and the pitfalls reference: a silently collected group never runs `clear()`. For a host that has to go down at a known moment, `SignalGroup.delete()` or `group.clear()` in a destructor remains the reliable path (MEM-006, audit 2026-08-06; corrected by MEM-003, audit 2026-08-07)
- Documented the actual lifetime of a `SignalLink`: while its source is reachable, it is held by an internal registry keyed on that source until `destroy()`, `unlink()`, a cleared `{attach}` group, or the destruction of source/target — not by garbage collection alone, even once every external reference to the link itself is dropped. A link that becomes unreachable together with its source is eventually reclaimed, and since MEM-001 (audit 2026-08-07) it releases its subscriptions on `globalSignalQueue`/`globalDestroySignalQueue` on that path as well, not just its entry in `getLinksCount()`. The comments in `link.ts`/`SignalLink.ts` that previously promised a weakly-held link now describe what the code does
- `docs/api.md` now says which functions refuse a non-signal argument and which stay silent: `link()`, `touch()` and `value()` throw, `destroySignal()`, `muteSignal()`, `unmuteSignal()` and `unlink()` do nothing and report nothing, and `getLinksCount()` answers `0` (CONS-007, audit 2026-08-08)
- The three deprecated declarations carry an `@deprecated` tag, so an editor strikes them through: `SignalGroup.destroy()`, `SignalGroup#destroy` and the callback overload of `SignalReader` — `sig.get(cb)` is marked, the plain `sig.get()` is not (API-010, audit 2026-08-08)
- The seven members of the `Signal` class — `get`, `set`, `value`, `onChange`, `muted`, `touch`, `destroy` — have JSDoc, and it ships in `lib/Signal.d.ts`. `onChange()` says outright that it does not fire on subscribe (API-015, audit 2026-08-08)
- The concept tables in `AGENTS.md` and `docs/architecture.md` no longer name the private `SignalGroup` constructor as the way to create a group — following them earned a `TS2673`. `SignalGroup.findOrCreate(obj)` is the documented way (API-005, audit 2026-08-08)
- The types table in `docs/api.md` lists the eight exported types it had been missing: `NonThenable`, `SignalValueParams`, `EffectErrorPhase`, `EffectErrorPayload`, `EffectErrorCallback`, `FailingEffect`, `LinkOptions` and `SignalAutoMapKeyType` (audit follow-up, package 23)
- Corrected what the `@signal` decorator's `attach` option does: it names an **additional** group, it does not override the instance group. The signal is a member of both, and destroying the additional group destroys the signal — the instance keeps the entry and the last value, but loses the reactivity (TYPE-004, audit 2026-08-08)
- Every `datei:zeile`-style reference to source or config across `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `docs/` and `skills/` is replaced by a symbol name — 16 of the 23 pointed at the wrong line. `AGENTS.md`'s own module-layering section shows why: its `EffectImpl.ts` line reference has been carried forward, and gone stale, twice since Package 24 (READ-009, CONS-010)
- The GC test counts and file lists scattered across `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `AGENTS.md` and `vitest.config.ts`'s own comments (13, "nine", 20, 411 tests, two spec files) are replaced by "all `src/**/*.gc.spec.ts`" — the number drifts on every new test, the wording doesn't (CONS-010)
- `bench/signal-write.bench.ts`'s baseline comment gains a third, dated measurement on `HEAD`, alongside the two it already carried, instead of overwriting either (READ-009)
- `docs/architecture.md` now names all eleven `Symbol.for` keys and all 28 non-spec files of `src/`; `AGENTS.md`'s source file map and module-layering rule now mention `collect-errors.ts`, which neither listed before
- Corrected the pnpm version (`11.20.0`), the `@spearwolf/eventize` peer dependency range (`^6.0.0`), and the published-tarball file count in `AGENTS.md` (48 files) — all had drifted from `package.json`/the built tree. The tarball's kB figures are dropped rather than corrected: `docs/`, `skills/`, `README.md` and `CHANGELOG.md` all ship in it and all move under ordinary documentation edits — measured, a throwaway 10-line diff shifted the size by ~0.1-0.2 kB, so a byte count recorded in a file that itself ships would already be stale by the next doc package
- The two link-cost measurements in `src/link.ts` that disagreed eightfold are one dated measurement in one place; the second site points at it. They were the same benchmark run warm and cold, which is now stated (READ-010)
- No comment in `src/` justifies a code decision with a coverage percentage or a threshold tier any more — the factual half of each argument stays, the number goes. `signal-core.ts` additionally records that PERF-008 was measured and rejected rather than pending, since that measurement exists nowhere else in the published package (READ-012)
- `value()`'s JSDoc no longer claims it is `beQuiet(() => sig.get())` — it reads `SignalImpl.value` directly and skips `beforeRead`, which is observable on a `{lazy: true}` memo (BUG-013)
- The four object-signal lookups (`findObjectSignalByName`, `findObjectSignals`, `findObjectSignalNames`, `destroyObjectSignals`) ship with JSDoc, each naming its `undefined` case (CONS-014)
- `createEffect()`'s JSDoc names both shapes of its second argument instead of describing a `dependencies` parameter that no overload has; `createMemo()` points at `CreateMemoOptions` instead of an option list that had gone stale (READ-008)
- `[RECALL]()`'s JSDoc says what it does — set `shouldRun` — instead of describing a necessity check that lives in `run()` (READ-004)
- The `beforeRead` hook is documented as what it is — it fires on every read through the reader, tracked or not, so `beQuiet()` does not suppress it, and only `.value`, `value()` and a `readAsValue: true` accessor skip it (BUG-013)
- `docs/api.md` describes `SignalWriterParams<T>` as the `extends` it is rather than a union, and names its exactness bound next to the `lazy` one
- `CLAUDE.md` points at `biome.json` for the rule list instead of naming five of the disabled rules, and says which rules are switched *on* (CONS-013)
- `README.md` gains a "Versioning & stability" section: no compatibility promise below `1.0.0`, semver on the published surface from `1.0.0` on, everything `@internal` exempt at every version (API-011)
- `CONTRIBUTING.md` gains a "Releasing" section: the `version` field in `package.json` is the publish trigger — dropping the `-dev` suffix and pushing to `main` is the release, with no tag and no manual approval in between
- `CONTRIBUTING.md` states the rule that was only ever practice: source, comments, JSDoc, test names, error messages and everything under `docs/` are written in English (READ-015)
- The `@signal()` factory in `@spearwolf/signalize/decorators` has a JSDoc block: `accessor` is mandatory, the signal is always registered both in the object store and in the group of its instance, and `SignalDecoratorOptions` carries the options (INF-001)
- `storeAsObjectSignal` is marked `@internal` and no longer appears in the shipped `lib/object-signals.d.ts`. It was never reachable — `index.ts` does not export it and the `exports` map blocks deep imports (CONS-017)
- `beforeRead` and `readAsValue: true` are no longer listed as two independent `@signal()` options: `docs/cheat-sheet.md` and the `using-signalize` skill's API reference now carry the caveat `docs/api.md` already had — with `readAsValue: true` the property getter reads `.value`, bypasses the reader the hook sits in, and no property access fires it at all. `skills/using-signalize/SKILL.md`, the file a coding agent loads first, names the decorator's options for the first time and says that `readAsValue: true` switches `beforeRead` off, not the other way round (API-018, audit 2026-08-12)
- The "Where the knowledge lives" table in `CLAUDE.md` covers every file under `docs/` instead of listing four of the five, and points at `docs/quickstart.md` — the entry point `README.md`, `CONTRIBUTING.md` and `AGENTS.md` all three link to and the table did not know (DX-008, audit 2026-08-12)
- `CLAUDE.md` and `AGENTS.md` document `pnpm world` as the nine stages it runs: `CLAUDE.md`'s command list named seven, missing both `clean` and `typecheck`; `AGENTS.md`'s command table already had `clean` and named eight, missing only `typecheck` — which its CI paragraph also missed, twice over. It is the only stage that type-checks `src/**/*.spec.ts` — `compile` runs on `tsconfig.lib.json`, which excludes them — so every `@ts-expect-error` in the suite rested on a stage the documentation did not mention

### Chores

- Removed the child-effect slot-recycling machinery from `EffectImpl` (`curChildEffectSlot`, `getCurrentChildEffect()`). It was unreachable — `run()` clears the child list before every callback — and suggested an optimization that never existed. `childEffects` is a plain list now; behaviour is unchanged (IMP-001)
- `SignalGroup.findOrCreate()` checks `store.get(object)` before constructing, instead of unconditionally building a full `SignalGroup` (four `Set`s, two `Map`s, a `WeakMap`, `WeakRef`, `FinalizationRegistry.register`, `eventize(this)`) and discarding it on every cache hit. The private constructor's own `store.has()` check stays in place as a safety net for direct/re-entrant construction, it just no longer carries the common case (PERF-002, 2026-07 audit)
- `SignalAutoMap.updateFromProps()` now computes its entries and returns before opening a `batch()` when there are none, matching the guard `update()` already had for an empty `Map` (PERF-004, 2026-07 audit)
- Added `fast-check` as a devDependency for the new ordering property suite
- Enabled Biome's `style/useImportType` rule and marked the 13 type-only cross-layer imports it found across 8 files as `import type`, with no effect on the emitted JavaScript (ARCH-003)
- A consumer bundle that only uses `createSignal` no longer carries the effect subsystem: 17 087 → 10 539 B minified (5 790 → 3 868 gzip). `Signal.onChange()` and the deprecated `signalReader(callback)` reach `createEffect` through a registered hook instead of an import, and pull the subsystem back in as soon as they are used. A bundle using the full surface pays for the indirection: 25 573 → 25 835 B minified (+262, +1,0 %), 8 591 → 8 711 gzip (ARCH-002)
- `EffectImpl.run()` is split into its static and its dynamic branch, and the snapshot/prune pair of `#lostSignals` now sits in a scope of its own that knows its own commit criterion. Behaviour, API and measured throughput are unchanged (READ-011)
- The entry point names every export instead of re-exporting `link.js` and `SignalAutoMap.js` via `export *`; the published name set is unchanged on both the value and the type axis, measured (API-017)
- Enabled Biome's `performance/noReExportAll`: an `export *` anywhere in the tree now fails `pnpm check` (API-017)
- Enabled Biome's `suspicious/noConsole` for `src/**/*.ts`, with `src/signalize-error.ts` and `src/EffectImpl.ts` as its only exceptions: every other source file writing to the console now fails `pnpm check`, in any spelling of the member access. Diagnostics go through `onSignalizeError()`, whose fallback is those two files (CONS-002)
- `SignalLink.nextValue()` is split into a read object that owns the promise callbacks, the collected unsubscribe handles and the four ways a read can end, plus a cursor predicate of its own; the subscribe order and both early guards stay where they were. Behaviour and API are unchanged, measured against the same 20 mutations before and after — each one takes down the same named tests (READ-014)
- Renamed four non-class modules in `src/` to kebab-case — `bequiet.ts` → `be-quiet.ts`, `createMemo.ts` → `create-memo.ts`, `createSignal.ts` → `create-signal.ts`, `globalEffectStack.ts` → `global-effect-stack.ts` — plus their spec files and two module-less specs with a camelCase head, for one filename convention across `src/` (class modules stay PascalCase, everything else kebab-case). No export, symbol or behaviour changed (CONS-003)
- Refreshed the devDependency lock, closing the two advisories `pnpm audit` reported: `postcss` 8.5.22 → 8.5.26 (GHSA-fxqj-rqcc-2cmp, moderate) and `nanoid` 3.3.16 → 3.3.18 (GHSA-2v37-7h3g-55p8, high), both reachable only through `vite`'s transitive graph. `vite` 8.1.5 → 8.2.1 came along and requires `postcss@^8.5.25` itself, so no `overrides` entry is needed to hold the patched versions

### Tests

- Six of the eight null- and boundary guards named in TEST-026 are now pinned by dedicated tests, each verified to fail when its guard is mutated: `muteSignal()`/`unmuteSignal()` on a non-signal (against removal), `unlink()` with an unknown target (against removal), the `gLinks` entry cleanup once a source's last link is destroyed (against inverting the condition only — plain removal is silently absorbed by the caller reusing the stale empty `Map`), the exact `maxDepth` recursion boundary (against removal), the soft-detach filter in `SignalGroup#off()` skipping an already-destroyed signal (against removal), and `SignalGroup#clear()` on a group with no parent (against removal). The other two named guards turn out to be dead or redundant defense that no mutation can isolate: the non-signal branch of `getLinksCount()` is fully absorbed by `WeakMap.prototype.get`'s spec-guaranteed `undefined` on a non-object key, and the `!effect.destroyed` check before `saveSignalsFromDeps()` is fully absorbed by `whenSignalIsRead()`'s own `#destroyed` guard (already mutation-pinned by the pre-existing `EffectImpl.destroy.spec.ts` test for a mid-callback self-destroy) — both are reported as findings rather than claimed as covered (TEST-026)
- New microbenchmark suite under `bench/` (Vitest Bench, `pnpm bench`) covering signal writes (with/without subscribers), memo recompute, effect create/destroy, `SignalGroup.findOrCreate`, and `batch()` overhead. CI runs it informatively — no regression gate yet (PERF-003, 2026-07 audit)
- `assertEffectSubscriptionsCountChange()` double-counted the baseline against a non-zero starting subscription count, an error masked only because its one caller always started from zero (TEST-007). `unsubscribe-effect.spec.ts` — cited by `CLAUDE.md` and `AGENTS.md` as the reference for verifying subscription leaks — now actually carries a subscription-count balance (TEST-010)
- `SignalGroup.spec.ts`'s `detachGroup()`/`clear()` tests now assert `getGroupMemberCounts()` directly instead of arguing through a re-attach that proved nothing. Every collection point in `SignalGroup.off()`/`clear()` that catches a throwing teardown step now has its own test proving the rest of the teardown still runs to completion. The second branch of the parent-chain cycle guard in `attachGroup()` is now exercised via the new `@internal` test seam `$setParentGroup` (TEST-001, TEST-004, TEST-009)
- `Signal#muted`, `findObjectSignals()` and the other `object-signals.ts` lookups on a store-less object, the `@signal({readAsValue: true})` decorator option, the `[obj, name]` tuple overload of `touch()` (including its no-op guards), and the priority splice inside `batch()` now have tests — the new `src/object-signals.spec.ts` is this module's first spec file (TEST-002, TEST-003)
- The one assertion in the project that hung on a wall-clock threshold — the `Promise.race` in the ASYNC-005 (audit 2026-08-06) `SignalLink.spec.ts` test — now races against a macrotask sentinel (`setImmediate`) instead of a 200 ms `setTimeout`, so the outcome is decided by event-loop ordering rather than a shared CI runner's timing. The two remaining `rejects.toBeDefined()` calls in `SignalLink.spec.ts` now pin down the concrete rejection reason (`controller.signal.reason`), matching the other eight rejection assertions in the file (TEST-011, TEST-015)
- Coverage thresholds are now per file instead of one global average, staggered across three tiers (a floor under every file, 100% for every file outside the current audit worklist, and a 100%-with-slack tier for the files still on it) (TEST-006)
- A new smoke test (`smoke/dist-smoke.test.ts`, `pnpm test:smoke`) loads the built `dist/` through the package's own `exports` map on plain Node, instead of anything in `src/`. It is the first test where a `@signal() accessor` application is lowered by **tsc**, the way a consumer's own compiler would, rather than by SWC's `decoratorVersion: '2022-03'`, which every other decorator test runs through (TEST-008)
- A new fast-check property suite (`src/ordering.property.spec.ts`) pins the ordering invariants that only ever had one or two handwritten examples: priority order with and without a batch, dedup and final-value visibility in a batch flush, nested batches behaving like one flat batch, nested effects rebuilding in pre-order on every rerun, and a memo read during a flush never seeing a stale value. All five `it()` blocks run against a fixed seed for reproducible failures (TEST-012)
- The four `*.gc.spec.ts` suites fail instead of skipping themselves when the run has no `--expose-gc` (BUILD-016)
- Every spec with counter guards now tears its resources down in a `finally`, so a real regression fails one test instead of taking the rest of the file with it — 384 tests converted across 32 files (TEST-017)
- The two save/restore frames without a test — `beQuiet()` and `runWithinEffect()` — and the `attachEffect()` dedup guard are now pinned: removing the `finally` or the guard fails a test instead of passing silently (TEST-016, TEST-021)
- The three untested `BUSY_*` re-entrancy guards and the three documented teardown orders of `SignalGroup` are pinned: removing a guard or swapping an order now fails exactly one test instead of passing silently (TEST-018, TEST-019)
- Three of the five finalizer bookkeeping spots around a collected link and group are pinned: the double decrement of `getLinksCount()` on a collected link, the husk left behind in `getSignalGroupsCount()`, and the membership check in the `SignalGroup` finalizer backstop each now fail exactly one test instead of passing silently. The other two — the wrapper `delete` in the resource finalizer and the self-keyed-group registration skip — have no observable effect of their own and stay untested by design (TEST-020)
- The point at which an effect bumps its generation counter, the destroyed-read and unread-lazy branches of `createSignal()`, and the name fallback in `SignalGroup#detachSignal()` are pinned: each now fails exactly one test instead of passing silently (TEST-023, TEST-024, TEST-025)
- Every spec file now checks all three global counters — effects, signals, links — in `beforeEach`/`afterEach`, instead of only the subset that used to be there; five files stay short of that by design, each documented in place (see `AGENTS.md`)
- The five spec files that had no counter guard at all closed ten leaking tests first — 8 effects and 18 signals across `createMemo`, `batch`, `createSignal.lazy`, `unsubscribeEffect` and `createSignal.compareFn` — before gaining one
- The same five files picked up 34 new `finally` teardown blocks for resources that used to sit unguarded behind the assertions (36 total, 2 pre-existing)
- The position of `shouldRun = false` relative to the cleanup call inside `EffectImpl.run()` is pinned: moving it ahead of `runCleanupCallback()` now fails exactly one test — a direct `run()` from within a cleanup used to disappear silently — instead of passing unnoticed
- New `src/index.public-surface.spec.ts` pins the entry point's value exports and rejects both `export *` and `export type *` (API-017)
- The two early guards of `SignalLink.nextValue()` and the link-side release in its abort path are pinned: swapping the guards (an already-aborted signal on an already-destroyed link would reject with the destroy error instead of the abort reason) or dropping the shared `unsubscribe()` from the abort path (an aborted read would leave its DESTROY and VALUE subscriptions on the link) each now fails exactly one test instead of passing unnoticed (READ-014)

### Build System

- `smoke/tsconfig.json` compiles with `strictNullChecks: true` instead of inheriting the repo's `false`. The smoke test is the consumer profile, and it is the only place where a `Type | undefined` in the shipped declarations can be witnessed at all — with the flag off the union collapses and no `@ts-expect-error` there could ever fail (API-013)
- `pnpm test` now runs all `src/**/*.gc.spec.ts` suites itself, via a dedicated `gc` project in `vitest.config.ts` (`--expose-gc`, Vitest's default `forks` pool), so they are measured in the same coverage run as everything else instead of only under `pnpm test:gc`. `pnpm world` now includes the `test:gc` step (TEST-005, TEST-014)
- `pnpm world` and CI now also run `checkPkgTypes` and `test:smoke`, both against a freshly built `lib/`/`dist/` (`pnpm dist`, which runs before either); `pnpm smoke` runs the smoke test's build-and-run pair on its own, and `pnpm clean` removes `smoke/build` along with the other generated directories (TEST-008, BUILD-008)
- `pnpm checkPkgTypes` now runs `attw --pack --profile esm-only` instead of the unprofiled `attw --pack`, and is bestable for the first time: the unprofiled check always failed, because `node10` and `node16 (from CJS)` cannot pass for a package that is ESM-only and uses a subpath export — the profile excludes exactly those two modes and leaves `node16 (from ESM)` and `bundler` checked in full (BUILD-008)
- New `pnpm typecheck` script (`tsc --noEmit -p tsconfig.json`) runs a real compiler pass over specs, benchmarks and the Vitest configs — code that was previously only transpiled by SWC and never type-checked. Wired into `pnpm world` (after `check`, before `compile`) and into CI, right after the `pnpm check` step (BUILD-003)
- CI runs on pull requests against `main` now too, so a PR from a fork is actually checked (BUILD-002)
- A push to `main` runs the same CI workflow as any feature branch, via `workflow_call`, before the deploy job publishes — previously only `pnpm lint` and `pnpm test` (BUILD-002)
- `scripts/publishPackage.cjs` now exits with code 1 when `npm show` fails, and reports a failed `npm publish` with npm's own error output instead of crashing with `ERR_INVALID_ARG_TYPE` (BUILD-010)
- `vitest.config.ts` refuses to start when a coverage threshold glob group matches no file — an empty group used to pass silently and enforce nothing (BUILD-015)
- the published tarball is an allowlist (`package.json#files`) instead of an `.npmignore` denylist — 125 files down to 48, and an internal planning document no longer ships (BUILD-001)
- `lib/*.js` and `lib/*.js.map` are no longer published; no resolution path ever reached them and they were 25 % of the tarball (BUILD-006)
- the test-only assertion helper moved to `src/__testing__/` and is excluded from the declaration build, so the published package no longer carries a module that calls Vitest's global `expect` (ARCH-004)
- the published `.d.ts` finally carry their JSDoc — `removeComments` no longer applies to the declaration build, so every documented symbol reaches the consumer's tooltip (BUILD-004)
- `@internal` symbols are stripped from the published types: `Effect#onDestroy`, `SignalGroup#memberCounts`, `clearGroupFromFinalizer`, the `signal-core` leaf functions and the `collect-errors` helpers are no longer in autocomplete (BUILD-011)
- `nextValue()` and `asyncValues()` take an `AbortSignalLike` instead of the global `AbortSignal`, so the types resolve for a consumer on plain `"lib": ["ES2023"]` without `@types/node` (BUILD-005)
- `dist/` ships sourcemaps with the source embedded; `lib/` no longer ships a declaration map that points at files the package does not contain (BUILD-007)
- `engines.node` lowered from `>=24.13` to `>=22` — no construct in `src/` needs anything newer, and Node 22 stays in LTS until 2027 (BUILD-009)
- CI runs the full gate as a matrix over Node 22 and Node 24, so the declared floor is exercised instead of asserted (BUILD-009)
- New `pnpm check:refs` (`scripts/check-doc-refs.mjs`), wired into `pnpm check` and therefore into `pnpm world` and CI: fails the build if `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `docs/**/*.md` or `skills/**/*.md` contain a `datei:zeile` reference. `remediation-plan.md` and `CHANGELOG.md` are exempt — they are history, entitled to point at where a line used to be (READ-009, CONS-010)
- Removed the dead `/* eslint-disable no-console */` from `scripts/publishPackage.cjs` — ESLint left the project in v0.28, Biome has no matching rule directive and none is needed here
- The bundle banner's `@version` line no longer carries a build date (`+esm.YYYYMMDD` → `+esm`), and the copyright year is frozen at `2022-2026` instead of computed — two builds of the same commit, from the same `pnpm-lock.yaml` on the same Node major version, now produce byte-identical output regardless of the day they run on. The shared chunk's hashed filename changes once as a result; it is not a public import path (SEC-001)
- New `pnpm check:banner` (`scripts/check-banner.mjs`), wired into `pnpm check` and therefore into `pnpm world` and CI, after the same pattern as `check:refs`: it renders the bundle banner twice under different ambient clock/random state and fails the build if the two renders differ (SEC-001)
- `scripts/publishPackage.cjs` runs `npm` through `execFile` with an argument list instead of a shell command line, for both calls it makes — the package name from `package.json` reaches npm as an argument, with no shell to interpret it

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
