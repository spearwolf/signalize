![signalize hero](https://github.com/spearwolf/signalize/blob/main/hero2--noir.png?raw=true)

![npm (scoped)](https://img.shields.io/npm/v/%40spearwolf/signalize)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/spearwolf/signalize/main.yml)
![License](https://img.shields.io/github/license/spearwolf/signalize)

# @spearwolf/signalize

Synchronous, fine-grained reactivity for JavaScript and TypeScript.
Framework-agnostic. ESM-only. No magic, no scheduler, no virtual graph.

```typescript
import {createSignal, createEffect} from '@spearwolf/signalize';

const count = createSignal(0);

createEffect(() => console.log('count =', count.get()));
// => "count = 0"

count.set(5);
// => "count = 5"
```

## What makes it different

All modern signal systems give you synchronously consistent **reads**: call
`derived.get()` after a `set()` and you get the recomputed value, glitch-free.
That part is table stakes — Solid, Vue, Angular, Svelte 5, Preact Signals,
MobX, and `signalize` all guarantee it.

What differs is **effects** — the observer callbacks you register to *react*
to a change (write to the DOM, push to a socket, mutate an external system).
Vue's `watch`/`watchEffect`, Angular's `effect()`, and Svelte 5's `$effect`
defer these to a microtask or the next change-detection tick; MobX runs
reactions at the end of the enclosing `action`. So while the *value* you'd
read is already correct, the *side effects* that depend on it haven't fired
yet — and you have no in-band hook to wait for them without yielding the
call stack.

`signalize` runs every dependent effect **inline**, in deterministic priority
order, on the same call stack as the write — no scheduler, no microtask, no
batch boundary. After `set()` returns, every observer has already executed.
This is the central design trade-off:

```typescript
const total = createSignal(0);
createEffect(() => console.log('total =', total.get()));
// => "total = 0"

total.set(5);
// => "total = 5"   ← already logged before this line finished
```

That property is why this library exists. It makes reactive logic safe to
embed inside a `requestAnimationFrame` callback, a physics tick, a worker
message handler, or any other place where "settle before I move on" matters
more than "batch for free". When you *do* want batching, you ask for it
explicitly with `batch()`.

## 🚀 Why

In complex interactive front-ends—such as **3D configurators, real-time dashboards, or gamified PWAs**—managing state with traditional tools often leads to "render hell" or unpredictable side effects. 

`signalize` was architected to solve these specific challenges by providing a **precise and decoupled** reactive core that works independently of any UI framework. It is designed for developers who need full control over *when* and *how* state changes propagate through their systems.

* **🔌 Zero Framework Lock-in:** Use it with React, Vue, Web Components, or Vanilla JS. It’s the "source of truth" that stays stable even if you migrate your UI layer.
* **🎯 Precise Reactivity:** No global re-renders. Only the specific observers (effects) that depend on a changed signal are executed.
* **🛠 Production-Ready:** Developed by a Software Artisan with 20+ years of experience to power mission-critical industrial applications.

## Features

- **Four primitives** — `signal` (state), `effect` (observer), `memo`
  (cached derive), `link` (signal-to-signal binding). Small surface, no DSL.
- **Inline propagation** — `set()` runs every dependent effect before it
  returns. No scheduler, no microtask, no virtual graph.
- **Priority-ordered effects** — numeric priority (memos at `1000`, regular
  effects at `0`); runaway loops fail loud at `maxDepth = 256`.
- **Auto-tracked dependencies** — subscribe on read, unsubscribe when no
  longer read; nested effects tear down before their parent re-runs.
- **Lifecycle bundles** — `SignalGroup` ties signals, effects, and links to
  a host object and disposes them in one call; counters like
  `getSignalsCount()` make leaks assertable in tests.
- **Context modes** — `batch()` to coalesce writes, `beQuiet()` for silent
  mutation, `hibernate()` to pause reactivity, `value()` / `.value` for
  untracked reads.
- **Optional class API** — TC39 standard `@signal` / `@memo` decorators on
  a separate subpath; the core has no class dependency.
- **TypeScript-first** — every primitive, option, and decorator is fully
  typed.

Runs anywhere modern JavaScript runs. Targets ES2023, requires Node `>=24.13`.

## Install

```shell
npm install @spearwolf/signalize
```

[`@spearwolf/eventize`](https://github.com/spearwolf/eventize) 🏹 is a peer dependency.

## API at a glance

```ts
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
SignalGroup, getSignalGroupsCount, SignalAutoMap

// host-object signals
findObjectSignalByName, findObjectSignals, findObjectSignalNames,
destroyObjectSignals

// decorators (subpath: '@spearwolf/signalize/decorators')
signal, memo
```

## Examples

### Game loop / animation frame

Inline propagation means the HUD update runs *inside* the frame that produced
the new value — no risk of seeing a stale FPS counter one frame later.

```typescript
import {createSignal, createMemo, createEffect} from '@spearwolf/signalize';

const fps   = createSignal(60);
const label = createMemo(() => `FPS: ${fps.get().toFixed(0)}`);

createEffect(() => hud.textContent = label());

function frame(now: number) {
  fps.set(measureFps(now));   // HUD updates synchronously, before next line
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

### Derived values + batched writes

`createMemo` caches a derived value and runs at high priority — every effect
that reads the memo will see a fully-recomputed result. `batch()` makes a
group of writes look like a single transaction to downstream effects.

```typescript
import {createSignal, createMemo, createEffect, batch} from '@spearwolf/signalize';

const price = createSignal(100);
const qty   = createSignal(1);
const total = createMemo(() => price.get() * qty.get());

createEffect(() => console.log('total =', total.get()));
// => "total = 100"

batch(() => {
  price.set(120);
  qty.set(3);
});
// => "total = 360"   (one log, not two)
```

### Component-style lifecycle with `SignalGroup`

Attach signals and effects to a host object; tear them down with a single
call. Useful for Web Components, classes, or any object with a clear dispose
point.

```typescript
import {createSignal, createEffect, SignalGroup} from '@spearwolf/signalize';

class CartWidget extends HTMLElement {
  count = createSignal(0, {attach: this});

  connectedCallback() {
    createEffect(() => this.render(this.count.get()), {attach: this});
  }

  disconnectedCallback() {
    SignalGroup.delete(this);  // destroys count + the effect + their subscriptions
  }

  render(n: number) { this.textContent = `${n} items`; }
}
```

### Framework-agnostic domain model

Reactivity lives in the model, not the view. The same store can drive a React
adapter, a Vue component, a Web Component, or a plain DOM render — none of
them have to know about each other.

```typescript
import {createSignal, createEffect} from '@spearwolf/signalize';

export function createCart() {
  const items = createSignal<Item[]>([]);
  const subtotal = createMemo(() =>
    items.get().reduce((sum, i) => sum + i.price * i.qty, 0),
  );
  return {
    add: (i: Item) => items.set([...items.get(), i]),
    items, subtotal,
  };
}

// Anywhere — React hook, Vue ref bridge, vanilla:
const cart = createCart();
createEffect(() => console.log('subtotal =', cart.subtotal()));
```

## Typical use cases

`signalize` was built for — and is in production use across —
**3D configurators, real-time dashboards, gamified PWAs, and game/render
loops**. More broadly, it fits any scenario where you want:

- a **stable reactive core** that survives swapping out the UI layer,
- **predictable propagation** that you can reason about line by line, or
- **lifecycle-aware** bundles of reactive state attached to long-lived
  host objects (entities, components, panels, widgets).

It is *not* aimed at "magic full-stack reactivity" or implicit re-render
trees. If your mental model is "I want my UI to re-render automatically and
I'll never think about subscriptions" — a framework-bound solution will be
less effort.

## Class API

```typescript
import {signal, memo} from '@spearwolf/signalize/decorators';

class Counter {
  @signal() accessor value = 0;
  @memo() doubled() { return this.value * 2; }
  inc() { this.value++; }
}
```

> The decorator API uses TC39 standard decorators (no `experimentalDecorators`).
> Memos created via `@memo` are always lazy.

## Documentation

| Document                                  | Purpose                                     |
| ----------------------------------------- | ------------------------------------------- |
| [Quickstart](./docs/quickstart.md)        | Install + 5-minute tour.                    |
| [Architecture](./docs/architecture.md)    | Concepts, internals, source map.            |
| [API reference](./docs/api.md)            | Every export, every option.                 |
| [Recipes & quirks](./docs/recipes.md)     | Patterns, gotchas, lifecycle.               |
| [Cheat sheet](./docs/cheat-sheet.md)      | One-page lookup.                            |

For changes between releases, see [CHANGELOG.md](./CHANGELOG.md).

### AI coding agents

The package ships an agent skill at [`skills/using-signalize/`](./skills/using-signalize) that teaches Claude Code (and compatible agents) the mental model, the behaviours that silently produce wrong reactive code, and the idiomatic patterns. See its [README](./skills/using-signalize/README.md) for install options.

## Contributing

Issues and pull requests are welcome. See
[CONTRIBUTING.md](./CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

Apache-2.0. See [LICENSE](./LICENSE).

