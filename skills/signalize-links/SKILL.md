---
name: signalize-links
description: 'Signal-to-signal connections for @spearwolf/signalize: link/unlink for one-way data flow, SignalLink class for mute/unmute/touch control, async patterns (nextValue, asyncValues). Use when connecting signals or creating data flow pipelines.'
---

# Signalize Links

## Overview

Links create **one-way data flow** connections between signals. When the source signal changes, the target is automatically updated.

```typescript
import {createSignal, link, unlink} from '@spearwolf/signalize';

const source = createSignal(1);
const target = createSignal(0);

link(source, target);

source.set(42);
target.get(); // 42 (automatically synced)
```

## Quick Start

### Signal-to-Signal

```typescript
const a = createSignal(1);
const b = createSignal(0);

const connection = link(a, b);

a.set(10);
b.get(); // 10

connection.destroy(); // Remove link
```

### Signal-to-Callback

```typescript
const signal = createSignal(1);

link(signal, (value) => {
  console.log('Value changed:', value);
});
// Immediately logs: "Value changed: 1"

signal.set(2);
// Logs: "Value changed: 2"
```

## link() API

```typescript
link(source, target, options?)
```

**Source** can be:

- `Signal<T>` object
- `SignalReader<T>` (the get function)

**Target** can be:

- `Signal<T>` object
- `SignalReader<T>` (the get function)
- `(value: T) => void` callback

**Options:**

| Option   | Type                    | Description                        |
| -------- | ----------------------- | ---------------------------------- |
| `attach` | `object \| SignalGroup` | Attach link to group for lifecycle |

```typescript
// All these forms work
link(signalA, signalB);
link(signalA.get, signalB);
link(signalA, signalB.get);
link(signalA.get, signalB.get);
link(signalA, callback);
```

## SignalLink Methods

The `link()` function returns a `SignalLink` object:

| Method                 | Returns             | Description                          |
| ---------------------- | ------------------- | ------------------------------------ |
| `destroy()`            | `void`              | Remove the link permanently          |
| `mute()`               | `this`              | Pause value propagation              |
| `unmute()`             | `this`              | Resume value propagation             |
| `toggleMute()`         | `boolean`           | Toggle mute state, returns new state |
| `touch()`              | `this`              | Force value propagation              |
| `attach(obj)`          | `SignalGroup`       | Attach to group for lifecycle        |
| `nextValue()`          | `Promise<T>`        | Promise that resolves on next change |
| `asyncValues(stopFn?)` | `AsyncGenerator<T>` | Async iterator over future values    |

## SignalLink Properties

| Property      | Type             | Description                        |
| ------------- | ---------------- | ---------------------------------- |
| `isDestroyed` | `boolean`        | Whether link has been destroyed    |
| `isMuted`     | `boolean`        | Whether link is currently muted    |
| `lastValue`   | `T \| undefined` | Last value propagated through link |

## Muting and Unmuting

Temporarily pause value propagation:

```typescript
const conn = link(source, target);

conn.mute();
source.set(100);
target.get(); // Still old value - link is muted

conn.unmute();
source.set(200);
target.get(); // 200 - link is active again
```

**Note:** Muting does NOT retroactively apply missed values. After unmute, only new changes propagate.

## Touch for Force Sync

Force the current value to propagate:

```typescript
const conn = link(source, target);

// Later: force sync without changing source
conn.touch();
```

## unlink()

Remove links:

```typescript
// Remove specific link
unlink(source, target);

// Remove ALL links from source
unlink(source);
```

## Singleton Behavior

Creating the same link twice returns the same instance:

```typescript
const conn1 = link(a, b);
const conn2 = link(a, b);

conn1 === conn2; // true - same link!
```

## Immediate Sync

When a link is created, the target **immediately** receives the source's current value:

```typescript
const source = createSignal(42);
const target = createSignal(0);

link(source, target);

target.get(); // 42 - immediately synced!
```

## Lifecycle with SignalGroup

```typescript
const group = SignalGroup.findOrCreate(this);

link(source, target, {attach: group});

// Later: clearing the group destroys the link
group.clear();
```

## Async Patterns

See [references/async-patterns.md](references/async-patterns.md) for:

- `nextValue()` - Promise for next value
- `asyncValues()` - Async iterator

## Common Patterns

### Data Pipeline

```typescript
const raw = createSignal('');
const trimmed = createSignal('');
const validated = createSignal(false);

link(raw, (v) => trimmed.set(v.trim()));
link(trimmed, (v) => validated.set(v.length > 0));
```

### Two-Way Binding (Manual)

```typescript
const a = createSignal(0);
const b = createSignal(0);

// A → B
link(a, b);

// B → A (careful: avoid infinite loops)
link(b, (val) => {
  if (a.value !== val) a.set(val);
});
```

### Conditional Link

```typescript
const conn = link(source, target);

// Disable when not needed
if (shouldPause) {
  conn.mute();
} else {
  conn.unmute();
}
```

## Pitfalls to Avoid

### 1. Forgetting link is immediate

```typescript
const source = createSignal(42);
const target = createSignal(0);

// Target is IMMEDIATELY updated to 42
link(source, target);
```

### 2. Operations on destroyed link

```typescript
const conn = link(a, b);
conn.destroy();

// These are safe (no-op) but don't do anything
conn.mute();
conn.touch();
```

### 3. Mute doesn't queue values

```typescript
conn.mute();
source.set(1);
source.set(2);
source.set(3);
conn.unmute();
// target only gets future values, not 1, 2, or 3
```

### 4. Destroying target destroys link

```typescript
const conn = link(a, b);
destroySignal(b);

conn.isDestroyed; // true - link auto-destroyed!
```

## Cleanup

Always clean up links:

```typescript
// Option 1: Destroy directly
conn.destroy();

// Option 2: Unlink
unlink(source, target);

// Option 3: SignalGroup
group.clear();

// Option 4: Destroy source signal
destroySignal(source); // All links from source destroyed
```
