# Patterns — `@spearwolf/signalize`

Shapes that work well with the library's design. They are starting points, not a mandated style — an existing codebase's conventions win.

## Lifecycle-bundled component

The default way to own reactive state: create everything with `{attach: this}`, tear it all down in one call.

```ts
class Player {
  health = createSignal(100, {attach: this});
  pos    = createSignal({x: 0, y: 0}, {attach: this});

  constructor() {
    createEffect(() => render(this.pos.get()), {attach: this});
    link(this.health, (v) => v <= 0 && this.die(), {attach: this});
  }

  destroy() { SignalGroup.delete(this); }   // signals + effects + links
}
```

Group hierarchies compose: `parentGroup.attachGroup(childGroup)` makes the child's teardown part of the parent's.

## Frame-paced effect

Propagation is synchronous, so pacing is the caller's job. An `autorun: false` effect only actually re-runs when a tracked dep changed since the last run, which makes it cheap to call every frame.

```ts
const eff = createEffect(render, {autorun: false});

const tick = () => {
  updateState();
  eff.run();
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
```

## Derivation chain

Eager memos push; chain them and let a single effect sit at the end.

```ts
const items   = createSignal<Item[]>([]);
const visible = createMemo(() => items.get().filter((x) => x.visible));   // eager
const count   = createMemo(() => visible().length);                       // eager, reads a memo
createEffect(() => render(count()));                                      // re-runs when count() changes
```

## Decorator class with an eager memo

```ts
class Cart {
  @signal() accessor items: Item[] = [];

  // Eager by default — attached to the instance group.
  // Built inside an effect body? Then the memo dies with that effect (pitfalls 7a).
  total = createMemo(() => this.items.reduce((s, x) => s + x.price, 0), {attach: this});

  destroy() { SignalGroup.delete(this); }
}
```

## Coalescing several writes

```ts
batch(() => {
  a.set(1);
  b.set(2);
});   // dedup + priority-ordered flush (a hint, not a guarantee — see pitfalls.md)
```

## Pausing without destroying

`g.off()` destroys attached effects and links and drops external subscriptions while keeping the signals and their values, so the group can be repopulated later. `g.clear()` is the full teardown.

## Leak check in tests

```ts
const baseline = [getSignalsCount(), getEffectsCount(), getLinksCount()];
// build, exercise, and tear down the scenario
expect([getSignalsCount(), getEffectsCount(), getLinksCount()]).toEqual(baseline);
```

Inside the signalize repo itself, `src/assert-helpers.ts` uses `@spearwolf/eventize`'s `getSubscriptionCount(queue)` (one argument) for per-queue subscription assertions; `getSubscribedEventNames(queue)` gives the per-event view.

## Common rewrites

Code shaped by other signal libraries usually needs one of these. Each left-hand form is silently wrong rather than an error, so it is worth flagging on review.

| Instead of | Write |
| --- | --- |
| `signal.set((prev) => prev + 1)` | `signal.set(signal.value + 1)` — `set` takes a value |
| `signal.get(callback)` | `signal.onChange(callback)` — returns an unsubscribe handle |
| `createEffect(() => use(sig.value))` | `createEffect(() => use(sig.get()))` — `.value` does not track |
| `createEffect(cb, [a])` when an initial pass is needed | add `eff.run()` once — static deps do not autorun |
| A `createEffect` that writes its result into a signal | `createMemo` — priority and caching come for free |
| Looking for a memo decorator | `createMemo(..., {attach: this})` as a class field — there is none |
| `experimentalDecorators: true` in `tsconfig.json` | TC39 standard decorators — `@signal` needs the `accessor` keyword |
| Creating effects/links and destroying them by hand later | `{attach: obj}` from the start, then `SignalGroup.delete(obj)` |

## Where signalize is the wrong tool

- Cross-process or async-first state → a real store or message bus.
- Built-in time travel, undo, or devtools → a library that ships them.
- A single "call me when X changes" with no derivation graph → `signal.onChange(cb)` works, but plain `@spearwolf/eventize` is simpler.
