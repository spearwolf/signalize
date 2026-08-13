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

`beforeRead` (a `createSignal` option) fires on every read that goes through
the reader — `sig.get()`, the value `sig.onChange(cb)` hands its callback,
and the deprecated `signal.get(callback)` form — whether that read is
tracked or not: a `get()` inside `beQuiet()` or
`hibernate()` still triggers it, because those suppress the subscription, not
the hook. What skips it is bypassing the reader: `.value`, `value(sig)` and a
`@signal({readAsValue: true})` accessor. A destroyed signal fires nothing.

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
  not invoked. The compiler rejects that call outright — a factory has no
  overload without `{lazy: true}` — so the behaviour described here is
  reachable only from untyped JS or through `any`.
- **`{lazy: true}` has to be visible at the call site.** A params *variable*
  typed `SignalParams<T>`/`SignalWriterParams<T>` says `lazy?: boolean`, which
  is not enough for the factory branch: `const p: SignalParams<number> =
  {lazy: true}; createSignal(fn, p)` reports `TS2769`. Use the literal,
  `{lazy: true} as const`, or annotate `SignalParams<T> & {lazy: true}` —
  spreading (`{...p}`) does not help. A fourth spelling qualifies without
  looking like one: `{lazy: flag}` where control flow has narrowed `flag` to
  `true`, as a `const flag: boolean = true` does. A params *variable* of those
  types stays welcome on the value branch of both — `createSignal(v, p)` and
  `set(v, p)` compile, whatever `p` holds at runtime. What both turn away
  there is every one of those four statically-`true` forms: on a plain value
  each is `TS2769`, because the flag promises a factory and a value is not
  one. `createSignal(5, {lazy: true})` used to compile and leave the first
  read to die with `TypeError: this.valueFn is not a function`; now it does
  not compile. `createSignal(existingSignal, {lazy: true})` goes the same way,
  and the passthrough drops the rest of its params too — not in silence:
  every such call reports the dropped options through
  `onSignalizeError()`. So does `createSignal(undefined, {lazy: true})` —
  `undefined` is the one value that reaches the no-initial-value overload, so
  that overload carries the same conditions; under `strictNullChecks: false`
  this particular form instead lands on the factory overload, where
  `undefined` passes for a factory.
- **Both constructors name their options exactly.** An undeclared key is
  forbidden in the signature, not merely caught by freshness, so a variable is
  caught as readily as a literal: `createSignal(5, myOpts)` and `set(5,
  myOpts)` with `interface MyOpts extends SignalParams<number> {label:
  string}` are both errors. That exactness is what keeps `set(5, {lasy:
  true})` and `createSignal(5, {lasy: true, compare})` errors, and the price
  is one rule rather than a tally. The clause tests the key set of the params
  type the compiler infers, so what a call gets depends on what that inference
  produces — three outcomes:
  1. **It resolves to a concrete key set** → `TS2769` if that set holds a key
     the published options type does not declare, required or optional,
     declared or inferred. Sharing keys with the options is not the deciding
     factor: a *pattern* index key such as `data-${string}` survives `Exclude`
     whole, so its entire key set counts as beyond and it is refused although
     it shares nothing. Shapes that land here: an interface extending the
     params type, a variable with an inferred stray key, an unrelated type
     with an *optional* stray key, an intersection, a class instance with an
     extra field, the rest object of a destructuring that kept a valid key,
     and that pattern index key.
  2. **It resolves to nothing testable** → refused outright, with no stray key
     in sight. That is a bare type parameter, which is what a wrapper generic
     in its own params hands over (`<Q extends SignalParams<T>>(q: Q) =>
     createSignal(v, q)`): `keyof Q` is unknown, the conditional stays
     deferred, and nothing is assignable to a deferred conditional.
  3. **It never gets that far**, because the argument fails the constraint →
     inference falls back to the published options type, the clause goes
     vacuous, and the call compiles. For an all-optional options type that is
     a params type with no key in common *and* no index signature.

  The repair for the first two is always the same: name the params type —
  annotate the variable `SignalParams<T>`/`SignalWriterParams<T>` or assert it
  at the call, and for the wrapper type the argument by the published name
  instead of constraining a type parameter. A spread repairs none of them. A
  params object with a plain `string`, `number` or `symbol` index signature
  (`Record<string, unknown>` and the two others) is exempt from the first
  outcome — only the pattern key is not.
- **The third outcome is a loss, and it is silent.** `{label: string}`,
  `{a: number; b: string}`, the rest object of a destructuring with no valid
  key left: TypeScript's weak-type check (`has no properties in common with`)
  used to refuse exactly that shape, and generic params lose it, because an
  intersection is never weak. A disjoint object *literal* is still an error
  through freshness; a disjoint *variable* now compiles and does nothing at
  runtime. `set()` lost this when its value overload turned generic,
  `createSignal` loses it here — so an options object built entirely from
  foreign keys is one of the mistakes neither constructor catches any more.
  It has company two bullets down: the type-argument gap and, under
  `strictNullChecks: false`, the no-value form of the lazy flag.
- **On `createSignal`, naming the type argument switches both params
  conditions off.** `createSignal<number>(5, {lazy: true})` compiles,
  `createSignal(5, {lazy: true})` does not. TypeScript has no partial type
  argument inference, so naming `T` makes the params type parameter fall back
  to its default instead of being inferred — and what was never inferred
  carries nothing to test. Drop the type argument; the value infers it. Typos
  are still caught either way (`createSignal<number>(5, {lasy: true})` is an
  error), and `set()` has no such gap.

## `createSignal(otherSignal)` is a passthrough

Passing an existing signal-like to `createSignal` returns that same signal. No
new signal is created, no counter increment. Useful in helper functions that
accept "value or signal".

Nothing in `params` configures the signal that comes back, because no new
signal is made for it to configure — `attach` is the one exception, since it
is applied behind the `isSignal()` branch and belongs to both paths equally.
`lazy`, `compare` and `beforeRead` are simply dropped. Every call that passes
one of those three reports it through `onSignalizeError()` with `source:
'ignored-option'` and `level: 'warn'` — on every such call, not once per
process, because it flags a misspelled call rather than a lifecycle event.

The same passthrough is also reachable through the reader:
`createSignal(existing.get, {lazy: true})` type-checks against the *factory*
overload, because a `SignalReader<T>` is both a `SignalLike<T>` and a
`() => T` — but at runtime `isSignal()` recognises that same reader and routes
the call into the passthrough instead of building a new lazy signal from it.
It is easy to write that line and read it as constructing a fresh lazy signal;
it does not. The dropped options are reported the same way as the direct
form.

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
  rejection. It goes to `onEffectError(cb)`, then to `onSignalizeError(cb)`
  with `source: 'effect'`, and to `console.error` while nobody listens on
  either. See [api.md](./api.md#top-level-helpers).
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
- `eff.run()` inside a `batch()` queues the run and carries it out when the
  batch ends — for an `{autorun: false}` effect too.
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
  if (sig.get() > 0) throw new Error('a failed');   // not on the first run
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
  on the next change. Which is why the callback above guards on `sig.get() > 0`
  instead of throwing unconditionally: a throw on the **first** run is a
  different story. That run happens inside `createEffect()`, before any
  `Effect` was handed out, so it takes the creation back — the effect is
  destroyed and the error arrives at the `createEffect()` call instead of at a
  write. `{attach}` is the exception: the group already holds the effect, so it
  survives and behaves like every other failing run.
- A **nested** write has its own pot: if an effect callback writes another
  signal, the failures of *that* delivery are thrown at the inner `set()`,
  inside the callback. Let them through and they come back as that effect's
  own failure, once.
- A throwing `link()` callback is **not** an effect and does end the delivery.
  The failures collected before it are re-raised together with it.
- This does **not** go through `onEffectError()` — nor through
  `onSignalizeError()`. Both channels are for failures with no caller left to
  throw at — async rejections, stale cleanups, finalizer teardowns. Here the
  write is the caller, so catch at the write.

## Recursion guard

If an effect callback writes to a signal it depends on, `run()` re-enters
itself synchronously. Tolerated up to `getMaxEffectDepth()` levels, 256 by
default; beyond that, it throws:

```
[signalize] Effect Symbol(ef…) exceeded maxDepth=256: an effect callback
recursively re-triggered itself (likely by writing a signal it depends on).
Break the cycle, or raise the cap with setMaxEffectDepth(n) if the recursion is intentional.
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

## Memos: `batchWrites` is opt-in, and grouping side-effect writes is all it does

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
`doubled` still at its old value. `batchWrites: true` restores the one-run
grouping, and the price for it is a full flush per recompute — a `Set`, an
array, two temporary queue subscriptions and one dispatch through eventize
for a single deferred effect, measured at roughly 3x a recompute under the
default. (Without a dependent effect there is nothing to defer and the flush
is skipped entirely, so the option then costs practically nothing.) That is
why the default is `false` — every memo with a dependent effect would pay it,
and a `computer` that writes other signals is the exception, not the rule.

Reading a *composed* memo from inside such a callback is safe, and used to
not be:

```ts
const source = createSignal(0);
const inner = createMemo(() => source.get() * 10, {lazy: true});

const outer = createMemo(
  () => source.get() + inner(),   // reads a composed memo
  {batchWrites: true},
);
```

If `inner` is dirty when `outer` recomputes, reading it runs it right there,
inside `outer`'s batch — a memo's read hook is not subject to the batch's
deferral, only its resulting write is. `outer` sees `inner`'s fresh value on
the first read. This used to return the stale value instead, and for a
`{lazy: true}` `inner` it stayed stale until something read it directly
outside any batch.

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
- `effect.run()` inside a batch queues the run, and the flush carries it out —
  including for an `{autorun: false}` effect, which a plain signal write still
  leaves alone.
- Reading a memo inside the callback recomputes it right there instead of
  returning the value it had before the batch; the recompute's own write stays
  in the batch.
- An effect that throws during the flush does not end it — the remaining
  delayed effects still run, and the failure reaches the `batch()` caller
  afterwards.
- `batch()` is a hint, not a guarantee — internal consistency may still
  cause partial propagation.
- `batch()`'s callback must be synchronous. An `async` callback stops being
  batched at its first `await` — everything before that point still runs
  batched, everything after runs completely unbatched, with no error. To
  catch this, `batch()` throws `TypeError` if the callback returns a
  thenable, and its signature rejects `async` callbacks at `tsc` time:

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
  object is GC'd. An attached signal whose value points back at the object no
  longer blocks that — group and host are collected together. **An attached
  effect whose callback closure captures the object still does**: every live
  effect is reachable from the global effect queue until it is destroyed, with
  or without a group, so whatever its closure holds is held too. Explicit
  `SignalGroup.delete(this)` or `group.clear()` remains the reliable pattern;
  the registry is best-effort and non-deterministic, and a group collected that
  way never emits `DESTROY`.
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

child.signal<string>('theme');  // → falls through to root's 'theme'
// without the type argument the result is Signal<unknown>: a group holds
// heterogeneous signals and cannot know what a name stands for
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
  watch. Once 1000 links hang off one source, `link()` reads this paragraph
  back to you at runtime — one `console.warn` per source signal, then never
  again for that source. With an `onSignalizeError()` handler registered it
  arrives there instead, with `source: 'link-count'`.
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
  (`AbortSignal`, typed as `AbortSignalLike`, a structural subset every real
  `AbortSignal` satisfies) to cancel the wait without destroying the link. `nextValue()`
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
  one doesn't starve the others. That last stop switches retaining off
  entirely, so a `nextValue()` afterwards waits for the next value instead of
  resolving with one that arrived while nobody was iterating.
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

map.has('foo');             // false — the entry left with its signal
map.get('foo') === s;       // false — a fresh, live signal
map.delete('foo');          // false — nothing left to remove

s.value;                    // 42 — the corpse is yours now, not the map's
s.set(99);                  // stores 99, notifies nobody (signal is destroyed)
```

The map subscribes to the destruction of every signal it hands out, so an
external `destroySignal()` evicts the entry synchronously. What it does *not*
react to is a soft detach: `SignalGroup#off()` on a group the signal is
attached to leaves both the signal and its entry in place.

Individual entries are removed with `map.delete('foo')`: it destroys the
signal and drops the entry in one step.

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

`getSignalsCount()` carries the same caveat the link counter already did:
both self-correct when their object is merely dropped instead of destroyed,
so the comparison above still needs explicit teardown to mean anything. A
green comparison is not evidence that a finalizer ran, and a red one can turn
green on its own if a garbage collection happens in between.

Wrapping the same scenario in a `getSubscriptionCount(queue)` snapshot — one
argument, imported straight from `@spearwolf/eventize`, taken before and
compared after — extends the check to the *explicit* teardown paths on the
two global queues: `globalSignalQueue` and `globalDestroySignalQueue` come
back to where they started, not just the count.

The GC case needs more than that, and copying the snippet above into it is
how you write a flaky test. A link dropped together with its source does
release those subscriptions, but only once a finalizer has run — which
requires the run to be under `--expose-gc` and the assertion to sit behind a
retry loop that forces collection until the count actually reaches 0, rather
than after a single `gc()` or a bare `await`. `src/link.gc.spec.ts` is the
worked example: it fails loudly when `globalThis.gc` is missing, drives
`gc()` plus `setImmediate` in a bounded budget loop, and only then compares
the two subscription counts.

## Migrating off `signalReader(callback)`

```ts
// Deprecated — no unsubscribe handle:
sig.get((value) => {
  onChange(value);
});

// Replacement:
const unsub = sig.onChange((value) => {
  onChange(value);
});
// ...
unsub();
```

The callback form is a separate overload of `SignalReader` and carries an
`@deprecated` tag, so an editor strikes through `sig.get(cb)` while the plain
`sig.get()` stays unmarked. Same for `SignalGroup.destroy()` and
`SignalGroup#destroy`, whose replacements are `SignalGroup.delete()` and
`group.clear()`.
