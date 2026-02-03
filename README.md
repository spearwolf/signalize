![signalize hero](https://github.com/spearwolf/signalize/blob/main/hero.gif?raw=true)

![npm (scoped)](https://img.shields.io/npm/v/%40spearwolf/signalize)
![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/spearwolf/signalize/main.yml)
![GitHub](https://img.shields.io/github/license/spearwolf/signalize)

`@spearwolf/signalize` - A lightweight JavaScript library for signals & effects.
Reactive programming, made simple. Works in Browser & Node.js.
Type-safe. Fast. No framework lock-in.

# 📢 Signals and Effects for All

`@spearwolf/signalize` is a javascript library for creating fine-grained reactivity through **signals** and **effects**.

- a **standalone** javascript library that is _framework agnostic_
- **without side-effects** and targets `ES2023` based environments
- written in **typescript** v5 and uses the new [tc39 decorators](https://github.com/tc39/proposal-decorators) :rocket:
  - _however, it is optional and not necessary to use the decorators_

> [!NOTE]
> Reactivity is the secret sauce to building modern, dynamic web apps.
> `@spearwolf/signalize` makes it easy. No frameworks, no boilerplate, just pure reactivity.

---

## Table of Contents

> [!IMPORTANT]
> The documentation is a work in progress. Although every effort is made to ensure completeness and logical structure, there is always room for improvement, and some topics are not fully explained. Therefore, it is advisable to review the test specifications as well.
> The API itself is almost stable and is already being used successfully in several internal projects.

- [Introduction](#-introduction)
  - [Core Concepts](#core-concepts)
- [Getting Started](#-getting-started)
- [API Reference](#-api-reference)
  - [Signals](#-signals)
    - [`createSignal`](#createsignal)
    - [Reading Signals](#reading-signals)
    - [Writing Signals](#writing-signals)
    - [Muting Signals](#muting-signals)
    - [Destroying Signals](#destroying-signals)
  - [Effects](#-effects)
    - [`createEffect`](#createeffect)
    - [Dynamic vs. Static Effects](#dynamic-vs-static-effects)
    - [Cleanup Logic](#cleanup-logic)
    - [Manual Control](#manual-control)
    - [Nested Effects](#nested-effects)
  - [Memos (Computed Signals)](#-memos-computed-signals)
    - [`createMemo`](#creatememo)
  - [Decorators (Class-based API)](#-decorators-class-based-api)
    - [`@signal`](#signal)
    - [`@memo`](#memo)
  - [Signal Links & Connections](#-signal-links--connections)
    - [`link` & `unlink`](#link--unlink)
    - [`SignalGroup`](#signalgroup)
    - [`SignalAutoMap`](#signalautomap)
  - [Utilities](#-utilities)
    - [`batch`](#batch)
    - [`beQuiet` & `isQuiet`](#bequiet--isquiet)
    - [`hibernate`](#hibernate)
    - [Debugging & Inspection](#debugging--inspection)
  - [Advanced API](#-advanced-api)
    - [Effect Lifecycle Hooks](#effect-lifecycle-hooks)
    - [Object Signals API](#object-signals-api)
  - [TypeScript Types Reference](#-typescript-types-reference)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Introduction

`@spearwolf/signalize` brings the power of fine-grained reactivity to any JavaScript or TypeScript project.
It's a lightweight, standalone library that helps you manage state and build data flows that automatically update when your data changes.

Forget about imperative DOM updates or complex state management logic. With signals, you create reactive values, and with effects, you create functions that automatically run whenever those values change. It's that simple.

### Core Concepts

- **Signals**: Think of them as reactive variables. When a signal's value changes, it automatically notifies everything that depends on it. It's like a spreadsheet cell that magically updates all formulas that use it.

- **Effects**: These are the functions that "listen" to signals. An effect subscribes to one or more signals and re-executes automatically whenever any of its dependencies change, keeping your app perfectly in sync.

- **Memos**: These are special signals whose values are computed from other signals. The library caches their result and only re-evaluates them when one of their dependencies changes, giving you performance for free.

- **Links (Connections)**: Inspired by visual programming tools like Unreal Engine's Blueprints and Blender's shader graph editor, links create explicit one-way data flows between signals. They let you build modular, graph-like architectures where signals act as nodes with inputs and outputs. Combined with Signal Groups, you can organize signals into reusable modules and manage their lifecycles together—perfect for building complex reactive systems without manual wiring.

This library offers both a clean **functional API** and a convenient **class-based API using decorators**.

## ⚙️ Getting Started

First, install the package using your favorite package manager:

```shell
npm install @spearwolf/signalize
```

Now, let's see it in action. Here’s a simple example that automatically logs the signal value to the console whenever it changes.

```typescript
import {createSignal, createEffect} from '@spearwolf/signalize';

// Create a signal with an initial value of 0.
const count = createSignal(0);

// Create an effect that runs whenever `count` changes.
createEffect(() => {
  // By calling count.get(), we establish a dependency on the `count` signal.
  // The effect will re-run whenever its value changes.
  console.log(`The count is now: ${count.get()}`);
});
// Console output: The count is now: 0

// Update the signal's value.
console.log('Setting count to 5...');
count.set(5);
// Console output: The count is now: 5

count.set(5);
// (no-console output here since the value didn't change)

console.log('Setting count to 10...');
count.set(10);
// Console output: The count is now: 10
```

That's it! No extra boilerplate, no framework dependencies. Just pure, simple reactivity.

## 📖 API Reference

This section provides a detailed overview of the `@spearwolf/signalize` API.

### ✨ Signals

Signals are the heart of the library. They hold state and allow you to create reactive data flows.

#### `createSignal`

Creates a new signal containing a value.

```typescript
createSignal<T>(initialValue?: T, options?: SignalParams<T>): Signal<T>
```

- `initialValue`: The starting value of the signal.
- `options`:
  - `compare`: A custom function to compare old and new values to decide if a change should trigger effects. Defaults to strict equality (`===`).
  - `lazy`: A boolean that, if true, treats the `initialValue` as a function to be executed lazily on the first read.
  - `beforeRead`: A callback function that is called every time before the signal's value is read via `get()`. Useful for triggering side effects or lazy computations.
  - `attach`: Attaches the signal to a `SignalGroup` for easier lifecycle management.

`createSignal` returns a `Signal` object with the following properties:

- `get()`: A function to read the signal's value. Using `get()` inside an effect **creates a subscription**.
- `set(newValue)`: A function to write a new value to the signal.
- `value`: A getter/setter to read or write the signal's value. Reading via `.value` does **not** track dependencies in effects. Writing will trigger effects.
- `onChange(callback)`: A simple way to create a static effect that runs when the signal changes. Returns a function to destroy the subscription.
- `touch()`: Triggers all dependent effects without changing the signal's value.
- `destroy()`: Destroys the signal and cleans up all its dependencies.
- `muted`: A boolean property that indicates whether the signal is currently muted. Muted signals do not trigger effects when their value changes.

**Example:**

```typescript
import {createSignal} from '@spearwolf/signalize';

// A signal holding a vector
const v3 = createSignal([1, 2, 3], {
  // A custom compare function
  compare: (a, b) => a == b || a?.every((val, index) => val === b[index]),
});

v3.onChange((v) => {
  console.log('Vector changed:', v);
});

console.log(v3.value); // => [1, 2, 3]

// Update the signal's value
v3.value = [4, 5, 6];
// => Vector changed: [4, 5, 6]

// This update will NOT trigger effects because the custom compare function returns true
v3.value = [4, 5, 6];
```

#### Reading Signals

It's important to understand the difference between dependency-tracking reads and non-tracking reads.

1. **`signal.get()`**: This is the primary way to read a signal's value and have an effect subscribe to its changes.
2. **`signal.value`**: This property provides direct access to the signal's value _without_ creating a dependency. An effect that reads `.value` will not re-run when that signal changes.
3. **`value(signal)`**: This is a utility function that behaves identically to the `signal.value` property, providing a non-tracking read of the signal's value.

**Choose wisely:** Use `.get()` when you want reactivity. Use `.value` or `value()` when you need to peek at a value without creating a subscription.

```typescript
import {createSignal, createEffect} from '@spearwolf/signalize';

const name = createSignal('John');
const age = createSignal(30);

createEffect(() => {
  // This effect depends on `name` (using .get()) but NOT on `age` (using .value)
  console.log(`Name: ${name.get()}, Age: ${age.value}`);
});
// Console output: Name: John, Age: 30

name.value = 'Jane'; // Triggers the effect because we used .get()
// Console output: Name: Jane, Age: 30

age.value = 31; // Does NOT trigger the effect, because we read it with .value inside the effect
console.log(`Updated Age: ${age.value}`); // Outputs: Updated Age: 31

name.touch(); // This will trigger the effect without changing the value
// Console output: Name: Jane, Age: 31
```

#### Writing Signals

1.  **`signal.value = newValue`**: The most direct way to set a new value.
2.  **`signal.set(newValue)`**: The functional equivalent.
3.  **`touch(signal)`**: Triggers effects without changing the value. Useful for forcing re-renders or re-evaluations.

#### Muting Signals

You can temporarily prevent a signal from triggering effects using `muteSignal` and `unmuteSignal`.

```typescript
import {
  createSignal,
  createEffect,
  muteSignal,
  unmuteSignal,
} from '@spearwolf/signalize';

const sig = createSignal('hello');

createEffect(() => console.log(sig.get()));
// => "hello"

muteSignal(sig);
sig.value = 'world'; // Nothing is logged

unmuteSignal(sig); // Nothing is logged

sig.value = 'world again';
// => "world again"
```

> [!NOTE]
> The `Signal` object also has a `.muted` property: `sig.muted = true`.

#### Destroying Signals

To clean up a signal and all its associated effects and dependencies, use `destroySignal`.

```typescript
destroySignal(mySignal, anotherSignal);
```

You can also call the `.destroy()` method on the signal object itself.

#### Signal Objects, Getters, and Setters

When you call `createSignal()`, it returns a `Signal` object that provides several ways to interact with your reactive value. Understanding these different approaches helps you choose the right tool for each situation.

**The Signal Object**

The `Signal<T>` object returned by `createSignal()` is your primary interface for working with reactive values. It provides:

```typescript
import {createSignal} from '@spearwolf/signalize';

const count = createSignal(42);

// These are all different properties/methods on the signal object:
count.get; // A function for reading with dependency tracking
count.set; // A function for writing values
count.value; // A getter/setter property for direct access
count.onChange; // A method to create simple effects
count.touch; // A method to trigger effects without changing the value
count.destroy; // A method to clean up the signal
count.muted; // A boolean property to mute/unmute the signal
```

**Getter and Setter Functions**

The `.get` and `.set` properties are actually functions that you can pass around independently:

```typescript
import {createSignal, createEffect} from '@spearwolf/signalize';

const temperature = createSignal(20);

// Extract the getter and setter functions
const getTemp = temperature.get;
const setTemp = temperature.set;

// Use them independently
createEffect(() => {
  console.log(`Temperature: ${getTemp()}°C`);
});
// => "Temperature: 20°C"

setTemp(25);
// => "Temperature: 25°C"
```

This is particularly useful when you want to expose read-only or write-only access to a signal:

```typescript
class Thermometer {
  #temp = createSignal(20);

  // Expose only the getter, keeping write access private
  get temperature() {
    return this.#temp.get;
  }

  // Internal method that can write
  calibrate(offset: number) {
    this.#temp.set(this.#temp.value + offset);
  }
}

const thermo = new Thermometer();

createEffect(() => {
  // Users can read the temperature
  console.log(thermo.temperature());
});

// But they cannot write to it directly
// thermo.temperature.set(100); // This would work if we exposed .set
```

**Working with Signal Types**

The library provides TypeScript types for different aspects of signals:

- `Signal<T>`: The complete signal object with all methods
- `SignalReader<T>`: Just the getter function type
- `SignalWriter<T>`: Just the setter function type
- `SignalLike<T>`: An interface for objects containing a signal

```typescript
import {createSignal, SignalReader, SignalWriter} from '@spearwolf/signalize';

const name = createSignal('Alice');

// You can type parameters to accept only readers or writers
function logValue(reader: SignalReader<string>) {
  console.log(reader());
}

function setValue(writer: SignalWriter<string>, value: string) {
  writer(value);
}

logValue(name.get); // Works!
setValue(name.set, 'Bob'); // Works!
```

**Advanced: Accessing the Internal Implementation**

While you typically won't need this, you can access the internal signal implementation using the `$signal` symbol:

```typescript
import {createSignal, $signal} from '@spearwolf/signalize';

const count = createSignal(0);

// Access the internal implementation (advanced use case)
const impl = count[$signal];
console.log(impl.id); // The unique symbol ID
console.log(impl.muted); // Muted state
console.log(impl.destroyed); // Destroyed state
```

This is primarily used by the library's internal utilities and advanced framework integrations, not for typical application code.

### 🎭 Effects

Effects are where the magic happens. They are self-managing functions that react to changes in your signals.

#### `createEffect`

Creates a new effect.

```typescript
createEffect(callback: () => void | (() => void), options?: EffectOptions): Effect
```

- `callback`: The function to execute. It can optionally return a _cleanup function_, which runs before the next effect execution or on destruction.
- `options`:
  - `dependencies`: An array of signals to subscribe to, creating a **static effect**. If omitted, the effect is **dynamic**.
  - `autorun`: If `false`, the effect will not run automatically. You must call `.run()` manually.
  - `attach`: Attaches the effect to a `SignalGroup`.
  - `priority`: Effects with higher priority are executed before others. Default is `0`.

`createEffect` returns an `Effect` object with two methods:

- `run()`: Manually triggers the effect, respecting dependencies.
- `destroy()`: Stops and cleans up the effect.

#### Dynamic vs. Static Effects

- **Dynamic (Default)**: The effect automatically tracks which signals are read during its execution and re-subscribes on each run. This is great for conditional logic.

  ```typescript
  const show = createSignal(false);
  const data = createSignal('A');

  createEffect(() => {
    console.log('Effect running...');
    if (show.get()) {
      console.log(data.get()); // `data` is only a dependency when `show` is true
    }
  });

  show.set(true); // Effect re-runs
  data.set('B'); // Effect re-runs
  show.set(false); // Effect re-runs
  data.set('C'); // Effect does NOT re-run
  ```

- **Static**: You provide an explicit array of dependencies. The effect only runs when one of _those_ signals changes, regardless of what's read inside.

  > [!IMPORTANT]
  > Static effects do **not** run automatically on creation. They only run when a dependency changes. If you need the effect to run initially, call `.run()` manually.

  ```typescript
  const a = createSignal(1);
  const b = createSignal(2);

  // This effect ONLY depends on `a`, even though it reads `b`.
  const effect = createEffect(() => {
    console.log(`a=${a.get()}, b=${b.get()}`);
  }, [a]); // Static dependency on `a`

  // Static effects don't run initially - call .run() if needed
  effect.run();
  // => "a=1, b=2"

  b.set(99); // Does NOT trigger the effect
  a.set(10); // Triggers the effect
  // => "a=10, b=99"
  ```

#### Cleanup Logic

An effect can return a function that will be executed to "clean up" its last run. This is perfect for managing subscriptions, timers, or other side effects.

```typescript
const milliseconds = createSignal(1000);

createEffect(() => {
  console.log(`Create timer with', ${milliseconds.get()}ms interval`);

  const timerId = setInterval(() => {
    console.log('tick');
  }, milliseconds.get());

  // This cleanup function runs when the effect is destroyed
  return () => {
    clearInterval(timerId);
    console.log('Previous timer cleared!');
  };
});
// => "Create timer with 1000ms interval"

milliseconds.set(5000); // Set interval to 5 seconds
// => "Previous timer cleared!"
// => "Create timer with 5000ms interval"

// => . . "tick" ...
```

#### Manual Control

Set `autorun: false` to create an effect that you control. It will only track dependencies and run when you explicitly call its `run()` method.

```typescript
const val = createSignal(0);

const effect = createEffect(() => console.log(val.get()), {autorun: false});
// No output yet, since autorun is false

console.log('Effect created, but not run.');

effect.run();
// => Console output: 0

val.set(1); // Does nothing, since we have deactivated autorun
val.set(10); // same

effect.run();
// => Console output: 10

val.set(10); // Does nothing

effect.run(); //  Does nothing, because the value didn't change
```

#### Nested Effects

Effects can be nested, allowing you to create complex reactive flows where one effect creates another. This is a powerful feature for building dynamic, hierarchical reactive systems.

**How Nested Effects Work**

When you create an effect inside another effect, the inner effect becomes a "child" of the outer effect:

```typescript
import {createSignal, createEffect} from '@spearwolf/signalize';

const enabled = createSignal(true);
const value = createSignal(0);

createEffect(() => {
  console.log('Outer effect running');

  if (enabled.get()) {
    // This creates a nested effect that will become a child of the outer effect
    createEffect(() => {
      console.log('Inner effect, value:', value.get());
    });
  }
});
// => "Outer effect running"
// => "Inner effect, value: 0"

value.set(1);
// => "Inner effect, value: 1"

enabled.set(false);
// => "Outer effect running"
// (Inner effect is destroyed because the outer effect re-ran)

value.set(2);
// (Nothing happens - the inner effect was destroyed)
```

**Key Behaviors of Nested Effects**

1. **Automatic Lifecycle Management**: When a parent effect re-runs, its child effects are automatically destroyed and recreated. This prevents memory leaks and ensures consistency.

2. **Isolation**: Child effects created during a parent effect's run are isolated. They track their own dependencies independently of the parent.

3. **Cleanup**: When a parent effect is destroyed, all its child effects are automatically destroyed too.

```typescript
const outerSignal = createSignal('A');
const innerSignal = createSignal(1);

const parentEffect = createEffect(() => {
  console.log('Parent:', outerSignal.get());

  createEffect(() => {
    console.log('Child:', innerSignal.get());
  });

  return () => console.log('Parent cleanup');
});
// => "Parent: A"
// => "Child: 1"

outerSignal.set('B');
// => "Parent cleanup"
// => "Parent: B"
// => "Child: 1"
// (Note: Child effect is recreated, not re-run)

parentEffect.destroy();
// => "Parent cleanup"
// (Both parent and child are destroyed)
```

**Avoiding Circular Dependencies**

While nested effects are powerful, you must be careful to avoid circular dependencies that cause infinite loops. A circular dependency occurs when:

1. Effect A depends on Signal X
2. Effect A modifies Signal Y (often in a nested effect)
3. Effect B depends on Signal Y
4. Effect B modifies Signal X

Here's an example of what **NOT** to do:

```typescript
// ❌ BAD: Creates an infinite loop!
const a = createSignal(0);
const b = createSignal(0);

createEffect(() => {
  const valA = a.get();
  console.log('A changed to:', valA);
  b.set(valA + 1); // Triggers effect B
});

createEffect(() => {
  const valB = b.get();
  console.log('B changed to:', valB);
  a.set(valB + 1); // Triggers effect A again!
});
// => Infinite loop! A -> B -> A -> B -> ...
```

**How to Avoid Circular Dependencies**

1. **Use Guards**: Add conditions to prevent unnecessary updates:

```typescript
const a = createSignal(0);
const b = createSignal(0);

createEffect(() => {
  const valA = a.get();
  // Only update b if the value is actually different
  if (b.value !== valA + 1) {
    b.set(valA + 1);
  }
});
```

2. **Use `batch()`**: Group related updates together:

```typescript
import {batch} from '@spearwolf/signalize';

const x = createSignal(0);
const y = createSignal(0);

createEffect(() => {
  const valX = x.get();
  batch(() => {
    // Both updates happen together, effects run once
    y.set(valX * 2);
  });
});
```

3. **Rethink Your Design**: Often, circular dependencies indicate that your reactive graph needs restructuring. Consider using memos or reorganizing your state:

```typescript
// ❌ BAD: Two signals updating each other
const celsius1 = createSignal(0);
const fahrenheit1 = createSignal(32);

createEffect(() => {
  fahrenheit1.set((celsius1.get() * 9) / 5 + 32);
});
createEffect(() => {
  celsius1.set(((fahrenheit1.get() - 32) * 5) / 9);
});
// Circular dependency!

// ✅ GOOD: Use one signal and a memo
const celsius = createSignal(0);
const fahrenheit = createMemo(() => (celsius.get() * 9) / 5 + 32);

// Now there's only one source of truth
celsius.set(100);
console.log(fahrenheit()); // => 212
```

4. **Use `beQuiet()`**: Temporarily disable effect tracking for specific updates:

```typescript
import {beQuiet} from '@spearwolf/signalize';

const a = createSignal(0);
const b = createSignal(0);

createEffect(() => {
  const valA = a.get();
  // Update b without triggering effects
  beQuiet(() => {
    b.set(valA + 1);
  });
});
```

**Best Practices**

- Keep your reactive dependency graph **acyclic** (one-directional)
- Use **memos** for derived values instead of effects that update signals
- Think of effects as the **"edge"** of your system (DOM updates, logging, etc.), not for internal state synchronization
- When in doubt, draw your dependency graph on paper to visualize the flow

### 🧠 Memos (Computed Signals)

Memos are signals whose values are derived from other signals. They are lazy and only recompute when a dependency changes.

#### `createMemo`

Creates a new memoized signal.

The default behavior of a memo is that of a _computed_ signal. If dependencies change, the memo value is recalculated and can in turn trigger dependent effects.

Alternatively, a _lazy_ memo can be created by using the `lazy: true` option.
A lazy memo works in the same way, with the difference that the memo value is _only calculated when the memo is read_. This means that effects dependent on the memo are also only executed when the memo has been read.

```typescript
createMemo<T>(computer: () => T, options?: CreateMemoOptions): SignalReader<T>
```

- `computer`: The function that computes the value.
- `options`:
  - `lazy`: If `true`, the memo will be **lazy** and only compute when accessed. Default is `false`. A **non-lazy** memo computes immediately and works like a _computed_ signal.
  - `attach`: Attaches the memo to a `SignalGroup`.
  - `priority`: Memos with higher priority are executed before others effects. Default is `1000`.
  - `name`: Gives the memo a name within its group.

It returns a _signal reader_ function, which you call to get the memo's current value.

> [!TIP]
>
> Choose wisely:
>
> - A non-lazy memo, aka computed signal, is the standard behavior and is most likely what users expect.
> - A lazy memo, on the other hand, is more efficient: the calculation is only performed when it is read. However, a lazy effect does not automatically update dependent effects, but only after they are read, which can lead to unexpected behavior.

**Example:**

```typescript
import {createSignal, createMemo} from '@spearwolf/signalize';

const firstName = createSignal('John');
const lastName = createSignal('Doe');

const fullName = createMemo(
  () => {
    console.log('Computing full name...');
    // We use .get() to establish dependencies inside the memo
    return `${firstName.get()} ${lastName.get()}`;
  },
  {
    lazy: true,
  },
);
// Nothing is logged

console.log('hello');
// => "hello"

console.log(fullName());
// => "Computing full name..."
// => "John Doe"

console.log(fullName());
// => "John Doe"

firstName.set('Jane'); // Nothing is logged
// NOTE A _non-lazy_ memo (`lazy: false` or no options at all)
//      would now trigger the recalculation at this point, generating the output => "Computing full name..."

console.log('after change');

console.log(fullName());
// But since it's a lazy memo, the memo hook is only executed now => "Computing full name..."
// => "Jane Doe"
```

### 💎 Decorators (Class-based API)

For those who prefer object-oriented patterns, `@spearwolf/signalize` provides decorators for creating signals and memos within classes.

**Import decorators from the separate entry point:**

```typescript
import {signal, memo} from '@spearwolf/signalize/decorators';
```

> [!IMPORTANT]
> The decorator API is still in the early stages of development and is not yet complete.
> It only uses the new JavaScript standard decorators, not the legacy or experimental TypeScript ones.

#### `@signal`

A class accessor decorator that turns a property into a signal.

```typescript
class User {
  @signal() accessor name = 'Anonymous';
  @signal() accessor age = 0;
}

const user = new User();
console.log(user.name); // => "Anonymous"

createEffect(() => {
  console.log(`User is ${user.name}, age ${user.age}`);
});
// => "User is Anonymous, age 0"

user.name = 'Alice'; // Triggers the effect
// => "User is Alice, age 0"
```

#### `@memo`

A class method decorator that turns a getter-like method into a memoized signal.

> [!IMPORTANT]
> A memo created by this decorator is always lazy and never autorun!

```typescript
class User {
  @signal() accessor firstName = 'John';
  @signal() accessor lastName = 'Doe';

  @memo()
  fullName() {
    console.log('Computing full name...');
    return `${this.firstName} ${this.lastName}`;
  }
}

const user = new User();
console.log(user.fullName()); // "Computing full name..." -> "John Doe"
console.log(user.fullName()); // (no log) -> "John Doe"
```

### 🔗 Signal Links & Connections

Signal Links are the fourth core concept in `@spearwolf/signalize`, drawing inspiration from visual programming environments like Unreal Engine's Blueprints and Blender's shader graph editor. They enable you to build modular, graph-like reactive architectures where signals become nodes with explicit input and output connections.

Think of signals as nodes in a visual graph, and links as the wires connecting them. This paradigm makes it natural to:

- Create explicit one-way data flows between signals
- Build modular architectures with clear inputs and outputs
- Organize signals into groups that act as reusable modules
- Manage signal lifecycles together through SignalGroup
- Create complex reactive pipelines without manually writing effects

**Why Links Matter**

While effects are great for side effects (like updating the DOM), links shine when you need to propagate state between signals in a structured, declarative way. They're perfect for:

- Building data flow graphs for game engines, audio processing, or visual programming
- Creating plugin architectures where modules connect their inputs/outputs
- Managing complex state synchronization without effect spaghetti
- Building reusable reactive components that expose clear interfaces

#### `link` & `unlink`

`link()` creates a one-way binding from a source signal to a target signal or a callback function.
The target will be automatically updated whenever the source changes. `unlink()` removes this connection.

**Function Signatures:**

```typescript
link<ValueType>(
  source: SignalReader<ValueType> | Signal<ValueType>,
  target: SignalReader<ValueType> | Signal<ValueType> | ((value: ValueType) => void),
  options?: LinkOptions
): SignalLink<ValueType>

unlink<ValueType>(
  source: SignalReader<ValueType> | Signal<ValueType>,
  target?: SignalReader<ValueType> | Signal<ValueType> | ((value: ValueType) => void)
): void
```

**Options:**

- `attach`: Attaches the link to a `SignalGroup` for lifecycle management. The link will be destroyed when the group is cleared.

**Basic Usage:**

```typescript
import {createSignal, link, unlink} from '@spearwolf/signalize';

const source = createSignal('A');
const target = createSignal('');

const connection = link(source, target);

console.log(target.value); // => "A" (value is synced on link)
console.log(connection.lastValue); // => "A"

source.value = 'B';

console.log(target.value); // => "B"

// Stop the connection
unlink(source, target); // or connection.destroy()

source.value = 'C';

console.log(target.value); // => "B" (no longer updates)
```

**Linking to a Callback Function:**

You can also link a signal to a callback function instead of another signal:

```typescript
const counter = createSignal(0);

const connection = link(counter, (value) => {
  console.log(`Counter is now: ${value}`);
});
// => "Counter is now: 0"

counter.set(1);
// => "Counter is now: 1"

connection.destroy(); // Stop receiving updates
```

**Singleton Behavior:**

Links are singletons. Attempting to create a duplicate link returns the existing one:

```typescript
const sigA = createSignal(1);
const sigB = createSignal(0);

const con1 = link(sigA, sigB);
const con2 = link(sigA, sigB);

console.log(con1 === con2); // => true
```

**Muting Links:**

You can temporarily pause a link without destroying it:

```typescript
const source = createSignal('A');
const target = createSignal('');

const connection = link(source, target);

connection.mute();
source.value = 'B';
console.log(target.value); // => "A" (unchanged because link is muted)

connection.unmute();
source.value = 'C';
console.log(target.value); // => "C"

// Or use toggleMute() to switch between states
connection.toggleMute();
```

**Using `unlink()`:**

```typescript
// Unlink a specific connection
unlink(source, target);

// Unlink ALL connections from a source
unlink(source);
```

**Async Value Iteration:**

Links provide powerful async APIs for reactive programming:

```typescript
const counter = createSignal(0);
const display = createSignal(0);

const connection = link(counter, display);

// Wait for the next value
counter.set(1);
const nextVal = await connection.nextValue();
console.log(nextVal); // => The next value after the promise was created

// Iterate over values asynchronously
for await (const value of connection.asyncValues((val) => val >= 5)) {
  console.log(value); // Logs each value until 5 is reached
}
```

**Attaching to a SignalGroup:**

```typescript
const groupOwner = {};
const source = createSignal(1);
const target = createSignal(0);

// Attach during creation
const connection = link(source, target, {attach: groupOwner});

// Or attach later
const connection2 = link(source, someCallback);
connection2.attach(groupOwner);

// When the group is cleared, all attached links are destroyed
SignalGroup.get(groupOwner).clear();
```

**SignalLink Properties and Methods:**

| Property / Method          | Description                                                |
| -------------------------- | ---------------------------------------------------------- |
| `lastValue`                | The last value that was synchronized to the target         |
| `source`                   | Reference to the source signal's internal implementation   |
| `isDestroyed`              | Boolean indicating if the link has been destroyed          |
| `isMuted`                  | Boolean indicating if the link is currently muted          |
| `nextValue()`              | Returns a Promise that resolves to the next value          |
| `asyncValues(stopAction?)` | Async generator yielding values until stopped or destroyed |
| `touch()`                  | Forces the current value to be written to the target       |
| `mute()`                   | Pauses the link (returns the link for chaining)            |
| `unmute()`                 | Resumes the link (returns the link for chaining)           |
| `toggleMute()`             | Toggles muted state, returns new muted state               |
| `attach(object)`           | Attaches the link to a SignalGroup                         |
| `destroy()`                | Destroys the link and cleans up resources                  |

**Events:**

Links emit events that you can listen to using the `@spearwolf/eventize` library:

```typescript
import {on} from '@spearwolf/eventize';

const connection = link(source, target);

on(connection, 'value', (val) => console.log('New value:', val));
on(connection, 'mute', () => console.log('Link muted'));
on(connection, 'unmute', () => console.log('Link unmuted'));
on(connection, 'destroy', () => console.log('Link destroyed'));
```

**Utility Function `getLinksCount()`:**

```typescript
import {getLinksCount} from '@spearwolf/signalize';

// Get total count of all active links
console.log(getLinksCount()); // => 0

link(sigA, sigB);
link(sigA, sigC);

console.log(getLinksCount()); // => 2

// Get count of links from a specific source
console.log(getLinksCount(sigA)); // => 2
console.log(getLinksCount(sigB)); // => 0 (sigB is not a source)
```

#### `SignalGroup`

A `SignalGroup` is a powerful utility for managing the lifecycle of a collection of signals, effects, and links. It's typically associated with a class instance or component, allowing you to destroy all reactive elements in a group with a single call to `group.clear()`.

When you use decorators like `@signal` or `@memo`, a `SignalGroup` is automatically created and associated with your class instance.

This is essential for building modular architectures where groups of signals act as nodes or modules that can be connected and managed together.

**Getting or Creating a SignalGroup:**

```typescript
import {
  SignalGroup,
  createSignal,
  createEffect,
  link,
} from '@spearwolf/signalize';

// Get an existing group (returns undefined if none exists)
const existingGroup = SignalGroup.get(myObject);

// Get or create a group for an object
const group = SignalGroup.findOrCreate(myObject);

// Or use the attach option when creating signals, effects, or links
const signal = createSignal(42, {attach: myObject});
const effect = createEffect(() => console.log(signal.get()), {
  attach: myObject,
});
const connection = link(sourceSignal, targetSignal, {attach: myObject});
```

**Attaching Signals, Effects, and Links:**

```typescript
const group = SignalGroup.findOrCreate({});

// Attach signals
const count = createSignal(0);
group.attachSignal(count);

// Attach named signals (can be looked up by name)
const name = createSignal('John');
group.attachSignalByName('userName', name);

// Now you can retrieve it by name
group.hasSignal('userName'); // => true
group.signal('userName'); // => the name signal

// Attach effects
const effect = createEffect(() => console.log(count.get()), {autorun: false});
group.attachEffect(effect[$effect]); // $effect is imported from constants

// Attach links
const target = createSignal(0);
const connection = link(count, target);
group.attachLink(connection);
```

**Named Signal Behavior:**

Named signals support a powerful stacking mechanism. You can assign multiple signals to the same name, and the most recently attached signal becomes the "active" one.

```typescript
const group = SignalGroup.findOrCreate({});
const signal1 = createSignal(1);
const signal2 = createSignal(2);

group.attachSignalByName('myValue', signal1);
group.signal('myValue'); // => signal1

group.attachSignalByName('myValue', signal2);
group.signal('myValue'); // => signal2 (most recent)

// Detaching signal2 reverts to signal1
group.detachSignal(signal2);
group.signal('myValue'); // => signal1

signal2.destroy();
group.clear();
```

**Nested Groups:**

Groups can be nested in a parent-child hierarchy. Child groups inherit named signals from their parents.

```typescript
const parent = SignalGroup.findOrCreate({});
const child = SignalGroup.findOrCreate({});

const sharedConfig = createSignal({theme: 'dark'});
parent.attachSignalByName('config', sharedConfig);

parent.attachGroup(child);

// Child can access parent's named signals
child.hasSignal('config'); // => true
child.signal('config'); // => sharedConfig

// Child signals shadow parent signals with the same name
const childConfig = createSignal({theme: 'light'});
child.attachSignalByName('config', childConfig);
child.signal('config'); // => childConfig (child's own)

// Clearing parent also destroys all children
parent.clear();
```

**Running Effects:**

You can manually trigger all effects in a group (and its child groups):

```typescript
const group = SignalGroup.findOrCreate({});
const value = createSignal(0);

const effect = createEffect(
  () => {
    console.log('Value:', value.get());
  },
  {autorun: false},
);

group.attachEffect(effect[$effect]);
group.attachSignal(value);

value.set(42);

// Manually run all effects in the group
group.runEffects(); // => logs "Value: 42"
```

**Cleanup with clear():**

When you're done with a group, call `clear()` to destroy all attached signals, effects, links, and child groups:

```typescript
const group = SignalGroup.findOrCreate(myComponent);

// ... attach signals, effects, links ...

// When the component is destroyed:
group.clear(); // Destroys everything attached to this group
```

**Static Methods:**

| Method                             | Description                                                          |
| ---------------------------------- | -------------------------------------------------------------------- |
| `SignalGroup.get(object)`          | Returns the SignalGroup for an object, or `undefined` if none exists |
| `SignalGroup.findOrCreate(object)` | Gets or creates a SignalGroup for an object                          |
| `SignalGroup.delete(object)`       | Clears and removes the SignalGroup for an object                     |
| `SignalGroup.clear()`              | Clears all SignalGroups globally                                     |

**Instance Methods:**

| Method                              | Description                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `attachSignal(signal)`              | Adds a signal to the group                                                     |
| `attachSignalByName(name, signal?)` | Associates a signal with a name, or removes the name if signal is omitted      |
| `detachSignal(signal)`              | Removes a signal from the group (but doesn't destroy it)                       |
| `hasSignal(name)`                   | Returns true if a signal with the given name exists (checks parent groups too) |
| `signal(name)`                      | Returns the signal with the given name (checks parent groups too)              |
| `attachEffect(effect)`              | Adds an effect to the group                                                    |
| `runEffects()`                      | Runs all attached effects (and child group effects)                            |
| `attachLink(link)`                  | Adds a link to the group                                                       |
| `detachLink(link)`                  | Removes a link from the group (but doesn't destroy it)                         |
| `attachGroup(group)`                | Adds a child group (re-parents if already attached elsewhere)                  |
| `detachGroup(group)`                | Removes a child group                                                          |
| `clear()`                           | Destroys all attached signals, effects, links, and child groups                |

**Typical Usage Pattern:**

```typescript
import {signal, memo} from '@spearwolf/signalize/decorators';
import {SignalGroup, createEffect} from '@spearwolf/signalize';

class UserProfile {
  @signal() accessor name = '';
  @signal() accessor age = 0;

  @memo()
  displayText() {
    return `${this.name} (${this.age} years old)`;
  }

  constructor() {
    // Effects are automatically attached to the group via the 'attach' option
    createEffect(
      () => {
        console.log('Profile updated:', this.displayText());
      },
      {attach: this},
    );
  }

  destroy() {
    // Clean up all signals, effects, and memos in one call
    SignalGroup.get(this)?.clear();
  }
}

const profile = new UserProfile();
profile.name = 'Alice';
profile.age = 30;
// => logs "Profile updated: Alice (30 years old)"

profile.destroy(); // Clean up everything
```

#### `SignalAutoMap`

A `Map`-like class that automatically creates a `Signal` for any key that is accessed but doesn't yet exist. This is useful for managing dynamic collections of reactive state, especially when you don't know all the keys upfront.

**Key Features:**

- Auto-creates signals on first access
- Supports both string and symbol keys
- Batches updates for better performance
- Integrates seamlessly with effects

**Creating a SignalAutoMap:**

```typescript
import {SignalAutoMap} from '@spearwolf/signalize';

// Create an empty map
const map = new SignalAutoMap();

// Or create from an object with initial values
const props = SignalAutoMap.fromProps({name: 'John', age: 30});

// With explicit keys (only creates signals for specified keys)
const partial = SignalAutoMap.fromProps({a: 1, b: 2, c: 3}, ['a', 'b']);
// Only 'a' and 'b' have signals, 'c' is ignored
```

**Accessing and Modifying Signals:**

```typescript
const map = new SignalAutoMap();

// get() returns an existing signal or creates a new one
const nameSignal = map.get<string>('name');
nameSignal.value = 'Alice';

// Accessing the same key returns the same signal
const sameSignal = map.get('name');
console.log(sameSignal === nameSignal); // true

// Check if a key exists
console.log(map.has('name')); // true
console.log(map.has('unknown')); // false
```

**Using Symbol Keys:**

```typescript
const map = new SignalAutoMap();
const myKey = Symbol('myKey');

map.get(myKey).value = 'secret value';
console.log(map.get(myKey).value); // 'secret value'
```

**Batch Updates:**

The `update()` and `updateFromProps()` methods batch multiple signal updates together, ensuring that effects only run once after all updates are complete.

```typescript
import {SignalAutoMap, createEffect} from '@spearwolf/signalize';

const map = SignalAutoMap.fromProps({x: 0, y: 0, z: 0});

createEffect(() => {
  console.log(
    `Position: ${map.get('x').get()}, ${map.get('y').get()}, ${map.get('z').get()}`,
  );
});
// => Position: 0, 0, 0

// Update multiple values at once - effect runs only once
map.update(
  new Map([
    ['x', 10],
    ['y', 20],
    ['z', 30],
  ]),
);
// => Position: 10, 20, 30

// Or update from an object
map.updateFromProps({x: 100, y: 200});
// => Position: 100, 200, 30
```

**Iterating Over the Map:**

```typescript
const map = SignalAutoMap.fromProps({a: 1, b: 2, c: 3});

// Iterate over keys
for (const key of map.keys()) {
  console.log(key); // 'a', 'b', 'c'
}

// Iterate over signals
for (const signal of map.signals()) {
  console.log(signal.value); // 1, 2, 3
}

// Iterate over entries (key-signal pairs)
for (const [key, signal] of map.entries()) {
  console.log(`${key}: ${signal.value}`);
}
```

**Cleanup:**

When you're done with a SignalAutoMap, call `clear()` to destroy all signals and free resources:

```typescript
const map = SignalAutoMap.fromProps({a: 1, b: 2});
// ... use the map ...
map.clear(); // Destroys all signals
```

**Full Example with Effects:**

```typescript
import {SignalAutoMap, createEffect} from '@spearwolf/signalize';

const autoMap = SignalAutoMap.fromProps({bar: 'bar'});

// Accessing 'foo' for the first time creates a signal for it
autoMap.get('foo').value = 'hello';

createEffect(() => {
  console.log(autoMap.get('foo').get(), autoMap.get('bar').get());
});
// => "hello bar"

autoMap.get('bar').value = 'world';
// => "hello world"

autoMap.updateFromProps({foo: 'hallo'});
// => "hallo world"
```

### 🛠️ Utilities

#### `batch`

The `batch()` function allows you to apply multiple signal updates at once, but only trigger dependent effects a single time after all updates are complete.
This is a powerful optimization to prevent unnecessary re-renders or computations.

> [!CAUTION]
> `batch()` is a _hint_ not a _guarantee_ to run all effects in just _one_ strike!

```typescript
import {createSignal, createEffect, batch} from '@spearwolf/signalize';

const a = createSignal(1);
const b = createSignal(2);

createEffect(() => console.log(`a=${a.get()}, b=${b.get()}`));
// => a=1, b=2

batch(() => {
  a.set(10); // Effect does not run yet
  b.set(20); // Effect does not run yet
}); // Effect runs once at the end
// => a=10, b=20
```

#### `beQuiet` & `isQuiet`

`beQuiet()` executes a function without creating any signal dependencies within it.

> [!NOTE]
> `isQuiet()` can be used to check if you are currently inside a `beQuiet` call.

```typescript
import {
  createSignal,
  createEffect,
  beQuiet,
  isQuiet,
} from '@spearwolf/signalize';

const a = createSignal(1);
const b = createSignal(2);

createEffect(() => console.log(`a=${a.get()}, b=${b.get()}`));
// => a=1, b=2

beQuiet(() => {
  a.set(100); // Effect does not run
  b.set(200); // Effect does not run
  console.log('Inside beQuiet, isQuiet=', isQuiet());
  // => Inside beQuiet, isQuiet= true
}); // Effect does not run at all

console.log('a:', a.value, 'b:', b.value, 'isQuiet:', isQuiet());
// => a: 100 b: 200 isQuiet: false
```

#### `hibernate`

`hibernate()` temporarily suspends all context states (`batch`, `beQuiet`, effect tracking) while executing a callback. This allows code inside the callback to run as if it were called at the top level, without any outer context influencing its behavior.

After the callback completes (whether successfully or with an exception), all previous context states are automatically restored. `hibernate()` calls can be nested safely.

```typescript
import {
  createSignal,
  createEffect,
  batch,
  beQuiet,
  hibernate,
} from '@spearwolf/signalize';

const count = createSignal(0);

createEffect(() => {
  console.log('count =', count.get());

  hibernate(() => {
    // Inside hibernate: no effect tracking, no batch delays
    // This code runs as if called outside any context
    const otherSignal = createSignal(100);
    otherSignal.onChange((val) => console.log('other =', val));
  });
});
// => count = 0

batch(() => {
  count.set(1); // Effect is delayed by batch

  hibernate(() => {
    // Inside hibernate: batch is suspended
    count.set(2); // Effect runs immediately!
    // => count = 2
  });

  count.set(3); // Effect is delayed again
});
// => count = 3
```

This is useful when you need to:

- Create independent effects or signals inside an existing effect without inheriting the parent context
- Execute code that should trigger effects immediately, even when inside a `batch()`
- Read signals without creating dependencies in the current effect

#### Debugging & Inspection

Signalize provides utilities to inspect and debug your reactive system. These are particularly useful during development, testing, and troubleshooting.

**`isSignal(value)`**

Checks if a value is a signal. Useful for type checking and conditional logic.

```typescript
import {createSignal, isSignal} from '@spearwolf/signalize';

const count = createSignal(0);
const notSignal = 42;

console.log(isSignal(count)); // => true
console.log(isSignal(notSignal)); // => false

// Useful in conditional logic
function processValue(value: unknown) {
  if (isSignal(value)) {
    return value.get(); // It's a signal, read it
  }
  return value; // It's a regular value
}
```

**`getSignalsCount()`**

Returns the total number of currently active signals in your application. This is helpful for debugging memory leaks or understanding the reactive state of your app.

```typescript
import {createSignal, getSignalsCount} from '@spearwolf/signalize';

console.log(getSignalsCount()); // => 0

const a = createSignal(1);
const b = createSignal(2);
console.log(getSignalsCount()); // => 2

a.destroy();
console.log(getSignalsCount()); // => 1

b.destroy();
console.log(getSignalsCount()); // => 0
```

**`getEffectsCount()`**

Returns the total number of currently active effects. Like `getSignalsCount()`, this is valuable for debugging and monitoring.

```typescript
import {
  createSignal,
  createEffect,
  getEffectsCount,
} from '@spearwolf/signalize';

console.log(getEffectsCount()); // => 0

const count = createSignal(0);
const effect = createEffect(() => console.log(count.get()));
console.log(getEffectsCount()); // => 1

effect.destroy();
console.log(getEffectsCount()); // => 0
```

These debugging utilities are particularly useful for:

- **Memory leak detection**: Monitor signal and effect counts to ensure proper cleanup
- **Testing**: Assert expected numbers of active signals/effects
- **Performance analysis**: Track reactive overhead in different parts of your app
- **Type checking**: Use `isSignal()` for runtime type guards

### 🔧 Advanced API

This section covers advanced features primarily intended for framework integration, debugging tools, and specialized use cases.

#### Effect Lifecycle Hooks

For advanced scenarios like building devtools, analytics, or framework integrations, you can hook into the global effect lifecycle.

**`onCreateEffect(callback)`**

Registers a callback that fires whenever any effect is created in your application.

```typescript
import {createEffect, onCreateEffect} from '@spearwolf/signalize';

onCreateEffect((effect) => {
  console.log('Effect created:', effect.id);
});

createEffect(() => console.log('Hello'));
// => "Effect created: Symbol(ef:1)"
// => "Hello"
```

**`onDestroyEffect(callback)`**

Registers a callback that fires whenever any effect is destroyed.

```typescript
import {createEffect, onDestroyEffect} from '@spearwolf/signalize';

onDestroyEffect((effect) => {
  console.log('Effect destroyed:', effect.id);
});

const effect = createEffect(() => console.log('Hello'));
effect.destroy();
// => "Effect destroyed: Symbol(ef:1)"
```

> [!WARNING]
> These hooks are **global** and persist for the lifetime of your application. Use them sparingly and primarily for debugging, development tools, or framework integration layers.

**Common use cases:**

- Building reactive debugging tools and browser devtools extensions
- Tracking effect creation for testing and assertions
- Implementing logging and analytics for reactive behavior
- Creating framework integration layers that need to monitor reactivity

#### Object Signals API

These low-level functions support the decorator API and allow direct manipulation of signals attached to objects. Most users won't need these, but they're available for advanced use cases.

```typescript
import {
  findObjectSignalByName,
  findObjectSignals,
  findObjectSignalNames,
  destroyObjectSignals,
} from '@spearwolf/signalize';
```

**`findObjectSignalByName(object, name)`**

Find a signal by name on an object. Returns the signal or `undefined`.

**`findObjectSignals(object)`**

Get an array of all signals attached to an object.

**`findObjectSignalNames(object)`**

Get an array of names (strings or symbols) of all signals on an object.

**`destroyObjectSignals(...objects)`**

Destroy all signals attached to one or more objects.

> [!NOTE]
> These functions are primarily used internally by the `@signal` and `@memo` decorators to manage class-based reactive state.

### 📘 TypeScript Types Reference

This section documents the key TypeScript types exported by `@spearwolf/signalize`. Understanding these types is helpful when working with TypeScript or when you need precise type information.

#### Core Signal Types

**`Signal<T>`**

The main signal class with getter, setter, and utility methods. See the [Signals](#-signals) section for complete details on its properties and methods.

**`SignalReader<T>`**

A function type for reading signal values with automatic dependency tracking.

```typescript
type SignalReader<T> = (callback?: ValueChangedCallback<T>) => T;
```

This is the type of the `.get` property on a `Signal<T>`. When called inside an effect, it establishes a dependency. You can also pass an optional callback for change notifications.

```typescript
import {createSignal} from '@spearwolf/signalize';

const count = createSignal(0);
const reader: SignalReader<number> = count.get;

// Read with dependency tracking
const value = reader(); // or count.get()

// Read with change callback
reader((newValue) => console.log('Changed to:', newValue));
```

**`SignalWriter<T>`**

A function type for writing signal values.

```typescript
type SignalWriter<T> = (
  value: T | (() => T),
  params?: SignalWriterParams<T>,
) => void;
```

This is the type of the `.set` property on a `Signal<T>`. It accepts either a direct value or a function that returns a value.

**`SignalLike<T>`**

An interface representing objects that contain a signal implementation. Both `Signal<T>` and signal reader functions implement this interface.

```typescript
interface SignalLike<T> {
  [$signal]: ISignalImpl<T>;
}
```

#### Effect Types

**`Effect`**

The effect class returned by `createEffect()`. It has two key methods:

- `run()`: Manually trigger the effect
- `destroy()`: Stop and clean up the effect

**`EffectCallback`**

The callback function type for effects. Can optionally return a cleanup function.

```typescript
type EffectCallback = () => void | (() => void);
```

```typescript
import {createEffect, EffectCallback} from '@spearwolf/signalize';

const callback: EffectCallback = () => {
  console.log('Effect runs');
  return () => console.log('Cleanup runs');
};

createEffect(callback);
```

**`EffectOptions`**

Options for creating effects with `createEffect()`.

```typescript
interface EffectOptions {
  autorun?: boolean; // Run immediately (default: true)
  dependencies?: EffectDeps; // Static dependencies array
  attach?: object | SignalGroup; // Lifecycle management
  priority?: number; // Execution priority (default: 0)
}
```

#### Callback Types

**`ValueChangedCallback<T>`**

Callback type for signal change notifications, such as in `signal.onChange()`.

```typescript
type ValueChangedCallback<T> = (value: T) => void | (() => void);
```

**`CompareFunc<T>`**

Custom comparison function for signal values. Return `true` if values are considered equal (no change notification).

```typescript
type CompareFunc<T> = (a: T, b: T) => boolean;

// Example: deep equality for arrays
const arraySignal = createSignal([1, 2, 3], {
  compare: (a, b) =>
    a?.every((val, idx) => val === b?.[idx]) && a.length === b.length,
});
```

#### Parameter Types

**`SignalParams<T>`**

Options for creating signals with `createSignal()`.

```typescript
interface SignalParams<T> {
  lazy?: boolean; // Lazy initialization
  compare?: CompareFunc<T>; // Custom equality check
  beforeRead?: () => void; // Hook called before reading
  attach?: object | SignalGroup; // Lifecycle management
}
```

**`CreateMemoOptions`**

Options for creating memos with `createMemo()`.

```typescript
interface CreateMemoOptions {
  lazy?: boolean; // Lazy evaluation (default: false)
  attach?: object | SignalGroup; // Lifecycle management
  priority?: number; // Execution priority (default: 1000)
  name?: string | symbol; // Name within SignalGroup
}
```

**`LinkOptions`**

Options for creating links with `link()`.

```typescript
interface LinkOptions {
  attach?: object | SignalGroup; // Attach link to a group for lifecycle management
}
```

#### Utility Types

**`VoidFunc`**

A simple function type that takes no arguments and returns nothing.

```typescript
type VoidFunc = () => void;
```

Used for cleanup functions, unsubscribe callbacks, etc.

## ❤️ Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue. If you want to contribute code or documentation, please open a pull request.

## 📜 License

This project is licensed under the Apache-2.0 License. See the [LICENSE](./LICENSE) file for details.

The hero image above was created at the request of spearwolf using OpenAI's DALL-E and guided by ChatGPT. It was then animated by KLING AI and converted by Ezgif.com.
