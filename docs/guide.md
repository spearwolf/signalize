# Developer Guide

This guide provides a comprehensive overview of `@spearwolf/signalize`, organized by domain. It covers everything from basic usage to advanced patterns.

## Table of Contents

- [Signals](#signals)
- [Effects](#effects)
- [Memos (Computed Values)](#memos-computed-values)
- [Links (Signal Connections)](#links-signal-connections)
- [Decorators (Class API)](#decorators-class-api)
- [Utilities](#utilities)
- [Advanced Patterns](#advanced-patterns)

---

## Signals

Signals are the core primitive of reactivity. They hold a value and notify subscribers when that value changes.

### Creating a Signal

Use `createSignal` to create a new signal.

```typescript
import {createSignal} from '@spearwolf/signalize';

const count = createSignal(0);
const user = createSignal({name: 'Alice'});
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
  compare: (a, b) => JSON.stringify(a) === JSON.stringify(b),
});

list.set([1, 2]); // Will NOT trigger effects because values are "equal"
```

### Muting Signals

You can temporarily silence a signal so it doesn't trigger effects, even if its value changes.

```typescript
import {muteSignal, unmuteSignal} from '@spearwolf/signalize';

muteSignal(count);
count.set(100); // No effects run
unmuteSignal(count);
```

---

## Effects

Effects are functions that run in response to signal changes. They are the "observers" of your reactive system.

### Creating an Effect

```typescript
import {createEffect} from '@spearwolf/signalize';

createEffect(() => {
  console.log('Count is:', count.get());
});
```

### Dynamic vs. Static Effects

When creating an effect, you can choose between two modes of dependency tracking: **Dynamic** (the default) and **Static**.

#### Dynamic Effects (Auto-tracking)

By default, `createEffect` tracks dependencies dynamically. This means it listens to _every_ signal that is read (using `.get()`) during the execution of the function.

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

1. Initially, `showDetails` is `false`. The effect runs, reads `showDetails`, prints "Hidden". It _only_ subscribes to `showDetails`.
2. If `details` changes, the effect does **not** run (because it's not currently subscribed).
3. If `showDetails` becomes `true`, the effect runs, reads `showDetails` AND `details`. Now it subscribes to _both_.
4. Now if `details` changes, the effect _will_ run.

#### Static Effects (Explicit Dependencies)

Sometimes you want an effect to run _only_ when specific signals change, regardless of what other signals it reads. You can achieve this by passing a `dependencies` array in the options.

```typescript
const trigger = createSignal(0);
const data = createSignal('A');

createEffect(() => {
  // This effect runs ONLY when `trigger` changes.
  // It reads `data.get()`, but does NOT subscribe to it.
  console.log(`Trigger ${trigger.get()} fired with data: ${data.get()}`);
}, [trigger]);
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

You can create effects inside other effects. Child effects are automatically destroyed (with their cleanup callbacks called) when the parent effect re-runs or is destroyed.

```typescript
createEffect(() => {
  if (user.get()) {
    // This effect is created only when user exists
    // It will be destroyed and recreated when the outer effect re-runs
    createEffect(() => {
      console.log('User details:', user.get().details);
      return () => console.log('Inner effect cleanup');
    });
  }

  return () => console.log('Outer effect cleanup');
});
```

When the outer effect re-runs (e.g., when `user` changes), the sequence is:

1. Outer cleanup runs
2. Inner cleanup runs (inner effect is destroyed)
3. Outer effect callback executes
4. Inner effect is recreated and runs

---

## Memos (Computed Values)

Memos are signals that are derived from other signals. They are useful for caching expensive computations.

```typescript
import {createMemo} from '@spearwolf/signalize';

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
const heavy = createMemo(() => heavyComputation(), {lazy: true});
```

---

## Links (Signal Connections)

Links are the fourth core concept in `@spearwolf/signalize`, enabling you to build modular, graph-like reactive architectures. Inspired by visual programming tools like Unreal Engine's Blueprints and Blender's shader graph editor, links create explicit one-way data flows between signals.

### Why Use Links?

While effects are perfect for side effects (DOM updates, logging, API calls), **links excel at propagating state between signals** in a structured way. They provide:

- **Explicit data flow**: Clear input/output relationships like wires in a visual graph
- **Modular architecture**: Build reusable signal modules that connect together
- **Lifecycle management**: Group related signals and links for easy cleanup
- **Declarative connections**: No manual effect wiring needed

### Basic Link Usage

Create a link to automatically sync a source signal to a target:

```typescript
import {createSignal, link} from '@spearwolf/signalize';

const source = createSignal(10);
const target = createSignal(0);

// Create a one-way connection: source → target
const connection = link(source, target);

console.log(target.value); // => 10 (synced immediately)

source.set(42);
console.log(target.value); // => 42 (target updates automatically)

// Clean up when done
connection.destroy();
```

### Links to Callbacks

You can also link signals to callback functions for custom handling:

```typescript
const temperature = createSignal(20);

const connection = link(temperature, (temp) => {
  console.log(`Temperature: ${temp}°C`);
});
// => "Temperature: 20°C"

temperature.set(25);
// => "Temperature: 25°C"
```

### Building Modular Architectures with SignalGroup

`SignalGroup` is essential for organizing signals into modules or nodes. It manages the lifecycle of signals, effects, and links as a cohesive unit:

```typescript
import {SignalGroup, createSignal, link} from '@spearwolf/signalize';

// Create a module/node
class AudioNode {
  group = SignalGroup.findOrCreate(this);

  // Inputs
  input = createSignal(0, {attach: this});

  // Outputs
  output = createSignal(0, {attach: this});

  constructor() {
    // Internal processing
    link(this.input, this.output, {attach: this});
  }

  destroy() {
    this.group.clear(); // Destroys all signals and links
  }
}

// Create and connect nodes
const nodeA = new AudioNode();
const nodeB = new AudioNode();

// Connect nodes: nodeA.output → nodeB.input
link(nodeA.output, nodeB.input);

nodeA.input.set(100);
console.log(nodeB.output.value); // => 100

// Clean up
nodeA.destroy();
nodeB.destroy();
```

### Named Signals in Groups

Groups support named signals for module-level inputs/outputs:

```typescript
const group = SignalGroup.findOrCreate({});

const volume = createSignal(0.5);
group.attachSignalByName('volume', volume);

// Access by name
const vol = group.signal('volume');
vol.set(0.8);
```

### Link Control

Links provide fine-grained control:

```typescript
const connection = link(source, target);

// Pause/resume
connection.mute();
source.set(999); // target doesn't update
connection.unmute();

// Force sync
connection.touch();

// Check status
console.log(connection.isMuted); // => false
console.log(connection.lastValue); // => last synced value
```

### Async Value Iteration

Links support async patterns for reactive programming:

```typescript
const counter = createSignal(0);
const display = createSignal(0);
const connection = link(counter, display);

// Wait for next value
const nextValue = await connection.nextValue();

// Iterate until condition
for await (const value of connection.asyncValues((v) => v >= 10)) {
  console.log(value);
}
```

### Use Cases

**Game Engines & Audio Processing**

- Build node-based processing graphs
- Connect audio/visual effect modules
- Manage complex state pipelines

**Plugin Architectures**

- Define clear module interfaces
- Connect plugins via input/output signals
- Hot-reload modules without breaking connections

**Data Flow Visualization**

- Represent reactive graphs visually
- Debug complex state flows
- Build visual programming tools

### Best Practices

1. **Use links for state propagation between modules**
   - Not for side effects (use effects instead)
2. **Organize related signals in SignalGroups**
   - Makes lifecycle management simple
   - Enables hierarchical architectures
3. **Name your signals in groups**
   - Provides clear module interfaces
   - Enables dynamic signal lookup

4. **Clean up with group.clear()**
   - Destroys all signals, effects, and links together
   - Prevents memory leaks

---

## Decorators (Class API)

If you use classes, decorators provide a clean syntax.

**Import from `@spearwolf/signalize/decorators`.**

> [!IMPORTANT]
> The decorator API is still in the early stages of development and is not yet complete.
> It only uses the new JavaScript standard decorators, not the legacy or experimental TypeScript ones.

```typescript
import {signal, memo} from '@spearwolf/signalize/decorators';

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
import {batch} from '@spearwolf/signalize';

batch(() => {
  firstName.set('Jane');
  lastName.set('Smith');
  // Effects will only run ONCE after this block finishes
});
```

### `beQuiet`

Run code without tracking dependencies.

```typescript
import {beQuiet} from '@spearwolf/signalize';

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
import {hibernate, batch} from '@spearwolf/signalize';

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
import {findObjectSignalByName} from '@spearwolf/signalize';

const sig = findObjectSignalByName(myObject, 'propertyName');
```
