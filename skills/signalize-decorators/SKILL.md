---
name: signalize-decorators
description: 'EXPERIMENTAL: @signal and @memo TC39 decorators for class-based reactivity in @spearwolf/signalize. Use with caution - the decorator API may change. Prefer manual signal creation (createSignal, createMemo) for production code.'
---

# Signalize Decorators (EXPERIMENTAL)

> **WARNING**: These decorators are **experimental** and should be used with caution.
> The decorator API may change in future versions.
>
> **For production code, prefer manual signal creation:**
>
> - `createSignal()` instead of `@signal()`
> - `createMemo()` instead of `@memo()`

## When to Use Decorators

**Consider using when:**

- Prototyping or personal projects
- Decorator syntax significantly improves readability
- You accept the risk of API changes

**Avoid using when:**

- Production applications requiring long-term stability
- Libraries consumed by others
- You need fine-grained control over signal behavior

## Import

```typescript
import {signal, memo} from '@spearwolf/signalize/decorators';
```

## @signal() Decorator

Creates a reactive property using TC39 class accessor decorators:

```typescript
class Counter {
  @signal() accessor count = 0;
}

const counter = new Counter();
counter.count; // 0 (reactive read)
counter.count = 5; // (reactive write)
```

**Note:** Must use the `accessor` keyword - this is a TC39 decorator requirement.

### Options

```typescript
@signal(options?)
```

| Option        | Type                | Description                                 |
| ------------- | ------------------- | ------------------------------------------- |
| `name`        | `string \| symbol`  | Custom signal name (default: property name) |
| `compare`     | `(a, b) => boolean` | Custom equality comparator                  |
| `readAsValue` | `boolean`           | Read without tracking (non-reactive)        |

### Custom Name

```typescript
class Foo {
  @signal({name: 'internalCount'}) accessor count = 0;
}

// Signal stored as 'internalCount', not 'count'
const group = SignalGroup.get(foo);
group.signal('internalCount'); // Access by name
```

### Custom Comparator

```typescript
class Foo {
  @signal({
    compare: (a, b) => Math.abs(a - b) < 0.01,
  })
  accessor threshold = 0.5;
}
```

## @memo() Decorator

Creates a memoized computed property:

```typescript
class Counter {
  @signal() accessor count = 0;

  @memo() doubled() {
    return this.count * 2;
  }
}

const counter = new Counter();
counter.doubled(); // 0
counter.count = 5;
counter.doubled(); // 10
```

### Options

```typescript
@memo(options?)
```

| Option | Type               | Description                             |
| ------ | ------------------ | --------------------------------------- |
| `name` | `string \| symbol` | Custom memo name (default: method name) |

### Memo Behavior

- Always **lazy** - computed on first call, not on creation
- Cached until dependencies change
- Re-computed on next call after dependency change

```typescript
class Foo {
  @signal() accessor value = 1;
  computeCount = 0;

  @memo() expensive() {
    this.computeCount++;
    return heavyCalculation(this.value);
  }
}

const foo = new Foo();
foo.expensive(); // computeCount = 1
foo.expensive(); // computeCount = 1 (cached)

foo.value = 2;
// computeCount still 1 - lazy, not recomputed yet

foo.expensive(); // computeCount = 2 (recomputed)
```

## Accessing Underlying Signals

```typescript
import {
  findObjectSignalByName,
  findObjectSignalNames,
  destroyObjectSignals,
  value,
} from '@spearwolf/signalize';

class Foo {
  @signal() accessor count = 0;
  @signal({name: 'custom'}) accessor other = '';
}

const foo = new Foo();

// Get signal by name
const countSignal = findObjectSignalByName(foo, 'count');
countSignal.get();
countSignal.set(10);

// List all signal names
findObjectSignalNames(foo); // ['count', 'custom']

// Non-reactive read
value(countSignal);
value([foo, 'count']); // Tuple syntax

// Cleanup
destroyObjectSignals(foo);
```

## SignalGroup Integration

Decorated signals are automatically attached to a SignalGroup:

```typescript
class Foo {
  @signal() accessor count = 0;
}

const foo = new Foo();
const group = SignalGroup.get(foo);

group.signal('count'); // Access signal
group.clear(); // Destroys all signals
```

## Cleanup

```typescript
// Option 1: Destroy all object signals
destroyObjectSignals(foo);

// Option 2: Via SignalGroup
SignalGroup.get(foo)?.clear();
SignalGroup.delete(foo);
```

## Alternative: Manual Approach

For production code, prefer manual signal creation:

```typescript
// Instead of decorators:
class Counter {
  @signal() accessor count = 0;
  @memo() doubled() {
    return this.count * 2;
  }
}

// Use manual approach:
class Counter {
  count = createSignal(0, {attach: this});
  doubled = createMemo(() => this.count.get() * 2, {attach: this});

  destroy() {
    SignalGroup.delete(this);
  }
}
```

**Benefits of manual approach:**

- Full control over signal options
- Explicit lifecycle management
- Stable API
- Works in all environments

## Instance Isolation

Each class instance gets its own signal instances:

```typescript
class Foo {
  @signal() accessor count = 0;
}

const a = new Foo();
const b = new Foo();

a.count = 10;
b.count; // 0 - independent instance
```

## Pitfalls

### 1. Missing `accessor` keyword

```typescript
// BAD - won't work!
@signal() count = 0;

// GOOD
@signal() accessor count = 0;
```

### 2. Custom comparator surprises

```typescript
@signal({
  compare: (a, b) => a === b || a === b + 1
}) accessor value = 1;

foo.value = 2;
foo.value;  // Still 1! (2 === 1 + 1, considered equal)
```

### 3. Expecting memo to auto-update

```typescript
@memo() computed() {
  return this.value * 2;
}

foo.value = 5;
// Memo not recomputed yet - it's lazy!

foo.computed();  // NOW it recomputes
```

### 4. Forgetting cleanup

```typescript
// Always clean up when object is disposed
destroyObjectSignals(foo);
```
