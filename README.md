![signalize hero](https://github.com/spearwolf/signalize/blob/main/hero.gif?raw=true)

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

## Why

- **Four primitives** — signal, effect, memo, link. Composable.
- **Synchronous** — `signal.set(x)` runs every dependent effect inline before
  returning. No queues, no microtasks.
- **Lifecycle bundles** — `SignalGroup` owns signals/effects/links and
  destroys them together. Stored in a `WeakMap`, so it doesn't pin user
  objects.
- **Class-based opt-in** — TC39 standard `@signal` / `@memo` decorators in a
  separate subpath; the core API does not depend on classes.
- **TypeScript-first** — everything is typed, including `Signal<T>`,
  `Effect`, `SignalReader<T>`, `SignalLink<T>`, options, and decorator
  metadata.

Runs anywhere modern JavaScript runs. Targets ES2023, requires Node `>=24.13`.

## Install

```shell
npm install @spearwolf/signalize
```

`@spearwolf/eventize` is a peer dependency.

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
SignalGroup, SignalAutoMap

// host-object signals
findObjectSignalByName, findObjectSignals, findObjectSignalNames,
destroyObjectSignals

// decorators (subpath: '@spearwolf/signalize/decorators')
signal, memo
```

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

## Contributing

Issues and pull requests are welcome. See
[CONTRIBUTING.md](./CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

Apache-2.0. See [LICENSE](./LICENSE).

---

Hero image generated with DALL·E (guided by ChatGPT), animated by KLING AI,
converted by Ezgif.com.
