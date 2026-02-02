---
name: signalize-memos
description: 'Computed/derived signals for @spearwolf/signalize: createMemo for cached computations that automatically update when dependencies change. Use when creating derived values that depend on other signals.'
---

# Signalize Memos

## Overview

Memos are **computed signals** - cached values that automatically recalculate when their dependencies change. They combine the reactivity of effects with the read interface of signals.

```typescript
import {createMemo, createSignal} from '@spearwolf/signalize';

const count = createSignal(0);
const doubled = createMemo(() => count.get() * 2);

doubled(); // 0
count.set(5);
doubled(); // 10 (automatically updated)
```

## Quick Start

```typescript
const firstName = createSignal('John');
const lastName = createSignal('Doe');

const fullName = createMemo(() => {
  return `${firstName.get()} ${lastName.get()}`;
});

fullName(); // 'John Doe'

firstName.set('Jane');
fullName(); // 'Jane Doe'
```

## Lazy vs Non-Lazy Memos

### Non-Lazy (Default)

Recomputes **immediately** when dependencies change:

```typescript
let computeCount = 0;

const doubled = createMemo(() => {
  computeCount++;
  return count.get() * 2;
});

// computeCount = 1 (computed on creation)

count.set(5);
// computeCount = 2 (recomputed immediately)

doubled(); // Returns cached value, no recompute
doubled(); // Still cached
// computeCount = 2
```

**Use when:** The memo is read frequently and should always have the latest value ready.

### Lazy

Recomputes **only when read** after dependencies change:

```typescript
let computeCount = 0;

const doubled = createMemo(
  () => {
    computeCount++;
    return count.get() * 2;
  },
  {lazy: true},
);

// computeCount = 0 (not computed yet!)

doubled();
// computeCount = 1 (computed on first read)

count.set(5);
// computeCount = 1 (NOT recomputed yet)

doubled();
// computeCount = 2 (recomputed on read)
```

**Use when:** The computation is expensive and the memo might not be read after every change.

## createMemo Options

```typescript
createMemo(factory, options?)
```

| Option     | Type                    | Default | Description                         |
| ---------- | ----------------------- | ------- | ----------------------------------- |
| `lazy`     | `boolean`               | `false` | Defer computation until read        |
| `attach`   | `object \| SignalGroup` | -       | Attach to group for lifecycle       |
| `name`     | `string \| symbol`      | -       | Named signal in group               |
| `priority` | `number`                | `1000`  | Execution priority (higher = first) |

### attach and name

```typescript
const group = SignalGroup.findOrCreate(this);

const fullName = createMemo(() => `${firstName.get()} ${lastName.get()}`, {
  attach: group,
  name: 'fullName',
});

// Later: access by name
group.signal('fullName');
```

### priority

Memos have default priority `1000`, higher than effects (default `0`). This ensures memos compute before effects that depend on them.

```typescript
// Custom priority
const critical = createMemo(compute, {priority: 2000}); // Runs first
const normal = createMemo(compute); // Priority 1000
const deferred = createMemo(compute, {priority: 500}); // Runs later
```

## Caching Behavior

Memos cache their result and only recompute when dependencies actually change:

```typescript
let computeCount = 0;

const expensive = createMemo(() => {
  computeCount++;
  return heavyCalculation(input.get());
});

expensive(); // computeCount = 1
expensive(); // computeCount = 1 (cached)
expensive(); // computeCount = 1 (still cached)

input.set(newValue);
expensive(); // computeCount = 2 (recomputed)
```

## Memo vs Effect

| Aspect        | Memo              | Effect              |
| ------------- | ----------------- | ------------------- |
| Returns value | YES               | NO                  |
| Caches result | YES               | NO                  |
| Can be read   | YES (like signal) | NO                  |
| Side effects  | Avoid             | Expected            |
| Use for       | Derived data      | Actions/DOM updates |

```typescript
// MEMO: Derived data
const total = createMemo(() =>
  items.get().reduce((sum, i) => sum + i.price, 0),
);

// EFFECT: Side effect
createEffect(() => {
  document.title = `Total: ${total()}`;
});
```

## Chained Memos

Memos can depend on other memos:

```typescript
const items = createSignal([{price: 10}, {price: 20}]);
const taxRate = createSignal(0.1);

const subtotal = createMemo(() =>
  items.get().reduce((sum, i) => sum + i.price, 0),
);

const tax = createMemo(() => subtotal() * taxRate.get());

const total = createMemo(() => subtotal() + tax());

total(); // 33 (30 + 3)
```

## Cleanup

Memos are destroyed like signals:

```typescript
const memo = createMemo(() => compute());

// Using destroySignal
destroySignal(memo);

// Or via SignalGroup
const group = SignalGroup.findOrCreate(obj);
createMemo(compute, {attach: group});
group.clear(); // Destroys all attached memos
```

## Common Patterns

### Filtered List

```typescript
const items = createSignal([1, 2, 3, 4, 5]);
const filter = createSignal((n: number) => n > 2);

const filtered = createMemo(() => items.get().filter(filter.get()));
```

### Sorted Data

```typescript
const data = createSignal([{name: 'B'}, {name: 'A'}]);
const sortKey = createSignal('name');

const sorted = createMemo(() =>
  [...data.get()].sort((a, b) =>
    a[sortKey.get()].localeCompare(b[sortKey.get()]),
  ),
);
```

### Expensive Computation with Lazy

```typescript
const searchQuery = createSignal('');
const allItems = createSignal([
  /* large dataset */
]);

// Only compute when actually needed
const searchResults = createMemo(
  () => {
    const query = searchQuery.get().toLowerCase();
    return allItems
      .get()
      .filter((item) => item.name.toLowerCase().includes(query));
  },
  {lazy: true},
);
```

## Pitfalls to Avoid

### 1. Side effects in memos

```typescript
// BAD - memos should be pure
const bad = createMemo(() => {
  console.log('Computing...'); // Side effect!
  return value.get() * 2;
});

// GOOD - use effect for side effects
const good = createMemo(() => value.get() * 2);
createEffect(() => {
  console.log('Value doubled:', good());
});
```

### 2. Expecting lazy memo to be current

```typescript
const memo = createMemo(compute, {lazy: true});

signal.set(newValue);
// memo() might return OLD value until you call it!
```

### 3. Forgetting cleanup

```typescript
// Always destroy memos or use SignalGroup
const memo = createMemo(compute);
// ... later ...
destroySignal(memo); // Don't forget!
```
