# Recipes & quirks

Patterns, gotchas, and details that aren't obvious from the type signatures.

## Reading: tracked vs untracked

```ts
createEffect(() => {
  const a = sig.get();    // tracked — re-runs when sig changes
  const b = sig.value;    // untracked — read once, no subscription
  const c = value(sig);   // untracked — equivalent to .value
});
```

`beforeRead` (a `createSignal` option) fires only on tracked reads, including
the deprecated `signal.get(callback)` form. `.value` does not trigger it.

## Writes that don't notify

`set` is a no-op when:

- The new value compares equal to the current value (use `compare` to widen
  equality, e.g. structural compare for arrays).
- The signal is muted (`muteSignal` / `signal.muted = true`) or destroyed.

To force a notification anyway, use `set(v, {touch: true})` or
`signal.touch()`. `{touch: true}` is also suppressed on muted/destroyed signals.

## Lazy signals

```ts
const cfg = createSignal(() => loadConfig(), {lazy: true});
cfg.get();   // first read — runs loadConfig() and caches the result
cfg.get();   // cached — loadConfig() is not called again
```

Quirks:

- **Laziness is not sticky.** Once written with a non-lazy `set(value)`, the
  signal stays non-lazy. To re-lazy, call `set(fn, {lazy: true})`.
- **`set(fn)` without `{lazy: true}` stores the function as the value.** It is
  not invoked. (TypeScript prevents this for typed code; with `any` you can
  shoot yourself in the foot.)

## `createSignal(otherSignal)` is a passthrough

Passing an existing signal-like to `createSignal` returns that same signal. No
new signal is created, no counter increment. Useful in helper functions that
accept "value or signal".

## Effects: dynamic vs static deps

| Form                                       | Tracking          | Auto-runs on creation? |
| ------------------------------------------ | ----------------- | ---------------------- |
| `createEffect(cb)`                         | Dynamic           | Yes                    |
| `createEffect(cb, {dependencies: [...]})`  | **Static only**   | **No** — call `.run()` once |
| `createEffect(cb, [...])`                  | Static (shorthand)| **No**                 |
| `createEffect(cb, {autorun: false})`       | Dynamic           | No                     |

Static deps **disable** dynamic tracking entirely — signals read inside the
callback do not subscribe.

When `attach` is set, static deps may be names (`string | symbol`); they are
resolved against the attached group.

```ts
class Foo {
  @signal() accessor a = 1;
  @signal() accessor b = 2;
  constructor() {
    createEffect(() => console.log(this.a, this.b), ['a', 'b'], {attach: this}).run();
  }
}
```

## Effects: cleanup

```ts
createEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);     // cleanup
});
```

- Cleanup runs **before** the next execution and on `destroy()`.
- For `async` callbacks: when the returned promise resolves to a function,
  that function is called (the next run won't wait for it).
- Nested effects are destroyed (with their cleanup) before the parent re-runs.

## Lazy effects (`autorun: false`)

```ts
const eff = createEffect(render, {autorun: false});

// Game loop / rAF / timer
requestAnimationFrame(function loop() {
  updateState();           // signal writes
  eff.run();               // runs only if a tracked signal actually changed
  requestAnimationFrame(loop);
});
```

- Tracking still works the normal way; only the timing changes.
- `eff.run()` inside a `batch()` defers the run until the batch ends.
- `eff.run()` after `eff.destroy()` is a silent no-op.

## Priority

Higher priority runs first when a single signal change fans out. Default is
`0` for effects, `1000` for memos. Use it sparingly — usually the
memo→effect ordering is enough.

```ts
createEffect(logA, {priority: 100});   // first
createEffect(logB, {priority: 0});     // second
```

## Recursion guard

If an effect callback writes to a signal it depends on, `run()` re-enters
itself synchronously. Tolerated up to `EffectImpl.maxDepth = 256` levels;
beyond that, it throws:

```
[signalize] Effect Symbol(ef…) exceeded maxDepth=256: an effect callback
recursively re-triggered itself (likely by writing a signal it depends on).
Break the cycle, or raise EffectImpl.maxDepth if the recursion is intentional.
```

Prefer breaking the cycle — guard the write, use `beQuiet()` for self-writes,
or split the effect.

## Memos: lazy vs eager

```ts
const a = createSignal(1);

// Eager (default): recomputes on dep change → effects observing it re-run.
const eager = createMemo(() => a.get() * 2);

// Lazy: recomputes on read → effects observing it DO NOT re-run on a.set(...).
const lazy  = createMemo(() => a.get() * 2, {lazy: true});
```

Use eager when effects depend on the memo, lazy for expensive on-demand
calculations.

> The `@memo()` decorator always produces lazy memos. Use `createMemo()` for
> eager class-bound memos.

## Batching

```ts
batch(() => {
  first.set('Grace');
  last.set('Hopper');
  // No effects have run yet.
});
// Effects run once each, in descending priority order.
```

- Batches nest. Only the outermost flush runs.
- `effect.run()` inside a batch queues the run.
- `batch()` is a hint, not a guarantee — internal consistency may still
  cause partial propagation.

## Quiet reads

```ts
createEffect(() => {
  const trigger = a.get();             // tracked
  const peek = beQuiet(() => b.get()); // untracked: this effect won't re-run on b changes
});
```

Inside `beQuiet()`, all reads are untracked **and** all writes are silent.
Counter-based, so it nests.

## Hibernate

```ts
createEffect(() => {
  // Inside an outer effect.
  hibernate(() => {
    // Outer effect's tracking is suspended for this block.
    // You can still create new effects/batches; they work normally.
    batch(() => {
      foo.set(1);
      bar.set(2);
    });
  });
});
```

Use cases: third-party callbacks executing inside a tracked effect, library
internals that must not leak dependencies into the caller's context, manual
event handlers triggered during a render pass.

## Lifecycle with SignalGroup

```ts
class Player {
  health = createSignal(100, {attach: this});

  constructor() {
    createEffect(() => render(this.health.get()), {attach: this});
    link(this.health, (v) => v <= 0 && this.die(), {attach: this});
  }

  destroy() {
    SignalGroup.delete(this);  // → all attached signals/effects/links destroyed
  }
}
```

- The group is created lazily on first `attach`.
- `WeakMap` registry: the group does not keep `this` alive; once `this` is
  unreachable, the registry slot can be reclaimed.
- Use `SignalGroup.findOrCreate(this).attachGroup(child)` to nest scopes.

## Named signals & parent lookup

```ts
const root = SignalGroup.findOrCreate({});
root.attachSignalByName('theme', createSignal('dark'));

const child = SignalGroup.findOrCreate({});
root.attachGroup(child);

child.signal('theme');     // → falls through to root's 'theme'
```

Named lookup walks the parent chain. `attachSignalByName(name, undefined)`
drops the name binding only.

## Links: data flow

```ts
const inA  = createSignal(0);
const outB = createSignal(0);
link(inA, outB);            // outB now mirrors inA, immediately

const log = link(inA, (v) => console.log('A:', v));
log.mute();                 // pause without unsubscribing
log.unmute();
```

- Same `(source, target)` pair? Repeated `link()` calls return the existing link.
- Destroyed when the source or target signal is destroyed.
- `nextValue()` and `asyncValues()` integrate with `for await` loops; useful
  for testing and for one-shot waits.

## SignalAutoMap with destroyed entries

```ts
const map = new SignalAutoMap();
const s = map.get('foo');
s.set(42);
destroySignal(s);

map.get('foo').value;       // 42 (last value, the destroyed signal stays cached)
map.get('foo').set(99);     // silent no-op (signal is destroyed)
```

Always `clear()` the map (or attach all signals to a `SignalGroup`) instead
of destroying entries individually.

## Decorator quirks

- `@signal()` requires the `accessor` keyword.
- Each instance gets its own signal; reading the property uses `.get()`
  (tracked) by default. Use `readAsValue: true` for an untracked getter.
- `@memo()` decorated methods are lazy and attached to the instance's group.
- `destroyObjectSignals(instance)` cleans up signals registered via the
  decorator; for full cleanup including effects/links, use
  `SignalGroup.delete(instance)`.

## Leak detection

```ts
import {getSignalsCount, getEffectsCount, getLinksCount} from '@spearwolf/signalize';

const before = [getSignalsCount(), getEffectsCount(), getLinksCount()];
// ... run scenario, then destroy/clear
const after  = [getSignalsCount(), getEffectsCount(), getLinksCount()];
expect(after).toEqual(before);
```

In tests, this is the cheapest sanity check that a feature doesn't leak.

## Migrating off `signalReader(callback)`

```ts
// Deprecated — no unsubscribe handle:
sig.get((value) => onChange(value));

// Replacement:
const unsub = sig.onChange((value) => onChange(value));
// ...
unsub();
```
