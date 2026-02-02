---
name: signalize-effects
description: 'Reactive side effects for @spearwolf/signalize: createEffect, cleanup callbacks, dependency tracking (dynamic and static), effect priority, autorun options, nested effects. Use when creating effects that react to signal changes.'
---

# Signalize Effects

## Quick Start

```typescript
import {createEffect, createSignal} from '@spearwolf/signalize';

const count = createSignal(0);

const effect = createEffect(() => {
  console.log('Count:', count.get());
});

count.set(1); // Logs: "Count: 1"
effect.destroy(); // Cleanup and stop
```

## Cleanup Callbacks (Critical!)

Return a function from your effect to handle cleanup. This is essential for managing resources like timers, subscriptions, or event listeners.

```typescript
createEffect(() => {
  const timer = setInterval(() => tick(), 1000);

  // Called BEFORE every re-run AND on destroy
  return () => clearInterval(timer);
});
```

**When cleanup runs:**

| Event                              | Cleanup Called  |
| ---------------------------------- | --------------- |
| Dependency changes (before re-run) | YES             |
| `effect.destroy()`                 | YES             |
| Signal destroyed (last dependency) | YES             |
| Multiple `destroy()` calls         | Only first time |

See [references/cleanup.md](references/cleanup.md) for comprehensive patterns.

## Dynamic vs Static Effects

### Dynamic Effects (Default)

Dependencies are recalculated on **every run** based on which signals are read:

```typescript
createEffect(() => {
  if (showDetails.get()) {
    console.log(details.get()); // Only tracked when showDetails is true
  } else {
    console.log(summary.get()); // Only tracked when showDetails is false
  }
});
// Dependencies CHANGE based on showDetails value
```

**Characteristics:**

- Runs immediately on creation
- Dependencies can change between runs
- Most flexible, recommended for most cases

### Static Effects

Dependencies are fixed at creation time:

```typescript
createEffect(() => {
  console.log(a.get(), b.get());
}, [a, b]); // Explicit dependency array
```

**Characteristics:**

- Does NOT run immediately
- Dependencies never change
- Call `.run()` if you need initial execution

```typescript
const effect = createEffect(callback, [a, b]);
effect.run(); // Manual initial run if needed
```

See [references/dynamic-static.md](references/dynamic-static.md) for detailed comparison.

## Effect Options

```typescript
createEffect(callback, options?)
createEffect(callback, dependencies, options?)
```

| Option     | Type                    | Default | Description                      |
| ---------- | ----------------------- | ------- | -------------------------------- |
| `autorun`  | `boolean`               | `true`  | Run immediately on creation      |
| `priority` | `number`                | `0`     | Execution order (higher = first) |
| `attach`   | `object \| SignalGroup` | -       | Attach to group for lifecycle    |

### autorun: false

```typescript
const effect = createEffect(
  () => {
    console.log(signal.get());
  },
  {autorun: false},
);

// Effect not running yet
signal.set(1); // Still not running

effect.run(); // NOW it runs and starts tracking
```

Very useful when you need to precisely control when an effect callback should run, e.g., only within an animation frame.

### priority

Higher priority effects run first:

```typescript
createEffect(first, {priority: 1000}); // Runs first
createEffect(second, {priority: 0}); // Runs second (default)
createEffect(last, {priority: -100}); // Runs last
```

**Default priorities:**

- Memos: `1000` (run before effects)
- Effects: `0`

This ensures memos compute before effects that depend on them.

**HINT:** The priority also influences the effect execution order after batching.

## Nested Effects

Effects can create other effects. Inner effects are isolated from outer:

```typescript
createEffect(() => {
  console.log('Outer:', a.get());

  createEffect(() => {
    console.log('Inner:', b.get());
  });
});
```

**Critical behavior:** When outer effect re-runs, inner effects are **recreated**, not re-run.

See [references/cleanup.md](references/cleanup.md) for nested cleanup patterns.

## Effect Methods

| Method             | Description                 |
| ------------------ | --------------------------- |
| `effect.run()`     | Manually trigger execution  |
| `effect.destroy()` | Stop effect and run cleanup |

## Lifecycle Hooks

Subscribe to global effect events:

**IMPORTANT:** Please only use if there is no other solution, as these global hooks can cause performance issues. They are originally intended for testing purposes only.

```typescript
import {onCreateEffect, onDestroyEffect} from '@spearwolf/signalize';

const unsubCreate = onCreateEffect((effect) => {
  console.log('Effect created');
});

const unsubDestroy = onDestroyEffect((effect) => {
  console.log('Effect destroyed');
});

// Later: unsubscribe
unsubCreate();
unsubDestroy();
```

See [references/lifecycle.md](references/lifecycle.md) for details.

## Common Patterns

### Resource Management

```typescript
createEffect(() => {
  const subscription = api.subscribe(topic.get());
  return () => subscription.unsubscribe();
});
```

### DOM Updates

```typescript
createEffect(() => {
  element.textContent = message.get();
});
```

### Derived Actions

```typescript
createEffect(() => {
  if (isLoggedIn.get()) {
    loadUserData();
  } else {
    clearUserData();
  }
});
```

## Pitfalls to Avoid

### 1. Missing cleanup for resources

```typescript
// BAD - memory leak!
createEffect(() => {
  setInterval(() => tick(), 1000);
});

// GOOD
createEffect(() => {
  const id = setInterval(() => tick(), 1000);
  return () => clearInterval(id);
});
```

### 2. Expecting static effect to run initially

```typescript
// This does NOT run on creation
createEffect(callback, [a, b]);

// Add .run() if needed
createEffect(callback, [a, b]).run();
```

### 3. Reading signal with .value in effect

```typescript
// BAD - no dependency tracking
createEffect(() => {
  console.log(signal.value); // Won't re-run on change!
});

// GOOD
createEffect(() => {
  console.log(signal.get());
});
```

For detailed patterns, see:

- [references/cleanup.md](references/cleanup.md) - Cleanup patterns
- [references/dynamic-static.md](references/dynamic-static.md) - Dynamic vs Static
- [references/lifecycle.md](references/lifecycle.md) - Lifecycle hooks
