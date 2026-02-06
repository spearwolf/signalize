# Full API Reference

## Table of Contents

- [Signals](#signals)
- [Effects](#effects)
- [Memos](#memos)
- [Links (Signal Connections)](#links-signal-connections)
- [Decorators](#decorators)
- [Utilities](#utilities)
- [Object Signals API](#object-signals-api)

## Signals

### `createSignal<T>(initialValue?, options?)`

Creates a new signal.

- **initialValue**: The starting value.
- **options**:
  - `compare`: `(a, b) => boolean` - Custom equality function.
  - `lazy`: `boolean` - If true, `initialValue` is treated as a factory function.
  - `beforeRead`: `() => void` - Callback invoked before every `get()` call. Useful for side effects or lazy computations.
  - `attach`: `object | SignalGroup` - Attach to a group for lifecycle management.
- **Returns**: `Signal<T>`

### `Signal<T>`

The object returned by `createSignal`.

- **`get()`**: Returns the value and tracks dependency.
- **`set(value)`**: Updates the value.
- **`value`**: Getter/Setter for the value (getter does NOT track dependency).
- **`touch()`**: Triggers effects without changing value.
- **`onChange(callback)`**: Subscribes to changes. Returns unsubscribe function.
- **`destroy()`**: Destroys the signal.
- **`muted`**: `boolean` - Check or set muted state.

### `isSignal(value)`

Returns `true` if the value is a Signal instance.

### `muteSignal(signal)` / `unmuteSignal(signal)`

Temporarily prevents a signal from triggering effects.

### `destroySignal(...signals)`

Destroys one or more signals.

### `getSignalsCount()`

Returns the number of active signals.

---

## Effects

### `createEffect(callback, options?)`

Creates a reactive effect.

- **callback**: `() => void` - The function to run. Can return a cleanup function.
- **options**:
  - `autorun`: `boolean` (default: `true`) - Run immediately?
  - `dependencies`: `Signal[]` - Explicit list of dependencies (static effect).
  - `attach`: `object | SignalGroup` - Lifecycle management.
  - `priority`: `number` (default: `0`) - Execution priority.
  - Alternatively, instead of an `options` _object_, you can simply specify an array with the signal dependencies (static effect).
- **Returns**: `Effect`

### `Effect`

- **`run()`**: Manually runs the effect.
  - The effect callback is, of course, only executed if at least one dependency has changed since the last time.
- **`destroy()`**: Destroys the effect.

### `onCreateEffect(callback)` / `onDestroyEffect(callback)`

Global hooks for debugging/profiling effect creation and destruction.

### `getEffectsCount()`

Returns the number of active effects.

---

## Memos

### `createMemo<T>(computer, options?)`

Creates a computed signal (memo). A memo combines a signal with an effect: it tracks signal dependencies, caches the result, and can itself be read like a signal.

- **computer**: `() => T` - Function to compute the value. Any signals read via `.get()` inside this function become dependencies.
- **options**:
  - `lazy`: `boolean` (default: `false`) - Controls when recomputation happens. See [Non-Lazy vs. Lazy Memos](#non-lazy-vs-lazy-memos) below.
  - `attach`: `object | SignalGroup` - Attach to a group for lifecycle management.
  - `priority`: `number` (default: `1000`) - Execution priority for the internal effect. Higher values run first.
  - `name`: `string | symbol` - Name for the memo when attached to a group.
- **Returns**: `SignalReader<Type>` (a function that returns the computed value).

### Non-Lazy vs. Lazy Memos

The `lazy` option determines **when** a memo recalculates its value. Choosing the right mode depends on how the memo is used in your reactive graph.

#### Non-Lazy (Default: `lazy: false`)

A non-lazy memo acts as a **computed signal**: it recalculates immediately whenever any of its signal dependencies change, even if nobody is currently reading it.

This is the right choice when **effects or other memos depend on the memo's value**. Because the memo updates eagerly, any effect that reads it will always see the latest value and will be notified of changes just like with any other signal.

```typescript
const count = createSignal(1);

// Non-lazy: recalculates immediately when `count` changes
const doubled = createMemo(() => count.get() * 2);

// This effect depends on `doubled` — it will re-run whenever `doubled` updates
createEffect(() => {
  console.log('Doubled value:', doubled());
});
// => "Doubled value: 2"

count.set(5);
// `doubled` recalculates immediately (now 10)
// => "Doubled value: 10"
```

**When to use non-lazy memos:**
- The memo is a dependency of one or more effects
- The memo is read by other memos (chained computations)
- You need the memo to behave like a regular signal that always stays up-to-date

#### Lazy (`lazy: true`)

A lazy memo **does not react** to dependency changes on its own. Instead, it defers recomputation until the memo is actually **read**. The recalculation happens at the latest possible moment.

This is useful for expensive computations that may not be needed after every dependency change. However, because the memo does not eagerly update its value, **effects that depend on a lazy memo will not automatically re-run** when the memo's underlying dependencies change — the effect is only triggered when the memo is read and produces a new value.

```typescript
const count = createSignal(1);

// Lazy: does NOT recalculate until read
const doubled = createMemo(() => count.get() * 2, { lazy: true });

count.set(5);
// `doubled` has NOT recalculated yet

console.log(doubled()); // => 10 (recalculates now, on read)
```

**When to use lazy memos:**
- The computation is expensive and the result is not always needed
- The memo is read on-demand (e.g., in response to user interaction) rather than observed by effects
- You want to avoid unnecessary computations when dependencies change frequently

---

## Decorators

_Import from `@spearwolf/signalize/decorators`_

> [!IMPORTANT]
> The decorator API is still in the early stages of development and is not yet complete.
> It only uses the new JavaScript standard decorators, not the legacy or experimental TypeScript ones.

### `@signal(options?)`

Accessor decorator. Turns a class field into a signal.

- **options**:
  - `name`: `string | symbol` - Override the signal name (defaults to the property name).
  - `readAsValue`: `boolean` (default: `false`) - If `true`, the getter returns the value _without_ tracking dependencies (like `.value`). If `false`, it tracks dependencies (like `.get()`).
  - `compare`: `(a, b) => boolean` - Custom equality function.
  - `beforeRead`: `() => void` - Hook called before reading the signal.

### `@memo(options?)`

Method decorator. Turns a method into a lazy computed property.

- **options**:
  - `name`: `string | symbol` - Override the memo name (defaults to the method name).
    **Note:** Memos created via decorators are always **lazy** (recomputed on read, not on dependency change) and attached to the instance's `SignalGroup`. See [Non-Lazy vs. Lazy Memos](#non-lazy-vs-lazy-memos) for details on what this means.

---

## Utilities

### `batch(callback)`

Delays effect execution until the callback finishes. Useful for multiple updates.
**Note:** This is a hint, not a guarantee. The library may still propagate changes in steps in certain situations.

### `beQuiet(callback)`

Executes callback without tracking dependencies (even if signals are read).

### `isQuiet()`

Returns `true` if currently inside a `beQuiet` block.

### `hibernate(callback)`

Suspends all reactive context (batching, tracking, etc.) for the duration of the callback.
**Note:** New contexts (like `batch` or effects) can still be created and will function normally within the callback.

### `touch(signal)`

Manually triggers updates for a signal.

### `value(signal)`

Helper to read a signal's value without tracking (equivalent to `signal.value`).

---

## Links (Signal Connections)

Links create explicit one-way data flows between signals, inspired by visual programming tools. They enable modular, graph-like reactive architectures.

### `link(source, target, options?)`

Creates a one-way binding from source to target.

- **source**: `SignalReader<T> | Signal<T>` - The signal to read from.
- **target**: `SignalReader<T> | Signal<T> | (value: T) => void` - The signal or callback to write to.
- **options**:
  - `attach?: object` - Attach the link to a SignalGroup for lifecycle management.
- **Returns**: `SignalLink<T>` - The connection object.

```typescript
const source = createSignal(1);
const target = createSignal(0);
const connection = link(source, target);
```

### `unlink(source, target?)`

Removes a link between signals.

- **source**: The source signal.
- **target** (optional): The specific target to unlink. If omitted, unlinks all targets from the source.

```typescript
unlink(source, target); // Unlink specific connection
unlink(source); // Unlink all connections from source
```

### `getLinksCount(source?)`

Returns the number of active links.

- **source** (optional): If provided, returns count for this specific source. If omitted, returns total count of all links.

```typescript
console.log(getLinksCount()); // Total links
console.log(getLinksCount(signal)); // Links from this signal
```

### `SignalLink<T>`

The connection object returned by `link()`.

**Properties:**

- `lastValue: T` - The last value that was synchronized.
- `source: ISignalImpl<T>` - Reference to the source signal implementation.
- `isDestroyed: boolean` - Whether the link has been destroyed.
- `isMuted: boolean` - Whether the link is currently muted.

**Methods:**

- `touch(): this` - Forces the current value to be written to the target.
- `mute(): this` - Pauses the link without destroying it.
- `unmute(): this` - Resumes the link.
- `toggleMute(): boolean` - Toggles muted state, returns new state.
- `attach(object): SignalGroup` - Attaches the link to a group.
- `destroy(): void` - Destroys the link and cleans up.
- `nextValue(): Promise<T>` - Returns a promise that resolves to the next value.
- `asyncValues(stopAction?): AsyncGenerator<T>` - Async generator yielding values.

**Events** (using `@spearwolf/eventize`):

- `'value'` - Emitted when a new value is synchronized.
- `'mute'` - Emitted when the link is muted.
- `'unmute'` - Emitted when the link is unmuted.
- `'destroy'` - Emitted when the link is destroyed.

---

## SignalGroup

A utility for managing the lifecycle of collections of signals, effects, and links. Essential for building modular architectures where groups act as nodes or modules.

### Static Methods

#### `SignalGroup.findOrCreate(object)`

Gets or creates a group associated with an object.

#### `SignalGroup.get(object)`

Gets existing group or returns `undefined`.

#### `SignalGroup.delete(object)`

Clears and removes the group for an object.

#### `SignalGroup.clear()`

Clears all groups globally.

### Instance Methods

- **`attachSignal(signal)`** - Adds a signal to the group.
- **`attachSignalByName(name, signal?)`** - Associates a signal with a name.
- **`detachSignal(signal)`** - Removes a signal (doesn't destroy it).
- **`hasSignal(name)`** - Checks if a named signal exists.
- **`signal(name)`** - Returns the signal with the given name.
- **`attachEffect(effect)`** - Adds an effect to the group.
- **`attachLink(link)`** - Adds a link to the group.
- **`detachLink(link)`** - Removes a link (doesn't destroy it).
- **`attachGroup(group)`** - Adds a child group.
- **`detachGroup(group)`** - Removes a child group.
- **`clear()`** - Destroys everything in the group.
- **`runEffects()`** - Manually runs all effects in the group.

---

## SignalAutoMap

A Map-like class that automatically creates signals for accessed keys. Useful for dynamic collections.

### `new SignalAutoMap()`

Creates an empty auto-map.

### `SignalAutoMap.fromProps(props, keys?)`

Creates an auto-map from an object.

- **props**: Object with initial values.
- **keys** (optional): Array of specific keys to include.

### Instance Methods

- **`get<T>(key): Signal<T>`** - Returns (or creates) the signal for the key.
- **`has(key): boolean`** - Checks if a key exists.
- **`update(map: Map)`** - Batch updates from a Map (batched).
- **`updateFromProps(props: object, keys?)`** - Batch updates from an object (batched).
- **`keys(): IterableIterator`** - Iterates over keys.
- **`signals(): IterableIterator`** - Iterates over signals.
- **`entries(): IterableIterator`** - Iterates over [key, signal] pairs.
- **`clear(): void`** - Destroys all signals.

---

## Object Signals API

Advanced functions for managing signals attached to objects (used by decorators).

### `findObjectSignalByName(object, name)`

Returns the signal attached to the object with the given name, or `undefined`.

### `findObjectSignals(object)`

Returns an array of all signals attached to the object.

### `findObjectSignalNames(object)`

Returns an array of names of all signals attached to the object.

### `destroyObjectSignals(...objects)`

Destroys all signals attached to the given objects.

---

## TypeScript Types

Key types exported by the library:

- `Signal<T>` - The signal object type
- `SignalReader<T>` - Function type for reading a signal
- `SignalWriter<T>` - Function type for writing a signal
- `SignalLike<T>` - Interface for signal-like objects
- `Effect` - The effect object type
- `EffectCallback` - Function type for effect callbacks: `() => void | (() => void)`
- `EffectOptions` - Options for `createEffect()`
- `CreateMemoOptions` - Options for `createMemo()`
- `SignalParams<T>` - Options for `createSignal()`
- `CompareFunc<T>` - Custom equality function type: `(a: T, b: T) => boolean`
- `BeforeReadFunc` - Callback type for `beforeRead`: `() => void`
- `VoidFunc` - Simple void function type: `() => void`
- `ValueChangedCallback<T>` - Callback for signal changes: `(value: T) => void`
- `SignalGroup` - Class for lifecycle management
- `SignalAutoMap` - Auto-creating signal map class
