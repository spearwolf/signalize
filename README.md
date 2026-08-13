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
  effects at `0`); runaway loops fail loud at `maxDepth = 256`, moved with
  `setMaxEffectDepth(n)`.
- **Auto-tracked dependencies** — subscribe on read, unsubscribe when no
  longer read; nested effects tear down before their parent re-runs.
- **Lifecycle bundles** — `SignalGroup` ties signals, effects, and links to
  a host object and disposes them in one call; counters like
  `getSignalsCount()` make leaks assertable in tests — they track what is
  still reachable, correcting themselves when an object is dropped rather
  than destroyed.
- **Context modes** — `batch()` to coalesce writes, `beQuiet()` for silent
  mutation, `hibernate()` to pause reactivity, `value()` / `.value` for
  untracked reads.
- **Optional class API** — the TC39 standard `@signal` decorator on
  a separate subpath; the core has no class dependency.
- **TypeScript-first** — every primitive, option, and decorator is fully
  typed.

Runs anywhere modern JavaScript runs. Targets ES2023, requires Node `>=22`.

## Install

[`@spearwolf/eventize`](https://github.com/spearwolf/eventize) 🏹 is a peer dependency — install it alongside, since pnpm and yarn do not add peers automatically:

```shell
# pick one
npm install  @spearwolf/signalize @spearwolf/eventize
pnpm add     @spearwolf/signalize @spearwolf/eventize
yarn add     @spearwolf/signalize @spearwolf/eventize
```

ESM-only: there is no CommonJS build. Two entry points — `@spearwolf/signalize` and `@spearwolf/signalize/decorators`.

## Versioning & stability

What you may rely on is decided by the version number you installed:

- **`0.x` — nothing is promised.** Any release may change or remove anything:
  exported names, call signatures, option shapes, thrown message texts,
  observable ordering. `CHANGELOG.md` records what moved, but a minor bump on
  this side of `1.0.0` carries no implication that it was safe to take.
- **`1.0.0` and above — semver on the published surface.** Breaking that
  surface requires a major bump. The published surface is what the two entry
  points export — `@spearwolf/signalize` and
  `@spearwolf/signalize/decorators` — together with the types those exports
  carry: everything reachable by following imports from `lib/index.d.ts` and
  `lib/decorators.d.ts`. The `lib/**/*.d.ts` glob in the shipped tarball is
  wider than that — `tsc` emits one declaration file per source file — but a
  declaration outside that import graph is not part of the promise.
- **A `-dev` version is not a release.** It is what `main` carries between
  releases, it never reaches npm, and it promises nothing at all.

Exempt at every version, including after `1.0.0`: everything marked
`@internal`. Those symbols are cut out of the shipped declarations, so
TypeScript will not offer them — but some remain reachable at runtime through
the global symbol registry (`Symbol.for('@spearwolf/signalize/...')`). Nothing
supports reaching for them. They change without a major bump and without a
changelog entry.

## API at a glance

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
findObjectSignalByName, findObjectSignals, findObjectSignalNames,
destroyObjectSignals

// classes — for `instanceof` checks and as types
Signal, Effect

// decorators (subpath: '@spearwolf/signalize/decorators')
signal
```

Every option and type is in the [API reference](./docs/api.md).

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

createEffect(() => console.log('total =', total()));
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
import {createSignal, createMemo, createEffect} from '@spearwolf/signalize';

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
import {signal} from '@spearwolf/signalize/decorators';
import {createMemo} from '@spearwolf/signalize';

class Counter {
  @signal() accessor value = 0;
  doubled = createMemo(() => this.value * 2, {attach: this});
  inc() { this.value++; }
}
```

Constructing such a class inside an effect body makes the constructor run part of that effect — the memo then dies with the effect's next rerun, `{attach}` or not. See [Recipes & quirks](./docs/recipes.md).

> The decorator API uses TC39 standard decorators (no `experimentalDecorators`).

## Good to know

Five things that differ from most other signal libraries. None of them raise an
error — they just quietly do something else, so they are worth reading once.

- **`set()` takes a value, not an updater.** `count.set(v => v + 1)` stores the
  *function*; write `count.set(count.value + 1)`.
- **`.get()` tracks, `.value` does not.** Reading `.value` inside an effect
  gives you an effect that never re-runs. That is also how you read
  deliberately *without* subscribing.
- **`createSignal` returns an object, `createMemo` returns a function.**
  So it is `count.get()` but `total()`.
- **Static deps switch off auto-tracking *and* autorun.**
  `createEffect(cb, [a, b])` does not run on creation, and signals read inside
  the callback are not subscribed — call `eff.run()` for an initial pass.
- **Cleanup is explicit.** Effects and links outlive the scope that created
  them: pass `{attach: obj}` and dispose with `SignalGroup.delete(obj)`. Groups
  attached to a host object do have a `FinalizationRegistry` backstop that
  clears them once the object is unreachable — unless a live effect's callback
  closure keeps the object alive, which the global effect queue makes possible
  whether or not a group is involved. GC timing is unobservable — explicit
  cleanup is insurance, not a disposal schedule.

The full list lives in [Recipes & quirks](./docs/recipes.md).

## Documentation

| Document                                  | Purpose                                     |
| ----------------------------------------- | ------------------------------------------- |
| [Quickstart](./docs/quickstart.md)        | Install + 5-minute tour.                    |
| [Architecture](./docs/architecture.md)    | Concepts, internals, source map, the decisions behind them. |
| [API reference](./docs/api.md)            | Every export, every option.                 |
| [Recipes & quirks](./docs/recipes.md)     | Patterns, gotchas, lifecycle.               |
| [Cheat sheet](./docs/cheat-sheet.md)      | One-page lookup.                            |
| [Conventions](./docs/conventions.md)      | How code is written here — for contributors and coding agents. |
| [Contributing](./CONTRIBUTING.md)         | Setup, commands, pull requests, releasing.  |

For changes between releases, see [CHANGELOG.md](./CHANGELOG.md).

### AI coding agents

The package ships an agent skill at [`skills/using-signalize/`](./skills/using-signalize) that teaches Claude Code (and compatible agents) the mental model, the behaviours that silently produce wrong reactive code, and the idiomatic patterns. See its [README](./skills/using-signalize/README.md) for install options.

## Development

The package manager is **pnpm** (`pnpm@11.20.0`); `npm install` is not supported
here. Node `>=22` builds and tests the repo; see
[CONTRIBUTING.md](./CONTRIBUTING.md) for what the toolchain expects.

```shell
git clone https://github.com/spearwolf/signalize.git
cd signalize
pnpm install
```

| Task | Runs |
| --- | --- |
| `pnpm test` | Vitest, with coverage gate. Runs the `unit` and `gc` projects together — the GC suite runs here too, not just under `test:gc` |
| `pnpm test <file>` | A single spec, e.g. `pnpm test create-signal.spec.ts` |
| `pnpm test -t "<name>"` | Only tests whose name matches |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:gc` | Runs every file serially with `--expose-gc` applied to the whole suite, not just `src/**/*.gc.spec.ts` — not what makes the GC suite run, `pnpm test` already does that |
| `pnpm test:smoke` | Runs `smoke/dist-smoke.test.ts` on plain Node (`node --test`) against the built `dist/`, type-checked against the `lib/*.d.ts` — no Vitest, no `src/`. It's the only test where **tsc**, not SWC, lowers a `@signal() accessor` application |
| `pnpm smoke` | Builds (`pnpm dist`) and then runs `test:smoke` — one command, no stale artifact |
| `pnpm checkPkgTypes` | `attw --pack --profile esm-only` — checks the `exports` map and shipped `.d.ts` across the resolution modes that apply to an ESM-only package |
| `pnpm bench` | Runs the microbenchmark suite in `bench/` |
| `pnpm check` / `pnpm fix` | Biome lint+format plus the two guard scripts (`check:refs`, `check:banner`) — check only / Biome auto-fix |
| `pnpm compile` | two `tsc` passes → `lib/` (`compile:js` for JS + sourcemaps, `compile:types` for documented, `@internal`-free `.d.ts`) |
| `pnpm bundle` | rollup → `dist/` |
| `pnpm clean` | Remove build artifacts |
| `pnpm cbt` | clean + compile + bundle + test |
| `pnpm world` | clean + **check** + compile + bundle + test:smoke + checkPkgTypes + test + test:gc — the full blocking CI scope |

A filtered run (`pnpm test <file>` or `pnpm test -t "<name>"`) always exits 1 —
the per-file coverage gate fails for every file that did not run. That is the
gate, not a failing test; read the test result above it.

**Which one to use:** `pnpm test` while iterating, and `pnpm world` before
pushing — it is the only task that also runs Biome, and it covers the full
blocking CI scope: `.github/workflows/ci.yml` runs `check`, `dist`,
`test:smoke`, `checkPkgTypes`, `test`, `test:gc` and `bench` (the last one
informative, non-blocking).

Tests are `*.spec.ts` files sitting next to the implementation in `src/`; only
`src/` is edited by hand, `lib/` and `dist/` are generated. The process is in
[CONTRIBUTING.md](./CONTRIBUTING.md), the rules code has to follow in
[docs/conventions.md](./docs/conventions.md).

## Contributing

Issues and pull requests are welcome. Start with
[CONTRIBUTING.md](./CONTRIBUTING.md) for setup and workflow, and
[docs/conventions.md](./docs/conventions.md) for how code is written here —
naming, imports, comments, tests, the public surface. Architectural decisions
live in [docs/architecture.md](./docs/architecture.md). Also see
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

Apache-2.0. See [LICENSE](./LICENSE).

