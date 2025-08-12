`@spearwolf/signalize`

![npm (scoped)](https://img.shields.io/npm/v/%40spearwolf/signalize)
![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/spearwolf/signalize/main.yml)
![GitHub](https://img.shields.io/github/license/spearwolf/signalize)

<figure>
  <figcaption>
    <sub>Image created at the request of spearwolf using OpenAI's DALL-E, guided by ChatGPT, animated by KLING AI and converted by Ezgif.com</sub>
  </figcaption>

  ![signalize hero](hero.gif)
</figure>

# 📢 "Signals and effects for all"

`@spearwolf/signalize` is a javascript library for creating fine-grained reactivity through __signals__ and __effects__.

- a __standalone__ javascript library that is framework agnostic
- __without side-effects__ and targets `ES2023` based environments
- written in __typescript__ v5 and uses the new [tc39 decorators](https://github.com/tc39/proposal-decorators) :rocket:
  - however, it is optional and not necessary to use the decorators

> [!NOTE]
> Reactivity is the secret sauce to building modern, dynamic web apps. `@spearwolf/signalize` makes it easy. No frameworks, no boilerplate, just pure reactivity.

---

## Table of Contents

- [Introduction](#-introduction)
  - [Core Concepts](#-core-concepts)
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
  - [Memos (Computed Signals)](#-memos-computed-signals)
    - [`createMemo`](#creatememo)
  - [Decorators (Class-based API)](#-decorators-class-based-api)
    - [`@signal`](#signal)
    - [`@memo`](#memo)
  - [Utilities](#-utilities)
    - [`batch`](#batch)
    - [`beQuiet` & `isQuiet`](#bequiet--isquiet)
    - [`link` & `unlink`](#link--unlink)
    - [`SignalGroup`](#signalgroup)
    - [`SignalAutoMap`](#signalautomap)
- [Contributing](#-contributing)
- [License](#-license)

> [!IMPORTANT]
> The documentation is a work in progress. Although every effort is made to ensure completeness and logical structure, there is always room for improvement, and some topics are not fully explained. Therefore, it is advisable to review the test specifications as well.
> The API itself is almost stable and is already being used successfully in several internal projects.

---

## 🚀 Introduction

`@spearwolf/signalize` brings the power of fine-grained reactivity to any JavaScript or TypeScript project.
It's a lightweight, standalone library that helps you manage state and build data flows that automatically update when your data changes.

Forget about manual DOM updates or complex state management logic. With signals, you create reactive values, and with effects, you create functions that automatically run whenever those values change. It's that simple.

### Core Concepts

- **Signals**: Think of them as reactive variables. When a signal's value changes, it automatically notifies everything that depends on it. It's like a spreadsheet cell that magically updates all formulas that use it.

- **Effects**: These are the functions that "listen" to signals. An effect subscribes to one or more signals and re-executes automatically whenever any of its dependencies change, keeping your app perfectly in sync.

- **Memos**: These are special signals whose values are computed from other signals. The library caches their result and only re-evaluates them when one of their dependencies changes, giving you performance for free.

This library offers both a clean **functional API** and a convenient **class-based API using decorators**.

## ⚙️ Getting Started

First, install the package using your favorite package manager:

```shell
npm install @spearwolf/signalize
```

Now, let's see it in action. Here’s a simple example that automatically logs the signal value to the console whenever it changes.

```typescript
import { createSignal, createEffect } from '@spearwolf/signalize';

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
  - `attach`: Attaches the signal to a `SignalGroup` for easier lifecycle management.

`createSignal` returns a `Signal` object with the following properties:

- `value`: A getter/setter to read or write the signal's value. Reading via `.value` does **not** track dependencies in effects. Writing will trigger effects.
- `get()`: A function to read the signal's value. Using `get()` inside an effect **creates a subscription**.
- `set(newValue)`: A function to write a new value to the signal.
- `onChange(callback)`: A simple way to create a static effect that runs when the signal changes. Returns a function to destroy the subscription.
- `touch()`: Triggers all dependent effects without changing the signal's value.
- `destroy()`: Destroys the signal and cleans up all its dependencies.

**Example:**

```typescript
import { createSignal } from '@spearwolf/signalize';

// A signal holding a number
const count = createSignal(10);

// A signal holding an object, with a custom comparison function
const user = createSignal({ id: 1, name: 'Alice' }, {
  compare: (a, b) => a.id === b.id,
});

console.log(count.value); // => 10

count.value = 20;
console.log(count.value); // => 20

// This update will NOT trigger effects because the custom compare function returns true
user.value = { id: 1, name: 'Alice V2' };
```

#### Reading Signals

It's important to understand the difference between dependency-tracking reads and non-tracking reads.

1.  **`signal.get()`**: This is the primary way to read a signal's value and have an effect subscribe to its changes. You must call it as a function: `signal.get()`.
2.  **`signal.value`**: This property provides direct access to the signal's value *without* creating a dependency. An effect that reads `.value` will not re-run when that signal changes.
3.  **`value(signal)`**: This is a utility function that behaves identically to the `signal.value` property, providing a non-tracking read of the signal's value.

**Choose wisely:** Use `.get()` when you want reactivity. Use `.value` or `value()` when you need to peek at a value without creating a subscription.

```typescript
import { createSignal, createEffect } from '@spearwolf/signalize';

const name = createSignal('John');
const age = createSignal(30);

createEffect(() => {
  // This effect depends on `name` (using .get()) but NOT on `age` (using .value)
  console.log(`Name: ${name.get()}, Age: ${age.value}`);
});
// Console output: Name: John, Age: 30

name.value = 'Jane'; // Triggers the effect because we used .get()
// Console output: Name: Jane, Age: 30

age.value = 31; // Does NOT trigger the effect, because we read it with .value
```

#### Writing Signals

1.  **`signal.value = newValue`**: The most direct way to set a new value.
2.  **`signal.set(newValue)`**: The functional equivalent.
3.  **`touch(signal)`**: Triggers effects without changing the value. Useful for forcing re-renders or re-evaluations.

#### Muting Signals

You can temporarily prevent a signal from triggering effects using `muteSignal` and `unmuteSignal`.

```typescript
import { createSignal, createEffect, muteSignal, unmuteSignal } from '@spearwolf/signalize';

const sig = createSignal('hello');

createEffect(() => console.log(sig.get())); // => "hello"

muteSignal(sig);
sig.value = 'world'; // Nothing is logged

unmuteSignal(sig);
sig.value = 'world again'; // => "world again"
```

The `Signal` object also has a `.muted` property: `sig.muted = true`.

#### Destroying Signals

To clean up a signal and all its associated effects and dependencies, use `destroySignal`.

```typescript
destroySignal(mySignal, anotherSignal);
```

You can also call the `.destroy()` method on the signal object itself.

### 🎭 Effects

Effects are where the magic happens. They are self-managing functions that react to changes in your signals.

#### `createEffect`

Creates a new effect.

```typescript
createEffect(callback: () => void | (() => void), options?: EffectOptions): Effect
```

- `callback`: The function to execute. It can optionally return a *cleanup function*, which runs before the next effect execution or on destruction.
- `options`:
  - `dependencies`: An array of signals to subscribe to, creating a **static effect**. If omitted, the effect is **dynamic**.
  - `autorun`: If `false`, the effect will not run automatically. You must call `.run()` manually.
  - `attach`: Attaches the effect to a `SignalGroup`.

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

  show.value = true; // Effect re-runs
  data.value = 'B'; // Effect re-runs
  show.value = false; // Effect re-runs
  data.value = 'C'; // Effect does NOT re-run
  ```

- **Static**: You provide an explicit array of dependencies. The effect only runs when one of *those* signals changes, regardless of what's read inside.

  ```typescript
  const a = createSignal(1);
  const b = createSignal(2);

  // This effect ONLY depends on `a`, even though it reads `b`.
  createEffect(() => {
    console.log(`a=${a.get()}, b=${b.get()}`);
  }, [a]); // Static dependency on `a`

  b.value = 99; // Does NOT trigger the effect
  a.value = 10; // Triggers the effect
  ```

#### Cleanup Logic

An effect can return a function that will be executed to "clean up" its last run. This is perfect for managing subscriptions, timers, or other side effects.

```typescript
createEffect(() => {
  const timerId = setInterval(() => {
    console.log('tick');
  }, 1000);

  // This cleanup function runs when the effect is destroyed
  return () => {
    clearInterval(timerId);
    console.log('Timer cleared!');
  };
});
```

#### Manual Control

Set `autorun: false` to create an effect that you control. It will only track dependencies and run when you explicitly call its `run()` method.

```typescript
const sig = createSignal(0);
const effect = createEffect(() => console.log(sig.get()), { autorun: false });

console.log('Effect created, but not run.');

effect.run(); // => 0

sig.value = 10; // Does nothing
effect.run(); // => 10

sig.value = 10; // Does nothing
effect.run(); //  Does nothing, because the value didn't change
```

### 🧠 Memos (Computed Signals)

Memos are signals whose values are derived from other signals. They are lazy and only recompute when a dependency changes.

#### `createMemo`

Creates a new memoized signal.

```typescript
createMemo<T>(computer: () => T, options?: CreateMemoOptions): SignalReader<T>
```

- `computer`: The function that computes the value.
- `options`:
  - `attach`: Attaches the memo to a `SignalGroup`.
  - `name`: Gives the memo a name within its group.

It returns a `SignalReader` function, which you call to get the memo's current value.

**Example:**

```typescript
import { createSignal, createMemo } from '@spearwolf/signalize';

const firstName = createSignal('John');
const lastName = createSignal('Doe');

const fullName = createMemo(() => {
  console.log('Computing full name...');
  // We must use .get() to establish dependencies inside the memo
  return `${firstName.get()} ${lastName.get()}`;
});

console.log(fullName()); // "Computing full name..." -> "John Doe"
console.log(fullName()); // (no log, value is cached) -> "John Doe"

firstName.value = 'Jane';
console.log(fullName()); // "Computing full name..." -> "Jane Doe"
```

### 💎 Decorators (Class-based API)

For those who prefer object-oriented patterns, `@spearwolf/signalize` provides decorators for creating signals and memos within classes.

**Import decorators from the separate entry point:**

```typescript
import { signal, memo } from '@spearwolf/signalize/decorators';
```

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

### 🛠️ Utilities

#### `batch`

The `batch` function allows you to apply multiple signal updates at once, but only trigger dependent effects a single time after all updates are complete. This is a powerful optimization to prevent unnecessary re-renders or computations.

```typescript
const a = createSignal(1);
const b = createSignal(2);

createEffect(() => console.log(`a=${a.get()}, b=${b.get()}`));
// => a=1, b=2

batch(() => {
  a.value = 10; // Effect does not run yet
  b.value = 20; // Effect does not run yet
}); // Effect runs once at the end
// => a=10, b=20
```

#### `beQuiet` & `isQuiet`

`beQuiet` executes a function without creating any signal dependencies within it. `isQuiet` can be used to check if you are currently inside a `beQuiet` call.

#### `link` & `unlink`

`link` creates a one-way binding from a source signal to a target signal or a callback function. The target will be automatically updated whenever the source changes. `unlink` removes this connection.

```typescript
const source = createSignal('A');
const target = createSignal('');

const connection = link(source, target);
console.log(target.value); // => "A" (value is synced on link)

source.value = 'B';
console.log(target.value); // => "B"

// Stop the connection
connection.destroy(); // or unlink(source, target);

source.value = 'C';
console.log(target.value); // => "B" (no longer updates)
```

#### `SignalGroup`

A `SignalGroup` is a powerful utility for managing the lifecycle of a collection of signals, effects, and links, typically associated with a class instance or component. When you use decorators, a `SignalGroup` is automatically created. You can destroy all reactive elements in a group with a single call to `group.clear()`.

#### `SignalAutoMap`

A `Map`-like class that automatically creates a `Signal` for any key that is accessed but doesn't yet exist. This is useful for managing dynamic collections of reactive state.

```typescript
const map = new SignalAutoMap();

// Accessing 'foo' for the first time creates a signal for it
map.get('foo').value = 'hello';

createEffect(() => {
  console.log(map.get('foo').get());
});
// => "hello"

map.get('foo').value = 'world';
// => "world"
```

## ❤️ Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue. If you want to contribute code, please open a pull request.

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
