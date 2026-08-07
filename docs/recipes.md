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

No effect is notified when:

- The new value compares equal to the current value (use `compare` to widen
  equality, e.g. structural compare for arrays). Here `set` really is a no-op:
  the stored value doesn't change either.
- The signal is muted (`muteSignal` / `signal.muted = true`) or destroyed. The
  write itself still happens — only the notification is suppressed.

That second case is not a no-op:

```ts
const sig = createSignal(1);
muteSignal(sig);

sig.set(2);        // no effect runs ...
sig.value;         // → 2   ... but the value is stored
sig.get();         // → 2
```

The same holds for a destroyed signal — it degrades to a plain value container,
`set()`/`get()` keep working, nothing is ever notified again. And
`set(fn, {lazy: true})` on a muted signal installs the factory as usual; it is
evaluated on the next read.

To force a notification, use `set(v, {touch: true})` or `signal.touch()`. Both
are suppressed on muted and destroyed signals.

Unmuting does not replay what happened while muted:

```ts
unmuteSignal(sig);
sig.set(2);        // compares equal to the stored 2 → still silent
sig.touch();       // → effects run with 2
```

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

They do **not** disable the effect context. The callback still runs as the
current effect, so an effect created inside it (directly, or through
`Signal.onChange()`) becomes a child effect and is destroyed before the next
rerun and on `destroy()` — same as under dynamic deps. Only subscribe-on-read
is suppressed. Use `hibernate()` around the creation if an inner effect is
meant to outlive its parent.

`createMemo()` in an effect body follows the same child-effect rule for its
internal effect: it is a child and dies with the parent, so the memo stops
recomputing. Its signal dies right along with it, with or without `{attach}`
— a memo handle that escapes such a callback reads a destroyed signal, still
usable since destroyed signals keep handing out the last value they held, so
it reads as a frozen constant. `{attach}` gives the signal a group membership
and, optionally, a name; it does not take the signal out of the creating
effect's ownership, so it dies on the same rerun the effect does, same as an
unattached one. `{attach}` is not an escape hatch for a live memo — it no
longer even saves the last value; `hibernate()` around the creation is the
only way to keep the memo itself recomputing past the parent's rerun.

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
- Nested effects are destroyed (with their cleanup) before the parent re-runs —
  regardless of whether the parent uses dynamic or static deps.
- Nested effects are never reused across reruns: every parent run builds a
  fresh set. Do not stash an inner `Effect` handle in long-lived state.
- On `destroy()` the effect is already marked destroyed and unsubscribed when
  the cleanup runs. A cleanup that resets a signal the effect depends on
  therefore triggers no final run — and no cleanup gets stranded.
- An effect that writes a signal it depends on re-enters `run()`, and every
  nested run gets its own cleanup. Such a cleanup does not run as the *next*
  one: it runs the moment the next run overtakes it. Same rule as the `async`
  case two sections down, minus the timing blur — here the moment is exact and
  synchronous.

### `async` callbacks: the cleanup runs late

An `async` callback returns a promise, so its cleanup function only exists once
that promise settles. The library never waits for it — reactivity stays
synchronous. Instead each run carries a generation number, and when the promise
settles for a run that has since been superseded or destroyed, the cleanup
still runs — it is simply run right then, instead of being stored as the
*next* cleanup.

```ts
createEffect(async () => {
  const socket = await connect();       // run N
  return () => socket.close();          // runs once this promise settles,
                                         // whether or not run N is still current
});
```

> ⚠️ **The timing is unbound, not the release.** Nothing awaits the promise, so
> a superseded run's cleanup can fire anywhere between "immediately" and "long
> after the next run has already acquired its own resource" — there is no
> guarantee the two don't briefly overlap. If you need the release to happen
> synchronously, in step with the run it replaces, acquire the resource before
> the first `await`, or tie it to an `AbortController` you abort from a
> synchronous cleanup.

```ts
createEffect(() => {
  const ctrl = new AbortController();   // synchronous acquire
  void (async () => {
    const res = await fetch(url, {signal: ctrl.signal});
    // ...
  })();
  return () => ctrl.abort();            // synchronous release, never dropped
});
```

- A rejecting `async` callback (or `async` cleanup) is not left as an unhandled
  rejection. It goes to `onEffectError(cb)`, or to `console.error` while no
  handler is registered. See [api.md](./api.md#top-level-helpers).
- The handler must be synchronous or catch its own errors — nothing awaits it,
  so an `async` handler whose own promise rejects lands back at square one:

  ```ts
  onEffectError(async ({error}) => { await report(error); });        // ✗
  onEffectError(({error}) => { void report(error).catch(ignore); }); // ✓
  ```

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

## When an effect callback throws

A synchronous throw out of an effect callback used to end the whole fan-out:
every effect behind the failing one was skipped and never learned that the
value had changed. It is isolated now — all of them run, and the write throws
afterwards.

```ts
const sig = createSignal(0);

createEffect(() => {
  sig.get();
  throw new Error('a failed');
}, {priority: 10});

createEffect(() => console.log('b sees', sig.get()), {priority: 5});
createEffect(() => console.log('c sees', sig.get()), {priority: 1});

try {
  sig.set(1);          // logs "b sees 1", "c sees 1"
} catch (err) {
  err.message;         // 'a failed' — a single failure arrives unchanged
}
```

- Several failures of the same write come as an `AggregateError`. `err.errors`
  holds one entry per failing effect of *that* delivery, in delivery order —
  it is not flattened: an effect that let a nested write's `AggregateError`
  through contributes that whole object as its single entry. Recurse if you
  want to count leaves.
- The failing effect stays usable — it keeps its dependencies and runs again
  on the next change.
- A **nested** write has its own pot: if an effect callback writes another
  signal, the failures of *that* delivery are thrown at the inner `set()`,
  inside the callback. Let them through and they come back as that effect's
  own failure, once.
- A throwing `link()` callback is **not** an effect and does end the delivery.
  The failures collected before it are re-raised together with it.
- This does **not** go through `onEffectError()`. That channel is for
  failures with no caller left to throw at — async rejections and stale
  cleanups. Here the write is the caller, so catch at the write.

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

> For a class-bound memo, call `createMemo(..., {attach: this})` in the class
> body — there is no memo decorator.

## Memos: `batchWrites` is opt-in, and reading a composed memo is why

A memo's recompute writes its signal directly — no `batch()` involved. Turn
that on with `{batchWrites: true}` only if the memo's `computer` itself
writes to *other* signals as a side effect (uncommon; `computer` is meant to
read and return):

```ts
const source = createSignal(0);
const flag = createSignal('idle');

const doubled = createMemo(
  () => {
    const v = source.get();
    flag.set(v > 0 ? 'touched' : 'idle');   // side effect
    return v * 2;
  },
  {batchWrites: true},                      // groups both writes together
);
```

Without `batchWrites`, a downstream effect depending on both `doubled` and
`flag` sees two separate runs — the first with `flag` already updated but
`doubled` still at its old value. `batchWrites: true` restores the old
one-run grouping, at a cost: **any** effect run is deferred while a batch is
open, including another memo's recompute triggered by reading it inside the
callback. Reading a *composed* memo — a normal pattern — from inside a
`batchWrites: true` callback can therefore return that memo's stale,
pre-recompute value:

```ts
const source = createSignal(0);
const inner = createMemo(() => source.get() * 10, {lazy: true});

const outer = createMemo(
  () => source.get() + inner(),   // reads a composed memo
  {batchWrites: true},
);
```

If `inner` is dirty when `outer` recomputes, its deferred run inside
`outer`'s batch is a no-op for a `{lazy: true}` memo specifically — `[RECALL]`
only marks a lazy memo dirty, it never calls `run()` for it — so `outer`
keeps reading `inner`'s stale value until something else reads `inner`
directly, outside any batch. This is why the default is `false`: composed
memos are the common case, side-effect-writing callbacks are not.

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
- An effect that throws during the flush does not end it — the remaining
  delayed effects still run, and the failure reaches the `batch()` caller
  afterwards.
- `batch()` is a hint, not a guarantee — internal consistency may still
  cause partial propagation.
- `batch()`'s callback must be synchronous. An `async` callback stops being
  batched at its first `await` — everything before that point still runs
  batched, everything after runs completely unbatched, with no error. To
  catch this, `batch()` throws `TypeError` if the callback returns a
  thenable, and its signature rejects `async` callbacks at `tsc` time
  (ASYNC-003):

  ```ts
  batch(async () => {
    first.set('Grace');
    await something();       // ← batching already ended here
    last.set('Hopper');      // ← runs unbatched
  });
  // TypeError: [signalize] batch: callback must be synchronous, ...
  ```

  This is a synchronous throw at the `batch()` call site — different from an
  async *effect* callback's rejection, which cannot be thrown at any caller
  and goes to `onEffectError()` instead (see the Effects section).

## Quiet reads

```ts
createEffect(() => {
  const trigger = a.get();             // tracked
  const peek = beQuiet(() => b.get()); // untracked: this effect won't re-run on b changes
});
```

Inside `beQuiet()`, all reads are untracked **and** all writes are silent.
Counter-based, so it nests. Wrapping a single read drops that signal from the
set, as above; wrapping a **whole run** changes no dependency set at all — an
`eff.run()` executed inside the frame keeps its dependencies, while an effect
*created* inside it never gets any. The frame has to sit around `run()` for
that: a callback wrapping its own whole body is a tracked run that reads
nothing and loses every dependency.

The frame hands back whatever the callback returns, same as `hibernate()` —
that's what makes `peek` above usable. An `async` callback is rejected by the
type, because the quiet zone closes at the first `await`.

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
- A `FinalizationRegistry` runs `clear()` on the orphaned group when the user
  object is GC'd — **but only if no strong reference path from the group back
  to the object exists**. An attached signal whose value holds a reference to
  the object, or an effect whose callback closure captures it, creates such a
  path and prevents the callback from firing. Explicit `SignalGroup.delete(this)`
  or `group.clear()` remains the reliable pattern; the registry is best-effort,
  non-deterministic.
- Use `SignalGroup.findOrCreate(this).attachGroup(child)` to nest scopes.

## Pausing a SignalGroup without destroying it (`off()`)

`clear()` is destructive — it destroys the attached signals too. When you want
to keep the signal identities and just rip out the subscriptions (e.g. to
re-wire effects, swap renderers, pause a component), use `off()`:

```ts
const g = SignalGroup.findOrCreate(component);
const count = createSignal(0, {attach: component});

createEffect(() => render(count.get()), {attach: component});

g.off();
// effect is destroyed (its cleanup ran);
// `count` is still alive — `count.value`, `count.set(...)` keep working.

createEffect(() => analytics(count.get()), {attach: component});
// fresh subscription on the same signal.
```

Semantics:

- All effects/links attached to the group are destroyed (their cleanup
  callbacks run).
- External effects/links subscribed to group signals lose their subscription.
  An external effect is destroyed automatically (cleanup runs) as soon as no
  live dependency is left — regardless of whether some of its other
  dependencies were hard-destroyed (via `signal.destroy()`) before this
  `off()` call. One with a live dependency outside the group survives, and its
  **next run** re-subscribes to the group signal — a dynamic effect by reading
  it again, a static-deps effect by re-declaring its `dependencies`. Until that
  run it stays deaf to the detached signal; that is what makes `off()` a pause
  rather than a cut. A dependency that was destroyed in the meantime (not just
  detached) does not come back in either case.
- Signals stay alive, retain their values, and remain reachable by name —
  except a memo signal created with `{attach}` inside an effect body: it
  belongs to that effect, not to the group, and is destroyed along with it
  when `off()` tears down the group's effects, losing its name too.
- Child groups are `off()`'d recursively.
- The group emits an `OFF` event and remains registered — new attaches work
  immediately. Idempotent.

## Named signals & parent lookup

```ts
const root = SignalGroup.findOrCreate({});
root.attachSignalByName('theme', createSignal('dark'));

const child = SignalGroup.findOrCreate({});
root.attachGroup(child);

child.signal('theme');     // → falls through to root's 'theme'
```

Named lookup walks the parent chain.

### Binding a name transfers ownership

Unless you also call `attachSignal()`, the name is the group's *only* hold on
the signal. Rebinding the name — the swap-a-slot case — therefore destroys the
signal it displaces:

```ts
root.attachSignalByName('theme', createSignal('light'));  // the old one is destroyed
root.attachSignalByName('theme');                         // so is this one
```

Two exemptions: a signal still bound under another name stays alive, and a
signal that was additionally handed to `attachSignal()` stays alive *and*
group-owned — it only loses the name, and `clear()` still destroys it.

Keep a signal past a rebind by attaching it explicitly **to the same group**:

```ts
root.attachSignal(mine);
root.attachSignalByName('theme', mine);
root.attachSignalByName('theme', other);   // `mine` survives
```

The exemption is group-local, and destruction is not: a signal owned by group A
carries no protection into group B. Give B a name for it and B's next rebind
destroys it globally — A keeps a dead signal it still believes it owns. This is
reachable whenever a signal is created against one group and named in another:

```ts
const s = createSignal(0, {attach: componentA});   // A owns it
SignalGroup.findOrCreate(componentB)
  .attachSignalByName('shared', s);                 // B may now destroy it
```

Do not register a foreign-owned signal under a name in a second group. Reach it
through the owning group, or hand the second group its own signal and `link()`
the two.

That is also the only case in which the `detachSignal()` fallback still fires:
detaching the active signal of a name reverts to the most recently attached
remaining candidate, and after the pruning above the only candidates left are
explicitly attached signals. It is a corner, not the normal course.

### Cycles

`attachGroup()` refuses to close a cycle: attaching a group to itself, or to
one of its own descendants, throws.

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
- **Held until torn down, not until unreachable.** A link lives in a registry
  keyed on its source until `destroy()`, `unlink()`, a cleared `{attach}`
  group, or the destruction of source/target — dropping the reference you got
  back from `link()` does not shorten that. Calling `link(src, freshCallback)`
  in a loop without ever `unlink()`ing the old ones accumulates every one of
  them for as long as `src` lives; `getLinksCount(src)` is the number to
  watch.
- Repeated `link()` calls with different `attach` groups don't replace or drop
  the extra attach — the existing link is attached to *every* group it was
  ever `link()`'d or `.attach()`'d with, and dies with whichever one clears
  first:

  ```ts
  const l1 = link(inA, outB, {attach: componentA});
  const l2 = link(inA, outB, {attach: componentB}); // same link, now attached twice
  l1 === l2; // true

  SignalGroup.delete(componentA); // l1/l2 is destroyed here already,
  SignalGroup.delete(componentB); // this is a no-op on an already-dead link
  ```

- `nextValue()` and `asyncValues()` integrate with `for await` loops; useful
  for testing and for one-shot waits. Both take an optional `{signal}`
  (`AbortSignal`) to cancel the wait without destroying the link. `nextValue()`
  rejects with an `Error` — not `undefined` — if the link is destroyed first,
  and with the signal's `reason` if aborted first. `asyncValues()` treats the
  two differently: the link being destroyed ends its loop quietly, same as
  `stop(value, i) → true`, but an abort **throws** the reason out of the
  `for await` instead — a cancellation the caller asked for should not look
  like a normal stop.
- `asyncValues()` retains only the most recent value; a slow consumer misses
  whatever arrived between two of its reads. Running several `asyncValues()`
  iterators over the same link is fine — they share that one retained slot,
  and it's cleared only once the last iterator stops, so an early-finishing
  one doesn't starve the others.
- "Take the first value, then `destroy()`" is a supported move from inside the
  link callback: the `set()` that started the delivery returns normally, the
  other links on the same source are still served, and `lastValue` stays
  `undefined`. A feedback write is handled the same way round — if the callback
  (or an effect on the target signal) writes the source again, the nested
  propagation wins and the outer one drops its now-stale value instead of
  announcing it after the newer one.

## SignalAutoMap with destroyed entries

```ts
const map = new SignalAutoMap();
const s = map.get('foo');
s.set(42);
destroySignal(s);

map.get('foo').value;       // 42 (last value, the destroyed signal stays cached)
map.get('foo').set(99);     // stores 99, notifies nobody (signal is destroyed)
```

Individual entries are removed with `map.delete('foo')`: it destroys the
signal and drops the entry in one step, unlike a `destroySignal()` from the
outside, which leaves the corpse cached as shown above.

```ts
map.delete('foo'); // true — signal destroyed, entry gone
```

`clear()` is still the way to tear down everything at once. Deleting an
entry that was an effect's only live dependency destroys that effect too.

`delete(key)` drops the entry *before* destroying the signal, on purpose: if
an effect cleanup runs as part of that destroy and calls `get(key)` again,
it gets a fresh, live signal — not the corpse. That signal stays in the map,
so `has(key)` is `true` again once `delete()` has already returned.

## Decorator quirks

- `@signal()` requires the `accessor` keyword.
- Each instance gets its own signal; reading the property uses `.get()`
  (tracked) by default. Use `readAsValue: true` for an untracked getter.
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
Links need their own explicit `unlink(source)` (or `link.destroy()`) before
that final `getLinksCount()` — a link on a still-live source is not reclaimed
by dropping references alone.

## Migrating off `signalReader(callback)`

```ts
// Deprecated — no unsubscribe handle:
sig.get((value) => onChange(value));

// Replacement:
const unsub = sig.onChange((value) => onChange(value));
// ...
unsub();
```
