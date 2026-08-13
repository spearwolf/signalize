# API reference — `@spearwolf/signalize`

Signatures and options. For *why* something behaves as it does see `pitfalls.md`.

## Entry points

```ts
import {/* core */} from '@spearwolf/signalize';
import {signal} from '@spearwolf/signalize/decorators';
```

Decorators are **TC39 standard** form — no `experimentalDecorators`, and the `accessor` keyword is required on `@signal`.

### Exported from `@spearwolf/signalize`

```ts
// signals
createSignal, destroySignal, isSignal, muteSignal, unmuteSignal,
getSignalsCount, touch, value
// effects
createEffect, getEffectsCount, onCreateEffect, onDestroyEffect, onEffectError,
getMaxEffectDepth, setMaxEffectDepth
// diagnostics
onSignalizeError
// memos
createMemo
// links
link, unlink, getLinksCount
// context modes
batch, beQuiet, isQuiet, hibernate
// lifecycle / collections
SignalGroup, getSignalGroupsCount, SignalAutoMap
// host-object signals
findObjectSignalByName, findObjectSignals, findObjectSignalNames, destroyObjectSignals
// classes (for `instanceof` and as types)
Signal, Effect

// type-only re-exports (no runtime value):
//   SignalReader, SignalWriter, SignalLike, SignalParams, SignalWriterParams,
//   SignalValueParams, NonThenable,
//   EffectOptions, EffectOptionsWithSignalDeps, EffectOptionsWithNameDeps,
//   EffectDeps, SignalLikeDeps, EffectCallback, CreateMemoOptions, LinkOptions,
//   EffectErrorPayload, EffectErrorPhase, EffectErrorCallback, FailingEffect,
//   SignalizeErrorPayload, SignalizeErrorCallback,
//   SignalLink, ValueCallback, LinkSource, SignalAutoMapKeyType, AbortSignalLike,
//   CompareFunc, BeforeReadFunc, VoidFunc, ValueChangedCallback
```

### Exported from `@spearwolf/signalize/decorators`

```ts
signal
// types: SignalDecoratorOptions, SignalReaderDecoratorOptions
```

There is no memo decorator — bind a memo to the instance group with `createMemo(..., {attach: this})`, which dies with the surrounding effect if the instance is constructed inside one (`pitfalls.md`, 7a).

## Signals

```ts
const c = createSignal(0, {
  lazy:       false,              // true → `initial` is a factory, evaluated on first read; REQUIRED for that form
  compare:    (a, b) => a === b,  // custom equality (default: ===)
  beforeRead: () => {},           // every reader read, tracked or not (NOT on .value/value())
  attach:     obj,                // SignalGroup lifecycle
});                               // no key beyond these four — name the params type if yours has one

const d = createSignal<number>();       // Signal<number | undefined> — undefined until first write
createSignal(0, {lazy: true});          // compile error: the flag belongs to the factory form alone
createSignal<number>(0, {lazy: true});  // but naming T switches the check off (pitfalls.md, 4c)

c.get();                    // tracked read — registers a dependency inside an effect
c.value;                    // untracked read
c.set(v);   c.value = v;    // write
c.set(v, {touch: true});    // notify even when equal
c.set(fn, {lazy: true});    // store a factory — literal `true` only, not a SignalParams variable
                            // and factories only: c.set(v, {lazy: true}) is a compile error
c.touch();                  // force-notify
c.destroy();
c.muted = true;             // muted signals neither notify nor touch — set() still stores
c.destroyed;                // true once destroyed — still holds its value, just silent
const off = c.onChange((v) => {});   // → unsubscribe; does NOT fire on subscribe
                                     // cb returns a cleanup fn or nothing;
                                     // a value or an async cb does not compile
```

Top-level helpers:

```ts
value(c);   value([obj, 'prop']);   // untracked read
touch(c);   touch([obj, 'prop']);   // force-notify
isSignal(x);
muteSignal(c);  unmuteSignal(c);
destroySignal(...signals);
getSignalsCount();   // live = created, not destroyed, still reachable
```

## Effects

```ts
createEffect(() => {
  use(c.get());
  return () => cleanup();       // optional cleanup, runs before each rerun and on destroy
}, {
  autorun:      true,           // false → run manually via eff.run()
  dependencies: [c],            // STATIC deps → disables auto-tracking (not the
                                //   effect context); does NOT autorun
  priority:     0,              // higher runs first
  attach:       obj,
});

createEffect(cb, [c]);                       // shorthand → static deps
createEffect(cb, ['name'], {attach: obj});   // names resolved against the group

const eff = createEffect(cb, {autorun: false});
eff.run();       // runs only if a tracked dep changed since the last run
eff.destroy();
eff.destroyed;   // true once the effect is gone, however it was destroyed
```

String/symbol dependency names require `attach` — the pairing is checked at compile time.

```ts
getEffectsCount();
onCreateEffect((eff) => {}, priority?);   // → unsubscribe; eff: FailingEffect = {id, destroy()}
onDestroyEffect((eff) => {}, priority?);  // → unsubscribe; eff: FailingEffect, already destroyed

setMaxEffectDepth(256);        // synchronous self-write recursion guard; default 256
getMaxEffectDepth();           // reads it back
```

### Effect errors and async callbacks

```ts
onEffectError(({error, effect, effectId, phase}) => {}, priority?);  // → unsubscribe
// phase: 'callback' | 'cleanup';  effect: FailingEffect = {id, destroy()}
```

Reports failures that have no caller left to throw at: rejections of `async` effect callbacks and `async` cleanups are the common case, plus a cleanup that throws synchronously when its throw can no longer reach a legitimate caller — a superseded run, an effect already destroyed, or one destroying itself as its own run winds down (pitfall 11b): it throws with a full stack present and still lands here. Without a handler they fall through to `onSignalizeError()` with `source: 'effect'`, and with nobody there either to `console.error` with the effect id — never to an unhandled rejection. Every other synchronous throw propagates to whoever triggered the run — but only after every other effect of that same write has run; several failures of one write arrive as an `AggregateError` in delivery order.

Two constraints on the handler: it must be **synchronous or catch its own errors** (nothing awaits it, so `onEffectError(async p => { await report(p) })` with a failing `report` crashes the process exactly as before), and a synchronous throw out of it **stops the dispatch**, so lower-priority handlers miss that event.

The cleanup an `async` callback resolves to runs **late** — right when the promise settles — when the effect has re-run or been destroyed in the meantime (pitfall 11a). Nothing is awaited before the next run.

The synchronous case knows the same rule: a run overtaken by a re-entrant self-write hands its cleanup over at once instead of losing it (pitfall 9).

### Every other diagnostic with no caller

```ts
onSignalizeError(({level, source, message, error}) => {}, priority?);  // → unsubscribe
// level:  'error' | 'warn'
// source: 'effect' | 'group-finalizer' | 'link-finalizer' | 'automap-finalizer'
//       | 'link-count' | 'deprecation' | 'multiple-instances' | 'ignored-option'
//                                       — may gain members in a minor release
// message: always there, verbatim what the console would have shown
// error:   absent on a notice — none is invented to fill the field
```

The general channel for what the library cannot throw at anyone: a teardown that threw inside the `FinalizationRegistry` callback of `SignalGroup`, `link()` or `SignalAutoMap`; the 1000-links threshold; the deprecation notices; a second copy of the library loaded into the same process, which shares no signals, effects, groups or links with the first; effect failures that no `onEffectError()` handler took; and an option that has no effect in the combination it was passed in (`createMemo({name})` without `attach`, `createSignal(existingSignal, …)` for anything but `attach`), on every such call, because that marks a misspelled call rather than a lifecycle event. Without a handler every one of them goes to `console.warn(message)` / `console.error(message, error)` exactly as before — the channel takes nothing away from code that ignores it.

With a handler, the console stays quiet and the handler owns the message, **deprecation notices included** — the one surprise here: a reporting handler that only forwards `level: 'error'` makes them invisible. Same two constraints as `onEffectError()` (synchronous or self-catching; a throwing handler stops the dispatch), and a throwing handler is caught rather than rethrown, because most call sites are registry callbacks where a throw kills the process. An effect failure never arrives twice: `onEffectError()` gets it first, this channel only when nobody listens there.

## Memos

```ts
const m = createMemo(() => a.get() * 2, {
  lazy:         false,   // true → recompute on read; dependent effects do NOT re-run
  priority:     1000,
  attach:       obj,
  name:         'm',     // group registration name ('' = no name)
  batchWrites:  false,   // true only if the computer itself writes OTHER signals as
                          // a side effect. Costs a full flush per recompute — but
                          // only once the memo has a dependent effect: measured at
                          // roughly 3x the default, while a memo nobody depends on
                          // defers nothing and skips the flush for free. Side-effect
                          // writes are the exception, so the default leaves that
                          // cost unpaid, and it pays off only when one recompute
                          // would otherwise trigger the same effect twice. Reading a
                          // composed memo from inside such a callback is fine: a
                          // memo's read hook recomputes past the open batch, so it
                          // comes back fresh under either setting. (One level — a
                          // memo stale only through another memo still reads its
                          // pre-batch value; see docs/api.md.)
});
m();                 // SignalReader<T>
```

## Links

```ts
const con = link(src, target, {attach: obj});   // target: signal | (value) => void (callback param inferred from src)
unlink(src, target);   unlink(src);             // drop one, or all links from src
getLinksCount();       getLinksCount(src);
// unlink(src) tears every link down, then reports — several failures as an AggregateError
// held until destroy()/unlink()/{attach} clears/source|target dies — a link on a still-live source is never reclaimed by GC alone
// link() warns once per source at 1000 links on that source — console.warn, or
//   onSignalizeError() with source: 'link-count' if a handler is registered

con.lastValue;  con.isMuted;  con.isDestroyed;
con.mute();  con.unmute();  con.toggleMute();
con.touch();  con.destroy();  con.attach(obj);

await con.nextValue({signal});                                    // optional AbortSignal (AbortSignalLike); rejects with an Error on destroy, with signal.reason on abort
for await (const v of con.asyncValues((v, i) => i >= 5, {signal})) { /* … */ }
// abort throws the signal's reason out of the loop; the link being
// destroyed ends it quietly instead, same as `stop(value, i) → true`
```

A link is an eventize object and emits `'value'`, `'mute'`, `'unmute'`, `'destroy'` on itself.
A `'destroy'` listener already sees `isDestroyed === true`, so calling `destroy()` again from
one is a no-op. If a propagation is re-entered — the callback or a target effect writes the
source again — the nested run wins: the outer one emits no `'value'` and leaves `lastValue`
alone, as does one whose callback destroyed the link.

`asyncValues()` retains only the last propagated value — intermediate values
between two reads are lost. Within one iterator every propagated value arrives
at most once — a read with nothing new waits for the next propagation.
Several `asyncValues()` iterators over the same
link share that one retained slot; it's released only once the last of them
stops, so one finishing early doesn't cut off a still-running sibling. That
release switches retaining off, so a `nextValue()` after the last iterator
waits for the next value instead of resolving with a stale one — and a
`retain(link, 'value')` you set yourself does not survive an `asyncValues()`
run.

## Context modes

```ts
batch(() => { a.set(1); b.set(2); });   // dedup + flush in priority order — a HINT, not a guarantee
const v = beQuiet(() => a.get());       // reads untracked, writes silent; counter-based, nests; returns the callback's result
hibernate(() => { /* outer reactive context suspended */ });   // sync callback only — tsc rejects an async one
isQuiet();
```

`hibernate` flushes an active outer batch before running its callback, so queued effects are not lost, and restores batches / quiet state / effect stack afterwards — also when it is the flush itself that throws. Its callback must be synchronous, like `batch()`'s and `beQuiet()`'s: an `async` one is refused at compile time, because the restore happens at the first `await` and everything past it runs outside the hibernation. There is no runtime check, only the type.

## SignalGroup

```ts
const g = SignalGroup.findOrCreate(obj);   // throws on null; same instance per obj
SignalGroup.get(obj);                       // existing group or undefined
SignalGroup.delete(obj);                    // clear & remove — the preferred destructor; a group works as the argument too
SignalGroup.clear();                        // global reset
getSignalGroupsCount();

g.attachSignal(s);  g.attachSignalByName('n', s);  g.detachSignal(s);
                    // all three hand the argument back with its own type
g.signal<T>('n');   // walks the parent chain; without <T> it is Signal<unknown>
g.hasSignal('n');
g.attachEffect(e);  g.runEffects();  // e: the Effect from createEffect() or the impl;
                    // hands the argument back, throws on a destroyed one
g.attachLink(l);    g.detachLink(l);  // a destroyed link takes itself out of the group
g.attachGroup(child);  g.detachGroup(child);
g.off();            // destroy attached effects/links, drop external subs, KEEP signals — not an in-effect {attach} memo's
g.clear();          // full teardown
```

Binding a name transfers ownership: unless `attachSignal()` was called for the
signal too, the name is the group's only hold on it. Rebinding the name
(`attachSignalByName('n', other)`) therefore **destroys** the signal it
displaces, and `attachSignalByName('n')` without a signal releases the name the
same way. A signal that is also bound under another name survives; one that was
explicitly attached survives *and* stays group-owned, losing only the name.

`attachGroup()` throws when the edge would create a cycle: a group cannot be
attached to itself or to one of its own descendants. The recursive walks
(`hasSignal`, `signal`, `runEffects`, `off`, `clear`) additionally refuse to
re-enter a group they are already walking, so a `DESTROY` listener calling
`clear()` again is a no-op rather than a stack overflow.

The registry is a `WeakMap<object, SignalGroup>` and the back-pointer to the host object is a `WeakRef` — attaching a group does **not** keep the host object alive.

A group created against a host object is also registered with a `FinalizationRegistry`; if that object becomes unreachable without an explicit `SignalGroup.delete(obj)` / `group.clear()`, the callback runs `clear()`. Self-keyed groups (`object === this`) are not registered. FR timing is non-deterministic — see pitfall 16a.

## SignalAutoMap

```ts
const m = new SignalAutoMap();
const m2 = SignalAutoMap.fromProps({a: 1, b: 2}, ['a']);

m.get('k');                          // auto-creates Signal<undefined>
m.has('k');
m.update(new Map([['k', 'v']]));     // batched
m.updateFromProps(obj, ['k']);       // batched
for (const k of m.keys()) {}
for (const s of m.signals()) {}      // Signal<unknown>
for (const [k, s] of m.entries()) {} // [key, Signal<unknown>]
m.delete('k');                       // destroy that signal + drop the entry → boolean
m.clear();
```

The map subscribes to the destruction of every signal it creates: an entry
destroyed from the outside is evicted in the same synchronous turn, so
`has(key)` is `false`, `get(key)` hands out a fresh signal, and `delete(key)`
reports `false`. A soft detach (`SignalGroup#off()`) is not a destruction and
leaves the entry alone. A dropped map releases its per-entry subscriptions
through a `FinalizationRegistry`; it does not destroy the signals.

## Object signals

Signals stored on a host object and retrievable by property name — the mechanism behind the decorators.

```ts
findObjectSignalByName(obj, 'prop');   // Signal<T> | undefined
findObjectSignals(obj);                // Signal<unknown>[] | undefined
findObjectSignalNames(obj);            // (string | symbol)[] | undefined
destroyObjectSignals(obj1, obj2);      // signals only — full cleanup is SignalGroup.delete(obj)
```

## Decorators

```ts
class Foo {
  @signal({                     // `accessor` is REQUIRED
    name:        'count',       // override the registered name
    readAsValue: false,         // true → the property getter is .value (untracked)
    compare:     (a, b) => a === b,
    beforeRead:  () => {},
    attach:      something,     // an ADDITIONAL group; the instance group stays
  }) accessor count = 0;

  // derived values are plain memos attached to the instance group
  doubled = createMemo(() => this.count * 2, {attach: this});
  // dies with the parent effect if the instance is built inside an effect body
}
```

Every instance gets its own per-property signal. Cleanup: `SignalGroup.delete(instance)` for everything, or `destroyObjectSignals(instance)` for signals only. A decorated field holding a reference to the instance (e.g. `@signal() accessor self = this`) no longer blocks the `FinalizationRegistry` backstop — instance and group are collected together. An effect whose callback closure captures the instance still does, with or without a group; see pitfall 16a.

## Counters

```ts
getSignalsCount();  getEffectsCount();  getLinksCount();  getSignalGroupsCount();
```

`getSignalsCount()` and `getLinksCount()` self-correct once a dropped signal
or link is collected — they count what is reachable, not what was created,
and the moment they drop is neither observable nor forceable. Leak
assertions still need explicit teardown (pitfall 16a).
