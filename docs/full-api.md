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

Creates a computed signal.

- **computer**: `() => T` - Function to compute the value.
- **options**:
  - `lazy`: `boolean` (default: `false`) - If true, computes only on read.
  - `attach`: `object | SignalGroup`
  - `priority`: `number`
  - `name`: `string | symbol`
- **Returns**: `SignalReader<T>` (a function that returns the value).

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
    **Note:** Memos created via decorators are always **lazy** (calculated on read) and attached to the instance's `SignalGroup`.

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
