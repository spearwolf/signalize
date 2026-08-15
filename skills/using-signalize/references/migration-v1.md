# Migrating to v1.0.0 — `@spearwolf/signalize`

`1.0.0` is the first release that carries a compatibility promise. Everything below it had
none, and this release cashes that in: the whole public surface was audited, and what was
wrong got fixed rather than preserved. Most applications compile and run unchanged. This
page lists what a `tsc` pass or a test suite can actually trip over, and the repair for each.

Read it top to bottom once — the sections are ordered by how likely they are to hit you.
The `CHANGELOG.md` of the repository carries the same list as one-line facts; this page
carries the repairs.

## Before anything else: upgrade every copy at once

The internal `Symbol.for` keys moved into a `@spearwolf/signalize/` namespace. A process
that ends up with one pre-`1.0` and one `1.0` copy shares **nothing** between them:
`isSignal()` answers `true` across the boundary and every other operation fails. All
`1.0`+ copies recognise each other.

From this release a second copy reports itself once, when it loads, through
`onSignalizeError()` with `source: 'multiple-instances'` and the load paths of every copy —
or on `console.error` when no handler is registered. Two statically imported copies always
land on the console, because the message is registered during module evaluation, before any
handler can exist.

## Removed

| Gone | Replacement |
| --- | --- |
| `@memo` decorator, `MemoDecoratorOptions` | a class field: `foo = createMemo(() => …, {attach: this})` — eager by default |
| `ISignalImpl` export | `LinkSource<T>`, the type `SignalLink#source` has now |
| `EffectImpl.maxDepth` (documented, never reachable) | `setMaxEffectDepth(n)` / `getMaxEffectDepth()` |
| `package.json#main`, `#module`, `#types` | the `exports` map, which was already the only path that resolved |

Dropping `main`/`module`/`types` is the one that can break a build outright: a resolver with
no `exports`-map support — TypeScript's `moduleResolution: "node"`, webpack 4 — no longer
finds the package at all. `./decorators` was already unreachable there. Move to
`moduleResolution: "bundler"` or `"nodenext"`.

## Compile errors, and what each one wants

The types got stricter in nine places. None of them changes runtime behaviour; every one of
them turns a call that used to be silently wrong into a `tsc` error.

**`unknown` instead of `any` as the type-parameter default.** `SignalLike`, `SignalLink`,
`ValueCallback` and `SignalGroup#signal()` no longer default to `any`. Name the type —
`SignalLike<number>`. Where the annotation genuinely means "some signal, whatever it holds"
(a heterogeneous `SignalLike[]`, a parameter of your own wrapper), the replacement is
`SignalLike<any>`, **not** `SignalLike<unknown>`: these parameters are invariant in the
signal types and contravariant in `ValueCallback`, so nothing widens to `unknown`.
`SignalLink<T>` is the exception — it is covariant now, so a bare `SignalLink` accepts a
`SignalLink<number>` again.

**`Signal<unknown>` out of the lookups.** `SignalGroup#signal(name)`, `findObjectSignals()`
and `SignalAutoMap#signals()`/`#entries()` hand out `Signal<unknown>`. An assignment to a
concrete type that used to pass in silence is an error now: pass a type argument
(`group.signal<string>('theme')`) or check.

**`{lazy: true}` means a factory, and only a factory.** `signal.set(fn)` and
`createSignal(fn)` without the flag no longer store the function as the value; the mirror
image, `set(v, {lazy: true})` and `createSignal(v, {lazy: true})` with a plain value, no
longer build a signal whose first read dies with `TypeError: this.valueFn is not a
function`. Both are `TS2769`. What was almost always meant is the lazy form — give it its
`{lazy: true}`. Whoever really stores a function as a value names the type:
`createSignal<() => number>(fn)`.

The flag must be *statically* `true`. Four spellings qualify: the literal,
`{lazy: true} as const`, a variable annotated `SignalParams<T> & {lazy: true}`, and
`{lazy: flag}` where control flow has narrowed `flag` to `true`. A variable typed plain
`SignalParams<T>`/`SignalWriterParams<T>` declares `lazy?: boolean`, which is not a promise,
so it keeps the factory branch shut — write the literal at the call site, pin it with
`as const`, or annotate the intersection. **A spread repairs none of this**: `{...params}`
drops freshness, not keys.

**Both constructors now name their options exactly.** That clause is the price of the one
above — refusing `{lazy: true}` while admitting `lazy?: boolean` needs a generic params
type, and a generic params type costs the excess property check. So an options *variable* is
now checked as strictly as a literal, and a params type carrying a key the published options
do not declare is `TS2769`: an interface extending `SignalParams<T>`, an intersection, a
class instance, the rest object of a destructuring, a variable with an inferred stray key, a
pattern index signature such as `data-${string}`. A wrapper generic in its own params
(`<Q extends SignalParams<T>>(q: Q) => createSignal(v, q)`) is refused too — `keyof Q` is
unknown, so nothing is assignable to the deferred conditional.

The repair is always the same: **name the params type.** Annotate the variable
`SignalParams<T>`/`SignalWriterParams<T>`, assert it at the call site, or type the wrapper's
parameter by name instead of constraining a type parameter. A plain `string`, `number` or
`symbol` index signature is exempt. Two gaps to know about: a params type entirely *disjoint*
from the options (`{label: string}` as a variable) now compiles and does nothing, and
`createSignal<number>(5, {lazy: true})` compiles because naming the type argument switches
both params checks off — TypeScript has no partial type argument inference. Drop the type
argument and let the value infer it.

**`createSignal<T>()` without an initial value is `Signal<T | undefined>`.** The signal holds
`undefined` until the first write and the type finally says so. Under
`strictNullChecks: true` every assignment of `.value`/`get()` to a bare `T` needs a check, a
default or a `!`. With the flag off the union collapses and nothing changes.
`createSignal<T>(undefined, {attach: host})` still works.

**`link()` is an overload pair** — one signature for a signal target, one for a callback
target — so `link(sig, (v) => …)` infers `v` instead of reporting `TS7006` (or silently
falling to `any`). The annotation `docs/api.md` used to recommend still compiles and is no
longer needed. The cost is one rule: anything that reduces the pair back to a single
signature lands on the **callback** signature. A call whose target is a union mixing a
callback with a signal reaches neither overload (`TS2769`) — narrow with
`typeof target === 'function'`, split the call, or assert. A generic pass-through written as
a call signature reports `TS2345`; give it a bare type parameter instead, which keeps the
whole overload set. Treating `link` as a *value* (assigning it, passing it, a `satisfies`
with a hand-written monomorphic signature) reports `TS2322`/`TS2345`/`TS2769`. And
`Parameters<typeof link>[1]` is `ValueCallback<unknown>` now, so a variable typed from it no
longer accepts a signal. Repair: annotate the target `typeof link` where you own the
signature, otherwise wrap the call in an arrow that narrows before delegating.
`unlink()` is unchanged.

**`Signal#onChange(cb)` takes a `ValueChangedCallback<T>`** — `(value: T) => void | (() =>
void)`. An expression body returning something else fails at the return expression
(`sig.onChange((v) => arr.push(v))`), a block body with a `return` fails at the argument. A
returned function is still the cleanup; the runtime still ignores a non-function return. An
`async` callback is refused outright now — switch to `createEffect()`, which takes one and
still honours its resolved cleanup.

**`onCreateEffect()`/`onDestroyEffect()` callbacks are typed** `(effect: FailingEffect) =>
void`. A handler demanding a wider parameter is rejected, and the eventize-native subscribe
forms — `onCreateEffect(priority, cb)`, `onCreateEffect(listenerObject)` — are no longer part
of the contract. Priority is the second argument now, as it is on `onEffectError()`.

**`SignalAutoMap` key types narrowed.** `#update()` takes
`Map<string | symbol, unknown>`, and `fromProps()`/`updateFromProps()` take keys from
`Extract<keyof T, string | symbol>`. A numeric key used to create an entry that `keys()`
then mislabelled.

## Runtime behaviour that changed

**Several failures now arrive as one `AggregateError`.** Every teardown and every delivery
runs to the end and collects what fails, instead of throwing the first error and abandoning
the rest. This covers a write with several failing effects (link callbacks included),
`destroySignal()`, `Effect.destroy()`, `unlink()`, `SignalGroup#clear()`/`#off()` and the
static `SignalGroup.clear()`, `SignalAutoMap#clear()`, `destroyObjectSignals()`, a failed
creation whose rollback fails on top, and a `batch()`/`hibernate()` that fails on both sides.
`errors` is in delivery or teardown order.

*Repair:* a `catch` that does an `instanceof` check against a specific error type, or reads
`.message` directly, has to unwrap `err.errors` first. **A single failure is unchanged** and
still rethrows that error unchanged — the wrapper only appears from two failures on.

**Every message this library authors starts with `[signalize] `.** Thrown, rejected out of
`nextValue()`/`asyncValues()`, or reported through `onSignalizeError()`. A comparison against
an exact string needs the prefix; a substring or unanchored regex match is unaffected. The
recursion guard's message additionally names `setMaxEffectDepth(n)` instead of
`raise EffectImpl.maxDepth`; the `maxDepth=N` part is unchanged.

**`batch()`, `beQuiet()` and `hibernate()` refuse an `async` callback**, at `tsc` time and
again at runtime with a `TypeError` if a duck-typed thenable slips through untyped. The
reason is the same for all three: the frame is closed by its `finally` the moment the
callback hands back its pending promise at the first `await`, so everything past that point
ran unbatched, tracked and loud. Code that passed an `async` callback compiled and appeared
to work.

*Repair:* move the async work out of the frame. Do **not** catch the `TypeError` — the
refused callback has already started, and the promise it returned is now unobserved. Nobody
was ever awaiting it (`batch()` returns `void`), so a rejection inside it arrives as an
unhandled one, which ends the process under Node's default. `beQuiet()` returns what its
action returns now, so the untracked peek is finally usable.

**`createMemo()` no longer wraps its recompute write in `batch()`.** Only relevant if the
memo's own callback writes to *other* signals as a side effect: those writes used to be
grouped with the memo's write, so a dependent effect tracking both saw one deduplicated run.
Now it sees one run per write, with a torn intermediate value on the first.

*Repair:* pass `{batchWrites: true}`. The default leaves its cost — a full batch flush per
recompute, once the memo has a dependent effect — unpaid for every memo that does not need
it, which is nearly all of them.

**`SignalGroup.attachSignalByName()` gives the name ownership of the signal.** Rebinding the
name, or passing `undefined`, destroys the signal that was bound to it. Code that rebound a
name and kept using the old signal now holds a destroyed one — still a value container, but
it no longer drives effects. Conversely, `clear()` no longer destroys the pile of signals a
repeatedly rebound name used to accumulate; they are gone by then.

*Repair:* call `attachSignal()` on a signal that has to outlive its name.

**`SignalGroup#attachEffect()` throws on a destroyed effect** —
`[signalize] Cannot attach a destroyed effect to a group`, the rule `attachSignal()` and
`attachLink()` already applied. It used to accept such an effect silently and hold it until
the next `clear()`. The method also takes the `Effect` that `createEffect()` returns now — no
`as any` — and hands the argument back with its own type, and an attached effect leaves the
group on `destroy()` instead of lingering until `clear()`.

**`getSignalsCount()` counts reachable signals, not created ones.** A signal dropped without
`destroySignal()` is subtracted once the garbage collector reclaims it, at a moment that
cannot be observed or forced.

*Repair:* a test that reads the count right after a teardown as a deterministic leak
assertion can see a stale, too-high number even though nothing leaked. Poll the count, or
force a collection with `--expose-gc`.

**The `FailingEffect` handed to `onCreateEffect()`/`onDestroyEffect()`/`onEffectError()`
carries prototype methods**, not bound properties. `const {destroy} = effect; destroy()`
throws a `TypeError` — call `effect.destroy()` instead. `Object.keys()` on it lists five own
properties instead of nine, and `childEffects` is a private field now: an assignment to it
from such a handler used to corrupt the effect's teardown and lands on an inert own property
today. The `Effect` that `createEffect()` returns is untouched — its methods stay bound, as
does the unsubscribe function `Signal#onChange()` returns.

**`asyncValues()` waits for the next propagation.** `iter.next()` used to settle immediately
with the previous value whenever the retained slot held one — from the first propagated value
on, that was every read, which is why a `for await` without a `stopAction` used to spin as a
microtask hot loop. Code that drove such an iterator by hand, or counted the values a loop
saw per write, sees the change; a `for await` that consumes what it is given does not.
`nextValue()` called on its own is exempt and still settles on the retained value.

`asyncValues()` also claims the link's `'value'` retain policy for the duration of the
iteration and gives it up when the last iterator stops — taking a caller's own
`retain(link, 'value')` down with it. Set it again afterwards if you need it.

**`touch()`, `value()` and `unlink()` refuse a non-signal argument** with a named
`TypeError` instead of answering `undefined` or returning wordlessly. Both `touch()`/`value()`
overloads and `LinkableSource<T>` already rejected such an argument at `tsc` time, so only
untyped JavaScript callers reach this.

## Diagnostics: one channel for everything

New in this release, and worth wiring up before you upgrade rather than after:

```ts
import {onSignalizeError, onEffectError} from '@spearwolf/signalize';

onEffectError(({error, effect, effectId, phase}) => report(error));
onSignalizeError(({level, source, message, error}) => report(message));
```

- `onEffectError(cb, priority?)` receives rejections of `async` effect and cleanup callbacks
  — failures that have no caller left to throw at. A **synchronous** effect failure does not
  go through it; it still reaches whoever wrote the signal.
- `onSignalizeError(cb, priority?)` receives everything else with no caller: finalizer
  errors, deprecation notices, the 1000-links threshold, a second copy of the library, an
  option that does nothing in the combination it was passed. `source` is one of `'effect'`,
  `'group-finalizer'`, `'link-finalizer'`, `'automap-finalizer'`, `'link-count'`,
  `'deprecation'`, `'multiple-instances'`, `'ignored-option'` — give a `switch` over it a
  `default`, new members may appear in a minor release.
- Without a handler every one of those messages stays verbatim on
  `console.warn`/`console.error`. **With** a handler the handler owns them, deprecation
  notices included.

Two of these are new noise on an unchanged call: `createMemo(fn, {name})` without `attach`
and `createSignal(existingSignal, params)` now report the options they drop, on every such
call. Both flag a call that does not mean what it looks like — a name is a slot inside a
`SignalGroup`, and a passthrough creates no signal for `params` to configure.

## Deprecated, still working

`SignalGroup.destroy(obj)`, `SignalGroup#destroy()` and the callback overload of
`SignalReader` (`sig.get(cb)`) carry an `@deprecated` tag. Their notice is reported once per
process now, not once per call. Use `SignalGroup.delete(obj)` and `sig.onChange(cb)`.

## What you probably do not have to do anything about

The bulk of this release is leaks and lost failures, and it needs no migration — it just
stops costing you. Effects created inside another effect's callback are children of it
instead of orphans. `createMemo()` in an effect body no longer leaves a signal behind per
rerun. Links, groups and `SignalAutoMap` entries are held weakly and release their queue
subscriptions when they are collected. A throwing effect no longer cuts a delivery short, a
throwing cleanup no longer leaves a half-destroyed effect, and a creation whose first run
throws is taken back instead of leaving an unreachable, still-subscribed effect behind.

If your test suite asserts on the global counters, expect them to go *down*.
