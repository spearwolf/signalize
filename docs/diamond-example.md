# The diamond problem

Two challenges decide how a fine-grained reactivity library behaves when the
paths of a dependency graph converge. Milo Mighdoll's
[Reactive algorithms](https://github.com/milomg/reactively/blob/main/Reactive-algorithms.md)
states them side by side, together with the two goals behind them: never
over-execute a reactive element, and never let user code observe a graph in
which only some elements have updated.

The shape both are about is a diamond — one source, two paths, one consumer:

```
     A
    / \
   B   C
    \ /
     D
```

**Over-execution and glitches** are the eager library's problem. `A` changes,
`B` recomputes, `D` runs — while `C` still holds its old value. Then `C`
recomputes and `D` runs a second time. The extra run costs work; the state the
first one observed never existed as a whole.

**The equality check** is the lazy library's problem. When `B` recomputes to
the value it already had, nothing below it has changed and `C` must not run at
all — in the article's notation:

```ts
const A = signal(3);
const B = memo(() => A() * 0); // always 0
const C = memo(() => B() + 1); // must run exactly once, ever
```

## Where signalize stands

Propagation is eager, inline and synchronous — a write notifies every
dependent before `set()` returns, and there is no scheduler that could defer
or deduplicate the pass (see [Architecture](./architecture.md) → "Reactivity
is synchronous, with no scheduler"). That trade makes the second challenge
free and the first one visible.

### The equality check: nothing left to do

A write whose value compares equal to the stored one notifies nobody — it is
a no-op, not a silenced notification (`compare` widens what counts as equal).
The chain stops at the first link that does not actually change:

```ts
const a = createSignal(1);
const b = createMemo(() => a.get() * 0); // always 0
const c = createMemo(() => b() + 1);

createEffect(() => {
  b();
  c();
});

a.set(2);
a.set(3);
// b's computer ran three times, c's exactly once — at creation, with the effect.
```

`b` is subscribed to `a`, so its computer runs on every write; that is the
recompute, not the propagation. What stops is the value: `b`'s signal never
leaves `0`, so `c` is never notified and the effect never re-runs. Spelling
the same graph with plain signals and effects that write them
(`createEffect(() => b.set(a.get() * 0))`) behaves identically — the gate sits
in the signal, not in the memo.

### The diamond: one run per path

```ts
const a = createSignal(1);
const b = createMemo(() => a.get() * 2);
const c = createMemo(() => a.get() + 1);

createEffect(() => console.log(b(), c()));

a.set(2);
// → 4 2   ← b updated, c still on its old value
// → 4 3
```

Two runs, the first of them on a half-updated graph. The delivery to `a`'s
subscribers is still walking the list when `b`'s write reaches the effect;
`c` has not been told anything yet, so it answers the read with the value it
holds. Nothing here is a queue that could be sorted first — that is the price
of the inline pass.

### `batch()` removes the glitch

```ts
batch(() => a.set(2));
// → 4 3
// → 4 3
```

A batch marks every dependent up front and runs it afterwards. A memo read
during that pass therefore knows it is stale and recomputes on the spot, so
every run sees the settled state. The redundant run stays: the batch
deduplicates the effect it queued itself, not the runs the memos' own writes
trigger while the flush is under way. `batch()` is a hint, not a guarantee —
see [Recipes](./recipes.md) → "Batching".

Where the consumer's work is idempotent, that is usually the whole answer:
correct values, one pass too many.

### One memo, one run

Where the extra run matters, let the paths converge in the graph instead of in
the consumer:

```ts
const a = createSignal(1);
const bc = createMemo(() => ({b: a.get() * 2, c: a.get() + 1}));

createEffect(() => {
  const {b, c} = bc();
  console.log(b, c);
});

a.set(2);
// → 4 3
```

One dependency, one notification, nothing left to interleave.

### What does not help

`{lazy: true}` memos. A lazy memo recomputes on read and notifies nobody, so
the converging effect does not re-run at all and keeps working with the values
of its last pass until something else wakes it. Laziness moves the recompute;
it does not merge the two notifications.

## The behaviour is pinned

Every claim on this page is a test in `src/diamond-problem.spec.ts` — the
equality check in both spellings, the torn first run, the batched pass, the
single-memo funnel. If one of them ever stops holding, that file fails.
