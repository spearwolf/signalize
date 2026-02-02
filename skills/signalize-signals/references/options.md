# Signal Options Reference

## createSignal Options

```typescript
createSignal(initialValue, options?)
```

| Option    | Type                | Default | Description                     |
| --------- | ------------------- | ------- | ------------------------------- |
| `lazy`    | `boolean`           | `false` | Defer initial value computation |
| `compare` | `(a, b) => boolean` | `===`   | Custom equality check           |

## Lazy Signals

When `lazy: true`, the initial value must be a function that returns the actual value. The function is only called on first read.

```typescript
const signal = createSignal(
  () => {
    console.log('Computing...');
    return expensiveCalculation();
  },
  {lazy: true},
);

// 'Computing...' not logged yet

signal.get(); // NOW 'Computing...' is logged
signal.get(); // Cached, function not called again
```

### Lazy Set

To set a lazy value later, pass `{lazy: true}` to `set()`:

```typescript
const signal = createSignal(() => 'initial', {lazy: true});

// Update with new lazy function
signal.set(() => 'updated', {lazy: true});

// WITHOUT lazy option - function is stored as value!
signal.set(() => 'oops'); // BAD: signal.get() returns the function itself
```

**Important:** Laziness is NOT inherited. Each `set()` call needs explicit `{lazy: true}`.

## Custom Compare Function

By default, signals use `===` for equality. Custom comparators let you control when updates trigger notifications.

```typescript
// Array comparison by length
const items = createSignal([1, 2, 3], {
  compare: (a, b) => a.length === b.length,
});

items.set([4, 5, 6]); // No notification (same length)
items.set([1, 2]); // Notification (different length)
```

### Deep Equality Example

```typescript
const data = createSignal(
  {x: 1, y: 2},
  {
    compare: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  },
);
```

### Per-Set Override

Override the comparison for a single `set()` call:

```typescript
const signal = createSignal([1, 2, 3], {
  compare: (a, b) => a.every((v, i) => v === b[i]),
});

// Force update even if "equal"
signal.set([1, 2, 3], {compare: () => false});

// Force skip even if "different"
signal.set([4, 5, 6], {compare: () => true});
```

**IMPORTANT:** Please never use comparison override—it's too confusing, even if it's syntactically okay!

## set() Options

```typescript
signal.set(value, options?)
```

| Option    | Type                | Description                                      |
| --------- | ------------------- | ------------------------------------------------ |
| `lazy`    | `boolean`           | If true, value is a function called on next read |
| `compare` | `(a, b) => boolean` | Override signal's compare for this set only      |

## Combined Example

```typescript
const config = createSignal(
  () => loadConfigFromDisk(), // Lazy initial load
  {
    lazy: true,
    compare: (a, b) => a.version === b.version, // Only update on version change
  },
);

// First read triggers load
const currentConfig = config.get();

// Update with new lazy loader
config.set(() => reloadConfig(), {lazy: true});

// Force immediate value (not lazy)
config.set({version: '2.0', data: newData});
```
