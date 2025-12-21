# Developer Guide

This guide provides a comprehensive overview of `@spearwolf/signalize`, organized by domain. It covers everything from basic usage to advanced patterns.

## Table of Contents

- [Signals](#signals)
- [Effects](#effects)
- [Memos (Computed Values)](#memos-computed-values)
- [Decorators (Class API)](#decorators-class-api)
- [Utilities](#utilities)
- [Advanced Patterns](#advanced-patterns)

---

## Signals

Signals are the core primitive of reactivity. They hold a value and notify subscribers when that value changes.

### Creating a Signal

Use `createSignal` to create a new signal.

```typescript
import { createSignal } from '@spearwolf/signalize';

const count = createSignal(0);
const user = createSignal({ name: 'Alice' });
```

### Reading Values

There are two ways to read a signal, and the distinction is crucial:

1.  **`signal.get()`**: Reads the value **AND** tracks it as a dependency if called inside an effect.
2.  **`signal.value`**: Reads the value **WITHOUT** tracking it.

```typescript
createEffect(() => {
  // This effect will re-run when `count` changes
  console.log(count.get());

  // This effect will NOT re-run when `user` changes, but it can still read the current value
  console.log(user.value);
});
```

### Writing Values

You can update a signal using `.set()` or the `.value` setter.

```typescript
count.set(1);
count.value = 2; // Equivalent to .set(2)
```

### Custom Equality

By default, signals use strict equality (`===`) to check if a value has changed. You can provide a custom `compare` function.

```typescript
const list = createSignal([1, 2], {
  compare: (a, b) => JSON.stringify(a) === JSON.stringify(b)
});

list.set([1, 2]); // Will NOT trigger effects because values are "equal"
```

### Muting Signals

You can temporarily silence a signal so it doesn't trigger effects, even if its value changes.

```typescript
import { muteSignal, unmuteSignal } from '@spearwolf/signalize';

muteSignal(count);
count.set(100); // No effects run
unmuteSignal(count);
```

---

## Effects

Effects are functions that run in response to signal changes. They are the "observers" of your reactive system.

### Creating an Effect

```typescript
import { createEffect } from '@spearwolf/signalize';

createEffect(() => {
  console.log('Count is:', count.get());
});
```

### Dynamic vs. Static Effects

When creating an effect, you can choose between two modes of dependency tracking: **Dynamic** (the default) and **Static**.

#### Dynamic Effects (Auto-tracking)

By default, `createEffect` tracks dependencies dynamically. This means it listens to *every* signal that is read (using `.get()`) during the execution of the function.

Crucially, the dependencies are recalculated every time the effect runs. This allows for conditional dependencies.

```typescript
const showDetails = createSignal(false);
const details = createSignal('Secret Info');

createEffect(() => {
  // Always depends on `showDetails`
  if (showDetails.get()) {
    // Only depends on `details` IF `showDetails` is true
    console.log(details.get());
  } else {
    console.log('Hidden');
  }
});
```

In this example:
1. Initially, `showDetails` is `false`. The effect runs, reads `showDetails`, prints "Hidden". It *only* subscribes to `showDetails`.
2. If `details` changes, the effect does **not** run (because it's not currently subscribed).
3. If `showDetails` becomes `true`, the effect runs, reads `showDetails` AND `details`. Now it subscribes to *both*.
4. Now if `details` changes, the effect *will* run.

#### Static Effects (Explicit Dependencies)

Sometimes you want an effect to run *only* when specific signals change, regardless of what other signals it reads. You can achieve this by passing a `dependencies` array in the options.

```typescript
const trigger = createSignal(0);
const data = createSignal('A');

createEffect(() => {
  // This effect runs ONLY when `trigger` changes.
  // It reads `data.get()`, but does NOT subscribe to it.
  console.log(`Trigger ${trigger.get()} fired with data: ${data.get()}`);
}, { dependencies: [trigger] });
```

**Use cases for Static Effects:**
- **Performance optimization**: Prevent re-running expensive effects when minor data changes.
- **Explicit control**: When you want to treat some signals as "triggers" and others as just "data".
- **Avoiding loops**: When you need to read a signal that you might also be writing to (though `beQuiet` is often better for this).

> **Note:** When you provide `dependencies`, automatic tracking is completely disabled for that effect.

### Cleanup

Effects can return a cleanup function. This is useful for clearing timers, event listeners, or subscriptions.

```typescript
createEffect(() => {
  const timer = setInterval(() => console.log('Tick'), 1000);

  // Cleanup function
  return () => clearInterval(timer);
});
```

### Nested Effects

You can create effects inside other effects. Child effects are automatically destroyed when the parent effect re-runs or is destroyed.

```typescript
createEffect(() => {
  if (user.get()) {
    // This effect is created only when user exists
    createEffect(() => console.log('User details:', user.get().details));
  }
});
```

---

## Memos (Computed Values)

Memos are signals that are derived from other signals. They are useful for caching expensive computations.

```typescript
import { createMemo } from '@spearwolf/signalize';

const firstName = createSignal('John');
const lastName = createSignal('Doe');

const fullName = createMemo(() => {
  return `${firstName.get()} ${lastName.get()}`;
});

console.log(fullName()); // "John Doe"
```

### Lazy vs. Eager

- **Eager (Default for `createMemo` without options)**: Calculates immediately and updates whenever dependencies change.
- **Lazy (`lazy: true`)**: Only calculates when you read it.

```typescript
const heavy = createMemo(() => heavyComputation(), { lazy: true });
```

---

## Decorators (Class API)

If you use classes, decorators provide a clean syntax.

**Note**: Import from `@spearwolf/signalize/decorators`.

```typescript
import { signal, memo } from '@spearwolf/signalize/decorators';

class Character {
  @signal() accessor health = 100;
  @signal() accessor name = 'Hero';

  @memo()
  status() {
    return `${this.name} has ${this.health} HP`;
  }
}
```

- **`@signal()`**: Applied to an `accessor` field. Creates a signal under the hood.
- **`@memo()`**: Applied to a method. Turns it into a computed property.

---

## Utilities

### `batch`

Group multiple updates into a single re-render cycle.

> **Note:** `batch()` is a **hint**, not a strict guarantee. While it typically defers effects until the batch completes, the library may still choose to propagate some signal changes in steps if necessary for internal consistency or other reasons.

```typescript
import { batch } from '@spearwolf/signalize';

batch(() => {
  firstName.set('Jane');
  lastName.set('Smith');
  // Effects will only run ONCE after this block finishes
});
```

### `beQuiet`

Run code without tracking dependencies.

```typescript
import { beQuiet } from '@spearwolf/signalize';

createEffect(() => {
  // Read `count` without subscribing to it
  const val = beQuiet(() => count.get());
  console.log(val);
});
```

### `hibernate`

Temporarily suspends all reactive context (batching, tracking, etc.) while executing a callback. This allows code inside the callback to run as if it were called at the top level, without any outer context influencing its behavior.

**Crucially, while the outer context is suspended, you are free to create new contexts within the callback.** For example, you can start a new `batch()` or create a new effect that tracks its own dependencies, completely isolated from the surrounding code.

```typescript
import { hibernate, batch } from '@spearwolf/signalize';

createEffect(() => {
  // ...
  hibernate(() => {
    // Code here runs without tracking dependencies from the outer effect
    // and without being affected by any active batch()

    // You CAN create new contexts here:
    batch(() => {
        // This batch works as expected
    });
  });
});
```

---

## Connections between Signals

### `link`

Connect a source signal to a target signal (or callback).

```typescript
import { link } from '@spearwolf/signalize';

const source = createSignal(1);
const target = createSignal(0);

link(source, target); // target will now mirror source
```

### `SignalGroup`

Manage the lifecycle of multiple signals and effects. Useful for components.

```typescript
import { SignalGroup } from '@spearwolf/signalize';

const group = SignalGroup.findOrCreate(myComponent);

// Attach resources to the group
createEffect(() => { ... }, { attach: group });

// Clean up everything at once
group.clear();
```

### `SignalAutoMap`

A map that automatically creates signals for keys when they are accessed. Great for dynamic collections.

```typescript
import { SignalAutoMap } from '@spearwolf/signalize';

const settings = new SignalAutoMap();

// Automatically creates a signal for 'theme'
createEffect(() => console.log(settings.get('theme').get()));

settings.get('theme').set('dark');
```

---

## Advanced Patterns

### Avoiding Circular Dependencies

Be careful not to create loops where Effect A updates Signal X, which triggers Effect B, which updates Signal Y, which triggers Effect A.

---

## Object Signals
- Use **Memos** for derived state instead of syncing signals with effects.
- Use `batch` or `beQuiet` to control updates.

### Object Signals API

For advanced use cases (like building custom decorators), you can interact with signals attached to objects directly.

```typescript
import { findObjectSignalByName } from '@spearwolf/signalize';

const sig = findObjectSignalByName(myObject, 'propertyName');
```
