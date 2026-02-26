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

### Lazy Effects

By default, an effect runs its callback immediately upon creation and re-runs automatically whenever a tracked signal changes. Sometimes, however, you want explicit control over _when_ the callback executes. This is what **lazy effects** are for.

Set `autorun: false` to create a lazy effect:

```typescript
const position = createSignal({x: 0, y: 0});

const effect = createEffect(
  () => {
    const pos = position.get();
    renderSprite(pos.x, pos.y);
  },
  {autorun: false},
);
```

With `autorun: false`, two things change:

1. **No immediate execution.** The callback is _not_ called when the effect is created.
2. **No automatic re-runs.** When a tracked signal changes, the effect notes that it needs to run (internally setting a `shouldRun` flag), but does _not_ execute the callback.

The effect only runs when you call `effect.run()` manually — and only if at least one dependency has actually changed since the last execution:

```typescript
function gameLoop() {
  // Update signals from input, physics, etc.
  position.set({x: player.x, y: player.y});

  // Run the effect — but only if `position` actually changed
  effect.run();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
```

This pattern is particularly useful when you need to synchronize reactive updates with an external timing mechanism:

- **`requestAnimationFrame`** — render only once per frame, even if signals change multiple times
- **Timers / intervals** — batch reactive updates into fixed time steps
- **Manual triggers** — run effects in response to user actions or lifecycle events

> **Tip:** A lazy effect still tracks dependencies like a normal effect. The only difference is _when_ the callback runs. On the first call to `effect.run()`, dependencies are discovered through automatic tracking (or set via `dependencies`), and from then on, `run()` only executes if something has changed.

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

### Effect Options

`createEffect` accepts an options object as its second argument (or as the third argument when passing a dependencies array). Here is the full list of available options:

| Option         | Type                    | Default     | Description                                                                                                                                |
| -------------- | ----------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `autorun`      | `boolean`               | `true`      | Whether the effect runs automatically on creation and when dependencies change. Set to `false` for [lazy effects](#lazy-effects).          |
| `dependencies` | `Array`                 | `undefined` | Explicit list of signal dependencies. Disables automatic dependency tracking. See [Static Effects](#static-effects-explicit-dependencies). |
| `priority`     | `number`                | `0`         | Execution priority. Higher values run first.                                                                                               |
| `attach`       | `object \| SignalGroup` | `undefined` | Attach the effect to a `SignalGroup` for lifecycle management.                                                                             |

#### Priority

When multiple effects depend on the same signal, **priority** determines the order in which they execute. Effects with a higher numeric priority run first.

```typescript
const data = createSignal('initial');

createEffect(
  () => {
    console.log('Low priority:', data.get());
  },
  {priority: 0},
);

createEffect(
  () => {
    console.log('High priority:', data.get());
  },
  {priority: 100},
);

data.set('updated');
// => "High priority: updated"
// => "Low priority: updated"
```

Priority also affects ordering inside a `batch()`: when the batch completes, queued effects are flushed in descending priority order.

> **Note:** Memos use a default priority of `1000`, which ensures they recompute _before_ regular effects. This means that when an effect reads a memo, the memo's value is always up-to-date.

#### Attach

The `attach` option connects an effect to a `SignalGroup`, enabling automatic lifecycle management. When the group is cleared (`group.clear()`), all attached effects are destroyed.

```typescript
import {SignalGroup, createSignal, createEffect} from '@spearwolf/signalize';

class GameEntity {
  group = SignalGroup.findOrCreate(this);
  health = createSignal(100, {attach: this});

  constructor() {
    createEffect(
      () => {
        console.log('Health:', this.health.get());
      },
      {attach: this},
    );
  }

  destroy() {
    this.group.clear(); // destroys the signal AND the effect
  }
}
```

When `attach` is used together with `dependencies`, you can reference signals by name (string or symbol) instead of by direct reference:

```typescript
const group = SignalGroup.findOrCreate(myObject);
const speed = createSignal(10, {attach: myObject});
group.attachSignalByName('speed', speed);

createEffect(
  () => {
    console.log('Speed changed:', speed.get());
  },
  ['speed'],
  {attach: myObject},
);
```

### The Effect Object

`createEffect()` returns an `Effect` object with two methods:

#### `effect.run()`

Manually executes the effect callback. The callback only runs if at least one dependency has changed since the last execution — calling `run()` on an effect whose dependencies haven't changed is a no-op.

If called inside a `batch()`, the execution is deferred until the batch completes (respecting priority ordering).

```typescript
const count = createSignal(0);

const effect = createEffect(
  () => {
    console.log('Count:', count.get());
  },
  {autorun: false},
);

count.set(5);
effect.run(); // => "Count: 5"

effect.run(); // nothing happens — count hasn't changed

count.set(10);
effect.run(); // => "Count: 10"
```

#### `effect.destroy()`

Destroys the effect and cleans up all resources:

1. The cleanup callback (if any) is executed.
2. All child effects (from nested `createEffect()` calls) are destroyed.
3. All signal subscriptions are removed.
4. The effect is detached from its `SignalGroup` (if attached).

After calling `destroy()`, the effect is inert — calling `run()` has no effect.

```typescript
const effect = createEffect(() => {
  const timer = setInterval(() => tick(), 1000);
  return () => clearInterval(timer); // cleanup
});

// Later, when no longer needed:
effect.destroy(); // cleanup runs, subscriptions removed
```

---

## Memos (Computed Values)

Memos are signals that are derived from other signals. They combine the reactivity of effects with the read interface of signals, and they cache their result so the computation only runs when dependencies actually change.

```typescript
import {createMemo} from '@spearwolf/signalize';

const firstName = createSignal('John');
const lastName = createSignal('Doe');

const fullName = createMemo(() => {
  return `${firstName.get()} ${lastName.get()}`;
});

console.log(fullName()); // "John Doe"
```

### Non-Lazy vs. Lazy Memos

When creating a memo, you can choose between two recomputation strategies using the `lazy` option. The right choice depends on how the memo is used in your reactive system.

#### Non-Lazy (Default)

By default, a memo is **non-lazy** (`lazy: false`). This means it behaves as a **computed signal**: it recalculates immediately whenever any of its signal dependencies change — even before anyone reads the new value.

This is essential when **effects depend on the memo**. Because the memo eagerly updates, it triggers dependent effects just like a regular signal would. If your reactive graph looks like _Signal → Memo → Effect_, the non-lazy memo ensures the effect always sees the latest computed value and re-runs as expected.

```typescript
const price = createSignal(100);
const taxRate = createSignal(0.2);

// Non-lazy: recalculates immediately when `price` or `taxRate` changes
const total = createMemo(() => price.get() * (1 + taxRate.get()));

// This effect depends on `total` — it re-runs when `total` updates
createEffect(() => {
  console.log('Total:', total());
});
// => "Total: 120"

price.set(200);
// `total` recalculates immediately (now 240), then the effect re-runs
// => "Total: 240"
```

**Choose non-lazy when:**

- Effects or other memos read this memo as a dependency
- You need the memo to act as a computed signal in a reactive chain
- The value should always be up-to-date, even before it is read

#### Lazy

A lazy memo (`lazy: true`) **does not react** to dependency changes. Instead, it defers recomputation to the moment the memo is actually **read**. The recalculation happens at the latest possible point in time.

Because the memo does not eagerly update its underlying signal value, **effects that depend on a lazy memo will not automatically re-run** when the memo's source dependencies change. The effect only triggers when the lazy memo is read and produces a new value.

This is a perfectly valid strategy for expensive computations that are consumed on-demand rather than observed continuously.

```typescript
const searchQuery = createSignal('');
const allItems = createSignal([
  /* large dataset */
]);

// Lazy: does NOT recalculate until read
const searchResults = createMemo(
  () => {
    const query = searchQuery.get().toLowerCase();
    return allItems
      .get()
      .filter((item) => item.name.toLowerCase().includes(query));
  },
  {lazy: true},
);

searchQuery.set('foo');
// `searchResults` has NOT recalculated yet — no computation wasted

// Later, when the UI actually needs the results:
console.log(searchResults()); // Recalculates now, on demand
```

**Choose lazy when:**

- The computation is expensive and the result is not always needed
- The memo is read on-demand (e.g., triggered by user interaction) rather than observed by effects
- Dependencies change frequently but the value is consumed infrequently

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
