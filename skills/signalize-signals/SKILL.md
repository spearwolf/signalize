---
name: signalize-signals
description: 'Core reactive primitives for @spearwolf/signalize: createSignal, destroySignal, signal options (lazy, compare), muteSignal/unmuteSignal, touch, value. Use when creating, configuring, or destroying reactive signals.'
---

# Signalize Signals

## Quick Start

```typescript
import {createSignal, destroySignal, value} from '@spearwolf/signalize';

// Keep Signal object for method access (recommended)
const count = createSignal(0);
count.get(); // Read (reactive)
count.set(1); // Write
count.value; // Read (non-reactive)
count.destroy(); // Cleanup

// Or destructure for get/set only
const {get: name, set: setName} = createSignal('');
name(); // Read (reactive) - shorthand for get()
setName('John'); // Write
value(name); // Read (non-reactive)
destroySignal(name); // Cleanup - destroySignal will detect the underlying signal from signal-reader
```

## Critical: get() vs value

| Access         | Tracks Dependencies | Use In                   |
| -------------- | ------------------- | ------------------------ |
| `signal.get()` | YES                 | Effects, Memos           |
| `signal.value` | NO                  | Outside reactive context |

```typescript
createEffect(() => {
  console.log(count.get()); // Creates dependency - effect re-runs on change
  console.log(count.value); // NO dependency - effect won't re-run!
});
```

**The `signal.value` property or `value(signal)` helper is for non-reactive reads only.**

## Signal Methods vs Functional API

**Prefer Signal methods** when you have the Signal object:

```typescript
const count = createSignal(0);
count.get(); // Preferred
count.set(1); // Preferred
count.value; // Preferred for non-reactive read
count.destroy(); // Preferred
count.touch(); // Preferred
```

**Use functional API** when you only have a SignalReader (the get function):

```typescript
const {get: count, set: setCount} = createSignal(0);
// 'count' is just the reader function, not the Signal object

value(count); // Non-reactive read
touch(count); // Force notification
destroySignal(count); // Destroy signal
```

## API Reference

### createSignal(initialValue?, options?)

```typescript
const signal = createSignal(0);
const signal = createSignal('hello', {lazy: true});
const signal = createSignal([1, 2, 3], {
  compare: (a, b) => a.length === b.length,
});
```

**Options:** See [references/options.md](references/options.md)

### Signal Methods

| Method                        | Description                                |
| ----------------------------- | ------------------------------------------ |
| `signal.get()`                | Read value (reactive, tracks dependencies) |
| `signal.set(value, options?)` | Write value (notifies dependents)          |
| `signal.value`                | Read/write value (non-reactive!)           |
| `signal.destroy()`            | Cleanup signal and notify dependents       |
| `signal.touch()`              | Force notification without changing value  |
| `signal.onChange(callback)`   | Subscribe to value changes                 |

### Functional API

| Function                    | Description              | When to use                              |
| --------------------------- | ------------------------ | ---------------------------------------- |
| `value(signal)`             | Non-reactive read        | Only have SignalReader                   |
| `touch(signal)`             | Force notification       | Only have SignalReader                   |
| `destroySignal(...signals)` | Destroy signals          | Only have SignalReader, or batch destroy |
| `muteSignal(signal)`        | Suppress notifications   | Temporary silence                        |
| `unmuteSignal(signal)`      | Resume notifications     | After mute                               |
| `isSignal(value)`           | Check if value is signal | Type guards                              |

## Common Patterns

### Destructuring Decision

```typescript
// Need methods? Keep the Signal object
const count = createSignal(0);
count.onChange((val) => console.log(val));
count.destroy();

// Only need get/set? Destructure
const {get: count, set: setCount} = createSignal(0);
// Use functional API for other operations: destroySignal(count)
```

### Typed Signals

```typescript
// Explicit type for undefined initial value
const user = createSignal<User | null>(null);

// Type inference works for defined values
const count = createSignal(0); // Signal<number>
```

### Muting Signals

```typescript
muteSignal(signal);
signal.set(newValue); // Value changes but NO notifications
unmuteSignal(signal);
signal.set(anotherValue); // NOW notifications fire
```

## Pitfalls to Avoid

### 1. Passing functions to .set() — the value IS the function

**There is NO updater-function pattern.** Unlike React's `setState`, `.set()` always stores the given value directly. If you pass a function, the signal's value **becomes that function**.

```typescript
const count = createSignal(0);

// BAD - signal value is now the function `s => s + 1`, NOT the number 1!
count.set((s) => s + 1);
console.log(count.value); // => [Function: s => s + 1]

// GOOD - always compute the new value yourself
count.set(count.value + 1);
console.log(count.value); // => 1
```

**Rule: Always use `signal.set(signal.value + x)` to update based on the current value.**

**Special case — `{lazy: true}`:** When you pass a function with the `lazy` option, the function is called lazily on the next read, and its **return value** becomes the signal value. This is an explicit opt-in and a different mechanism:

```typescript
count.set(() => expensiveCalc(), {lazy: true});
// The function is NOT stored as value.
// Instead, expensiveCalc() runs on the next .get() call,
// and its result becomes the signal value.
```

Without `{lazy: true}`, the function itself is always stored as the value.

### 2. Using .value inside effects

```typescript
// BAD - effect won't re-run when count changes!
createEffect(() => {
  console.log(count.value);
});

// GOOD
createEffect(() => {
  console.log(count.get());
});
```

### 3. Forgetting cleanup

```typescript
// Always destroy signals when done
const signal = createSignal(0);
// ... use signal ...
signal.destroy(); // or destroySignal(signal)
```

### 4. Lazy flag not inherited

```typescript
const {get, set} = createSignal(() => expensiveCalc(), {lazy: true});
set(() => anotherCalc()); // NOT lazy! Function stored as value (see pitfall #1)
set(() => anotherCalc(), {lazy: true}); // Lazy - function called on next read
```

For detailed options and patterns, see:

- [references/options.md](references/options.md) - All signal options
- [references/patterns.md](references/patterns.md) - Common usage patterns

## See Also

- [Developer Guide](https://raw.githubusercontent.com/spearwolf/signalize/refs/heads/main/docs/guide.md) - Comprehensive guide to all features
- [Full API Reference](https://raw.githubusercontent.com/spearwolf/signalize/refs/heads/main/docs/full-api.md) - Complete API documentation
- [Cheat Sheet](https://raw.githubusercontent.com/spearwolf/signalize/refs/heads/main/docs/cheat-sheet.md) - Quick reference
