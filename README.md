`@spearwolf/signalize` - A lightweight JavaScript library for signals & effects.
Reactive programming, made simple. Works in Browser & Node.js.
Type-safe. Fast. No framework lock-in.

![npm (scoped)](https://img.shields.io/npm/v/%40spearwolf/signalize)
![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/spearwolf/signalize/main.yml)
![GitHub](https://img.shields.io/github/license/spearwolf/signalize)

![signalize hero](https://github.com/spearwolf/signalize/blob/main/hero.gif?raw=true)


# 📢 Signals and Effects for All

`@spearwolf/signalize` is a javascript library for creating fine-grained reactivity through __signals__ and __effects__.

- a __standalone__ javascript library that is _framework agnostic_
- __without side-effects__ and targets `ES2023` based environments
- written in __typescript__ v5 and uses the new [tc39 decorators](https://github.com/tc39/proposal-decorators) :rocket:
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
  - [Utilities](#-utilities)
    - [`batch`](#batch)
    - [`beQuiet` & `isQuiet`](#bequiet--isquiet)
    - [`hibernate`](#hibernate)
    - [`link` & `unlink`](#link--unlink)
    - [`SignalGroup`](#signalgroup)
    - [`SignalAutoMap`](#signalautomap)
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

- `get()`: A function to read the signal's value. Using `get()` inside an effect **creates a subscription**.
- `set(newValue)`: A function to write a new value to the signal.
- `value`: A getter/setter to read or write the signal's value. Reading via `.value` does **not** track dependencies in effects. Writing will trigger effects.
- `onChange(callback)`: A simple way to create a static effect that runs when the signal changes. Returns a function to destroy the subscription.
- `touch()`: Triggers all dependent effects without changing the signal's value.
- `destroy()`: Destroys the signal and cleans up all its dependencies.
- `muted`: A boolean property that indicates whether the signal is currently muted. Muted signals do not trigger effects when their value changes.

**Example:**

```typescript
import { createSignal } from '@spearwolf/signalize';

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
2. **`signal.value`**: This property provides direct access to the signal's value *without* creating a dependency. An effect that reads `.value` will not re-run when that signal changes.
3. **`value(signal)`**: This is a utility function that behaves identically to the `signal.value` property, providing a non-tracking read of the signal's value.

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
import { createSignal, createEffect, muteSignal, unmuteSignal } from '@spearwolf/signalize';

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

_**TODO** add an advanced section about signal objects, getter and setter functions._


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

- **Static**: You provide an explicit array of dependencies. The effect only runs when one of *those* signals changes, regardless of what's read inside.

  ```typescript
  const a = createSignal(1);
  const b = createSignal(2);

  // This effect ONLY depends on `a`, even though it reads `b`.
  createEffect(() => {
    console.log(`a=${a.get()}, b=${b.get()}`);
  }, [a]); // Static dependency on `a`

  b.set(99); // Does NOT trigger the effect
  a.set(10); // Triggers the effect
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

milliseconds.set(5000);  // Set interval to 5 seconds
// => "Previous timer cleared!"
// => "Create timer with 5000ms interval"

// => . . "tick" ...
```

#### Manual Control

Set `autorun: false` to create an effect that you control. It will only track dependencies and run when you explicitly call its `run()` method.

```typescript
const val = createSignal(0);

const effect = createEffect(() => console.log(val.get()), { autorun: false });
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

Effects can be nested, allowing you to create complex reactive flows. However, be cautious of circular dependencies, as they can lead to infinite loops.

_**TODO** Add more details about nested effects and circular dependencies._


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
import { signal, memo } from '@spearwolf/signalize/decorators';
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

### 🛠️ Utilities

#### `batch`

The `batch()` function allows you to apply multiple signal updates at once, but only trigger dependent effects a single time after all updates are complete.
This is a powerful optimization to prevent unnecessary re-renders or computations.

> [!CAUTION]
> `batch()` is a _hint_ not a _guarantee_ to run all effects in just _one_ strike!

```typescript
import { createSignal, createEffect, batch } from '@spearwolf/signalize';

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
import { createSignal, createEffect, beQuiet, isQuiet } from '@spearwolf/signalize';

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
import { createSignal, createEffect, batch, beQuiet, hibernate } from '@spearwolf/signalize';

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

#### `link` & `unlink`

`link()` creates a one-way binding from a source signal to a target signal or a callback function.
The target will be automatically updated whenever the source changes. `unlink()` removes this connection.

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

`link()` returns a _connection_ object with the following properties:

- `lastValue`: The last value that was set on the target when the source changed or the link was created.
- `nextValue(): Promise<ValueType>`: The next value that will be set on the target when the source changes.
- `*asyncValues(stopAction?: (value, index) => boolean)`: An async generator that yields the next values from the source signal until the connection is destroyed or stopped or the `stopAction` returns `true`.
- `touch()`: Triggers the next value immediately, without waiting for the source to change.
- `isMuted`: A boolean indicating whether the link is currently muted.
- `mute()`: A method to temporarily stop the link from updating the target.
- `unmute()`: A method to resume the link after it has been muted.
- `toggleMute()`: A method to toggle the muted state of the link.
- `attach(signalGroup)`: The `SignalGroup` to which the link is attached.
- `destroy()`: A method to remove the link and clean up resources.


#### `SignalGroup`

A `SignalGroup` is a helpful utility for managing the lifecycle of a collection of signals, effects, and links, typically associated with a class instance or component.
When you use decorators, a `SignalGroup` is automatically created. You can destroy all reactive elements in a group with a single call to `group.clear()`.

_**TODO** add more details about `SignalGroup` and its methods._

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
  console.log(`Position: ${map.get('x').get()}, ${map.get('y').get()}, ${map.get('z').get()}`);
});
// => Position: 0, 0, 0

// Update multiple values at once - effect runs only once
map.update(new Map([['x', 10], ['y', 20], ['z', 30]]));
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

## ❤️ Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue. If you want to contribute code or documentation, please open a pull request.

## 📜 License

This project is licensed under the Apache-2.0 License. See the [LICENSE](./LICENSE) file for details.

The hero image above was created at the request of spearwolf using OpenAI's DALL-E and guided by ChatGPT. It was then animated by KLING AI and converted by Ezgif.com.
