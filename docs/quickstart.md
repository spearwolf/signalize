# Quickstart

## Install

```shell
npm install @spearwolf/signalize
# or: pnpm add @spearwolf/signalize
```

ESM-only. Requires Node `>=22` or a modern browser. Targets ES2023.
`@spearwolf/eventize` is a peer dependency.

## Five-minute tour

```typescript
import {createSignal, createEffect, createMemo, batch} from '@spearwolf/signalize';

const first = createSignal('Ada');
const last  = createSignal('Lovelace');

// derived value — recomputes when first or last change
const full = createMemo(() => `${first.get()} ${last.get()}`);

// side effect — re-runs when full() changes
const eff = createEffect(() => {
  console.log('Hello,', full());
});
// => "Hello, Ada Lovelace"

// batched updates: effect runs once after the block
batch(() => {
  first.set('Grace');
  last.set('Hopper');
});
// => "Hello, Grace Hopper"

eff.destroy();   // tear down the effect when no longer needed
```

## Reading vs writing

```typescript
const count = createSignal(0);

count.get();    // reads AND tracks dependency (inside an effect)
count.value;    // reads WITHOUT tracking
count.set(1);   // writes
count.value = 1;// equivalent to .set(1)
```

## Class API (decorators)

```typescript
import {signal} from '@spearwolf/signalize/decorators';
import {createEffect, createMemo} from '@spearwolf/signalize';

class Counter {
  @signal() accessor value = 0;

  doubled = createMemo(() => this.value * 2, {attach: this});

  inc() { this.value++; }
}

const c = new Counter();
createEffect(() => console.log(c.value, c.doubled()));
c.inc();
```

A memo declared as a class field is created while the constructor runs — so if the instance is constructed inside an effect body, that constructor run *is* an effect body, and the memo dies with the parent effect's next rerun. `{attach}` gives it a group and a name, not a lifetime of its own (see [Recipes](./recipes.md)).

Standards-track decorators only — set `experimentalDecorators: false` (or omit
it). Use the `accessor` keyword on signal fields.

## Where next

- [Architecture](architecture.md) — how it works under the hood.
- [API reference](api.md) — every export, every option.
- [Recipes](recipes.md) — patterns, gotchas, lifecycle.
- [The diamond problem](diamond-example.md) — what happens when two
  derivation paths converge on one effect.
- [Cheat sheet](cheat-sheet.md) — one-page lookup.
