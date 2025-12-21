# Full API Reference

## Table of Contents

- [Signals](#signals)
- [Effects](#effects)
- [Memos](#memos)
- [Decorators](#decorators)
- [Utilities](#utilities)
- [Connections between Signals](#connections-between-signals)
- [SignalGroup](#signalgroup)
- [SignalAutoMap](#signalautomap)
- [Object Signals API](#object-signals-api)

## Signals

### `createSignal<T>(initialValue?, options?)`
Creates a new signal.
- **initialValue**: The starting value.
- **options**:
  - `compare`: `(a, b) => boolean` - Custom equality function.
  - `lazy`: `boolean` - If true, `initialValue` is treated as a factory function.
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
- **callback**: `() => void | (() => void)` - The function to run. Can return a cleanup function.
- **options**:
  - `autorun`: `boolean` (default: `true`) - Run immediately?
  - `dependencies`: `Signal[]` - Explicit list of dependencies (static effect).
  - `attach`: `object | SignalGroup` - Lifecycle management.
  - `priority`: `number` (default: `0`) - Execution priority.
- **Returns**: `Effect`

### `Effect`
- **`run()`**: Manually runs the effect.
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
*Import from `@spearwolf/signalize/decorators`*

### `@signal(options?)`
Accessor decorator. Turns a class field into a signal.
- **options**:
  - `name`: `string | symbol` - Override the signal name (defaults to the property name).
  - `readAsValue`: `boolean` (default: `false`) - If `true`, the getter returns the value *without* tracking dependencies (like `.value`). If `false`, it tracks dependencies (like `.get()`).
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

## Connections between Signals

### `link(source, target, options?)`
Creates a one-way binding.
- **source**: Signal or Reader.
- **target**: Signal or Callback.
- **options**: `{ attach?: object }`
- **Returns**: `SignalLink`

### `unlink(source, target?)`
Removes a link.

---

## SignalGroup

Helper for managing collections of reactive objects.

### `SignalGroup.findOrCreate(object)`
Gets or creates a group associated with an object.

### `SignalGroup.get(object)`
Gets existing group or undefined.

### `SignalGroup.clear()`
Clears all groups globally.

### Instance Methods
- **`attachSignal(signal)`**
- **`attachEffect(effect)`**
- **`attachLink(link)`**
- **`clear()`**: Destroys everything in the group.
- **`runEffects()`**: Manually runs all effects in the group.

---

## SignalAutoMap

A Map implementation that auto-creates signals for keys.

### `new SignalAutoMap()`
### `SignalAutoMap.fromProps(props)`
### Instance Methods
- **`get(key)`**: Returns (or creates) the signal for the key.
- **`has(key)`**
- **`update(map)`**
- **`updateFromProps(props)`**
- *Object Signals API

Advanced functions for managing signals attached to objects (used by decorators).

### `findObjectSignalByName(object, name)`
Returns the signal attached to the object with the given name, or `undefined`.
SignalLike<T>`
- `EffectCallback`
- `EffectOptions`
- `CreateMemoOptions`
- `VoidFuncall signals attached to the object.

### `findObjectSignalNames(object)`
Returns an array of names of all signals attached to the object.

### `destroyObjectSignals(...objects)`
Destroys all signals attached to the given objects.
