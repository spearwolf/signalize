---
name: using-signalize
description: Use when code imports `@spearwolf/signalize` or `@spearwolf/signalize/decorators`, mentions `signalize`/`Signalize`, or when writing/reviewing fine-grained reactivity code with signals, effects, memos, links, SignalGroup, or the @signal/@memo decorators. Covers the API surface, the synchronous reactivity model, lifecycle bundles, lazy/eager memos, dynamic vs static effect deps, and the quirks LLMs most often get wrong.
---

# @spearwolf/signalize — Quick Reference

Synchronous, fine-grained reactivity. ESM-only, `sideEffects: false`, targets ES2023, runs on Node `>=24.13` or any modern browser. Built on `@spearwolf/eventize` (peer dep). Fully typed for TypeScript.

## Mental model

- Four primitives: **Signal** (reactive value) → **Effect** (auto-rerun) → **Memo** (cached derived signal) → **Link** (one-way data flow). **SignalGroup** owns lifecycles.
- Everything propagates **synchronously, inline**. `signal.set(x)` runs every dependent effect before returning. No scheduler, no microtask queue.
- Effects subscribe **on read** (`signal.get()`) within their callback; deps are recomputed every run unless static.
- Memos are signals driven internally by a high-priority (`1000`) effect, so they resolve before normal effects.

## Two entry points

```ts
import {/* core */} from '@spearwolf/signalize';
import {signal, memo} from '@spearwolf/signalize/decorators';
```

Decorators are TC39 standard form (no `experimentalDecorators`). Use the `accessor` keyword.

## Public API surface

```ts
// --- runtime values ---
// signals
createSignal, destroySignal, isSignal, muteSignal, unmuteSignal,
getSignalsCount, touch, value
// effects
createEffect, getEffectsCount, onCreateEffect, onDestroyEffect
// memos
createMemo
// links
link, unlink, getLinksCount
// context modes
batch, beQuiet, isQuiet, hibernate
// lifecycle / collections
SignalGroup, SignalAutoMap
// host-object signals
findObjectSignalByName, findObjectSignals, findObjectSignalNames, destroyObjectSignals
// classes (exported for `instanceof` and as types)
Signal, Effect

// --- type-only re-exports (no runtime value) ---
//   SignalReader, SignalWriter, SignalLike, SignalParams, SignalWriterParams,
//   EffectOptions, EffectCallback, CreateMemoOptions, LinkOptions,
//   SignalLink, ValueCallback, SignalAutoMapKeyType,
//   CompareFunc, BeforeReadFunc, VoidFunc, ValueChangedCallback
```

## Signals

```ts
const c = createSignal(0, {
  lazy:       false,            // true → initial is a factory, evaluated on first read
  compare:    (a, b) => a===b,  // custom equality (default ===)
  beforeRead: () => {},         // hook on tracked reads only (NOT on .value)
  attach:     obj,              // SignalGroup lifecycle
});

c.get();        // tracked read (registers dep when inside an effect)
c.value;        // untracked read
c.set(v);  c.value = v;
c.set(v, {touch: true});      // notify even if equal
c.set(fn, {lazy: true});      // factory, evaluated on next read
c.touch();  c.destroy();  c.muted = true;
const off = c.onChange(v => …);   // returns unsubscribe
```

Helpers: `value(c)` / `value([obj,'prop'])` (untracked), `touch(c)` / `touch([obj,'prop'])` (notify), `isSignal(x)`, `muteSignal(c)`, `unmuteSignal(c)`, `destroySignal(...sigs)`.

## Effects

```ts
createEffect(() => {
  use(c.get());
  return () => cleanup();
}, {
  autorun:      true,           // false → manual eff.run()
  dependencies: [c],            // STATIC deps → disables auto-tracking; does NOT autorun
  priority:     0,              // higher first
  attach:       obj,
});

createEffect(cb, [c]);                      // shorthand → static deps
createEffect(cb, ['name'], {attach: obj});  // names resolved against group

const eff = createEffect(cb, {autorun: false});
eff.run();    // runs only if a tracked dep changed since last run
eff.destroy();
```

`getEffectsCount()`, `onCreateEffect(cb) → unsub`, `onDestroyEffect(cb) → unsub`.

## Memos

```ts
const m = createMemo(() => a.get() * 2, {
  lazy:     false,    // true → recompute on read; effects DO NOT re-run on dep change
  priority: 1000,
  attach:   obj,
  name:     'm',
});
m();                  // SignalReader<T>
```

## Links

```ts
const con = link(src, target, {attach: obj});  // target: signal | (v) => void
unlink(src, target);  unlink(src);             // drop one or all
getLinksCount();  getLinksCount(src);

con.lastValue; con.isMuted; con.isDestroyed;
con.mute(); con.unmute(); con.toggleMute();
con.touch();  con.destroy();  con.attach(obj);

await con.nextValue();
for await (const v of con.asyncValues((v,i) => i>=5)) {/* … */}
```

Link emits eventize events on itself: `'value'`, `'mute'`, `'unmute'`, `'destroy'`.

## Context modes

```ts
batch(() => { a.set(1); b.set(2); });   // dedup + flush in priority order; HINT not guarantee
beQuiet(() => a.get());                 // reads untracked, writes silent (counter, nests)
hibernate(() => { /* outer ctx suspended */ });   // batches/quiet/effect-stack saved & restored
isQuiet();
```

`hibernate` flushes any active outer batch before running its callback so queued effects aren't lost.

## SignalGroup

```ts
const g = SignalGroup.findOrCreate(obj);  // throws on null; returns same instance for the same obj
SignalGroup.get(obj);                     // existing or undefined
SignalGroup.delete(obj);                  // clear & remove (preferred destructor)
SignalGroup.clear();                      // global

g.attachSignal(s); g.attachSignalByName('n', s); g.detachSignal(s);
g.signal('n');           // walks parent chain
g.hasSignal('n');
g.attachEffect(e); g.runEffects();
g.attachLink(l);   g.detachLink(l);
g.attachGroup(child); g.detachGroup(child);
g.clear();
```

Registry is `WeakMap<object, SignalGroup>`; back-pointer is `WeakRef`. Attaching a group to a user object **does not** keep it alive.

## SignalAutoMap

```ts
const m = new SignalAutoMap();
const m2 = SignalAutoMap.fromProps({a:1, b:2}, ['a']);
m.get('k');                              // auto-creates Signal<undefined>
m.has('k');
m.update(new Map([['k','v']]));          // batched
m.updateFromProps(obj, ['k']);           // batched
for (const k of m.keys()){} for (const s of m.signals()){} for (const [k,s] of m.entries()){}
m.clear();
```

## Object signals (used by decorators)

```ts
findObjectSignalByName(obj, 'prop');    // Signal<T> | undefined
findObjectSignals(obj);                  // Signal[] | undefined
findObjectSignalNames(obj);              // (string|symbol)[] | undefined
destroyObjectSignals(obj1, obj2);        // signals only — for full cleanup use SignalGroup.delete(obj)
```

## Decorators

```ts
class Foo {
  @signal({                       // accessor REQUIRED
    name:        'count',         // override registered name
    readAsValue: false,           // true → property getter is .value (untracked)
    compare:     (a,b)=>a===b,
    beforeRead:  () => {},
    attach:      something,       // override default group (the instance)
  }) accessor count = 0;

  @memo({name:'doubled'})         // ALWAYS lazy; attached to instance group
  doubled() { return this.count * 2; }
}
// Cleanup: SignalGroup.delete(instance)  -- or destroyObjectSignals(instance) for signals-only
```

Each instance gets its own per-property signal. `@memo` is always lazy — for an eager class memo use `createMemo()` directly.

## ⚠️ Quirks & pitfalls (LLMs commonly get these wrong)

1. **No React-style updater function.** `signal.set((v) => v+1)` stores the **function** as the value, it is not invoked. TypeScript blocks this for typed code; `any`/untyped paths slip through. Use `signal.set(signal.value + 1)`.

2. **`signal.get()` tracks, `signal.value` does not.** Top-level reactivity bug source: writing `c.value` inside an effect when you meant `c.get()` results in an effect that never re-runs.

3. **Static deps disable autorun AND auto-tracking.** `createEffect(cb, [a, b])` does NOT run on creation — call `.run()` once if you need the initial pass. Signals read inside the callback are NOT subscribed; only `[a,b]` trigger reruns. The same is true for `{dependencies: [...]}`.

4. **Lazy is not sticky.** `createSignal(fn, {lazy:true})` is lazy until first read. After a non-lazy `set(v)` the signal stays non-lazy. Pass `{lazy:true}` again to re-lazy. Likewise, calling `set(fn)` (without `{lazy:true}`) stores the function as the value.

5. **`createSignal(otherSignal)` is a passthrough.** It returns the existing signal — no new signal, no counter increment. Useful for "value or signal" helpers; do NOT assume it cloned.

6. **Memo eager vs lazy changes downstream behaviour.** Default `lazy:false` makes the memo a computed signal: dependent effects re-run on dep change. With `lazy:true`, dependent effects do NOT re-run on dep change; the memo is only recomputed on read. **`@memo()` is always lazy.**

7. **Synchronous self-write recursion is bounded.** If an effect callback writes to a signal it depends on, `run()` re-enters synchronously. Capped at `EffectImpl.maxDepth = 256`; beyond that throws a descriptive `Error` (not a stack overflow). Prefer breaking the cycle (`beQuiet` for self-writes, conditional guard, split effect). Tune `EffectImpl.maxDepth = N` only when intentional.

8. **`signalReader(callback)` is deprecated.** `sig.get(cb)` creates an internal effect with no unsubscribe handle — only destroying the signal cleans it up. Emits a once-per-process `console.warn`. Use `sig.onChange(cb)` (returns an unsubscribe).

9. **`batch()` is a HINT, not a guarantee.** Most flushes are deduplicated and priority-ordered, but internal consistency rules can still cause partial propagation. Don't rely on "exactly one effect run per batch" as a correctness invariant.

10. **`beforeRead` only fires on tracked reads.** Including `sig.get()` and the deprecated `sig.get(cb)` form. `.value` / `value(sig)` skip it. Don't use `beforeRead` for invariants you need on every observation.

11. **`set(v, {touch:true})` is suppressed on muted/destroyed signals.** Same for `signal.touch()`. If you need to force-emit on a muted signal, unmute first.

12. **Nested effects are recreated on every parent rerun.** Order on a re-run: parent's own cleanup → child effects destroyed (each child's cleanup runs as part of its destroy) → parent callback re-executes → fresh inner effects created. Don't capture the inner `Effect` handle in long-lived state.

13. **Dynamic deps can shrink between runs.** Signals read in run N but not in run N+1 are unsubscribed at the end of run N+1. Conditional `if (a.get()) b.get()` is fine — that's the whole point of dynamic tracking.

14. **`SignalGroup.findOrCreate(group)` returns the group itself.** Passing an existing `SignalGroup` is a no-op identity. `findOrCreate(null)` throws.

15. **`SignalGroup.delete(obj)` ≠ `g.clear()`.** They both clear; the static form also looks the group up by the user object first. The instance method `destroy()` is deprecated and warns — use `clear()`.

16. **Same `(source, target)` pair? `link()` returns the existing link.** It is deduplicated; do not assume each call creates a new SignalLink. The link is auto-destroyed when source OR (signal-)target is destroyed.

17. **`SignalAutoMap` retains destroyed signals.** If you call `destroySignal()` on an entry, the map keeps it: reads return last value, writes are silent no-ops. Prefer `map.clear()` or attach signals to a SignalGroup.

18. **Decorator memos have their own group.** `@signal` and `@memo` register against `SignalGroup.findOrCreate(this)`. Cleanup with `SignalGroup.delete(this)` (full) or `destroyObjectSignals(this)` (signals only — leaves attached effects/links alive).

19. **In-source imports use `.js` extension** (NodeNext resolution): `import {x} from './foo.js'` even when the source is `foo.ts`. This affects code you write *inside* the package; consumers don't care.

20. **No async by default.** Effect callbacks may be async, and a returned cleanup will be called when the promise settles, but propagation itself is synchronous. There is no `microtask` debounce — write your own if needed.

## Idiomatic patterns

### Lifecycle-bundled component

```ts
class Player {
  health = createSignal(100, {attach: this});
  pos    = createSignal({x:0,y:0}, {attach: this});

  constructor() {
    createEffect(() => render(this.pos.get()), {attach: this});
    link(this.health, (v) => v <= 0 && this.die(), {attach: this});
  }
  destroy() { SignalGroup.delete(this); }   // tears down signals + effects + links
}
```

### Frame-paced effect

```ts
const eff = createEffect(render, {autorun: false});
const tick = () => { updateState(); eff.run(); requestAnimationFrame(tick); };
requestAnimationFrame(tick);
```

### Computed in a chain

```ts
const items = createSignal<Item[]>([]);
const visible = createMemo(() => items.get().filter(x => x.visible));   // eager
const count   = createMemo(() => visible().length);                      // eager, depends on memo
createEffect(() => render(count()));   // re-runs when count() changes
```

### Decorator class with eager memo

```ts
class Cart {
  @signal() accessor items: Item[] = [];

  // Eager — must use createMemo because @memo is always lazy
  total = createMemo(() => this.items.reduce((s, x) => s + x.price, 0), {attach: this});

  destroy() { SignalGroup.delete(this); }
}
```

### Leak check in tests

```ts
const baseline = [getSignalsCount(), getEffectsCount(), getLinksCount()];
// run scenario, destroy/clear
expect([getSignalsCount(), getEffectsCount(), getLinksCount()]).toEqual(baseline);
```

## When NOT to reach for signalize

- You need cross-process or async-by-default state → use a real state store / message bus.
- You need built-in time travel / undo / devtools → pick a state library that ships them.
- One-off "callback when X changes" with no graph of derivations → `signal.onChange(cb)` is fine, but consider plain eventize.

## Anti-patterns to refuse / rewrite

- `signal.set(prev => prev + 1)` — not an updater. Rewrite as `signal.set(signal.value + 1)`.
- `signal.get(callback)` for subscriptions — deprecated. Rewrite as `signal.onChange(callback)`.
- `createSignal(...).value = …` immediately followed by `createEffect(() => …signal.value…)` — effect won't track. Use `signal.get()`.
- `createEffect(cb, [a])` without a follow-up `.run()` when an initial pass is needed.
- Manually re-implementing memo with `createEffect` writing to a signal — use `createMemo` (priority + cache for free).
- `tsconfig.json` with `experimentalDecorators: true` for the `@signal`/`@memo` decorators — they require the standard form.
- Forgetting to destroy effects/links — track via `SignalGroup` from the start, not retroactively.
