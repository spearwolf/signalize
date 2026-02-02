# Signal Patterns

## Reading Signals

### Inside Reactive Context (Effects/Memos)

Always use `.get()` to create dependencies:

```typescript
createEffect(() => {
  const val = signal.get(); // Tracked - effect re-runs on change
});

const computed = createMemo(() => {
  return signal.get() * 2; // Tracked - memo recomputes on change
});
```

### Outside Reactive Context

Use `.value` or `value()` for one-time reads:

```typescript
// With Signal object
console.log(signal.value);

// With SignalReader only
const {get: signal} = createSignal(0);
console.log(value(signal));
```

## Destructuring Patterns

### When to Keep Signal Object

Keep the full Signal object when you need:

- `.onChange()` subscriptions
- `.destroy()` method
- `.touch()` method
- `.value` property

```typescript
const count = createSignal(0);

count.onChange((val) => saveToLocalStorage(val));

// Later
count.destroy();
```

### When to Destructure

Destructure when you only need get/set:

```typescript
const {get: count, set: setCount} = createSignal(0);

createEffect(() => {
  console.log(count()); // Use as function
});

setCount(1);
```

### Mixed Pattern

```typescript
const count = createSignal(0);
const {get, set} = count;

// Use destructured for concise access
createEffect(() => console.log(get()));
set(1);

// Use object for other operations
count.onChange(callback);
count.destroy();
```

## Signal Lifecycle

### Creation with Cleanup

```typescript
function createCounter() {
  const count = createSignal(0);

  return {
    get: count.get.bind(count),
    increment: () => count.set(count.value + 1),
    destroy: () => count.destroy(),
  };
}

const counter = createCounter();
counter.increment();
counter.destroy(); // Cleanup
```

### Destruction Cascades

When a signal is destroyed:

1. All dependent effects lose this signal as dependency
2. Effects with no remaining dependencies are destroyed
3. All links from this signal are destroyed

```typescript
const a = createSignal(1);
const b = createSignal(2);

createEffect(() => {
  console.log(a.get(), b.get());
});

destroySignal(a); // Effect still alive (depends on b)
destroySignal(b); // Effect now destroyed (no dependencies)
```

## Conditional Dependencies

Dynamic effects only track signals actually read in the current execution:

```typescript
const showDetails = createSignal(false);
const summary = createSignal('Summary');
const details = createSignal('Details');

createEffect(() => {
  if (showDetails.get()) {
    console.log(details.get()); // Only tracked when showDetails is true
  } else {
    console.log(summary.get()); // Only tracked when showDetails is false
  }
});

// Initially: effect depends on showDetails + summary
summary.set('New Summary'); // Effect re-runs
details.set('New Details'); // Effect does NOT re-run

showDetails.set(true);
// Now: effect depends on showDetails + details
details.set('More Details'); // Effect re-runs
summary.set('Ignored'); // Effect does NOT re-run
```

## Touch for Force Update

Use `touch()` to notify dependents without changing the value:

```typescript
const data = createSignal({items: []});

// Mutate in place (not recommended, but sometimes needed)
data.value.items.push(newItem);

// Force notification since reference didn't change
data.touch();
```

## Batch Multiple Signal Updates

When updating multiple signals, use `batch()` to prevent multiple effect runs:

```typescript
import {batch} from '@spearwolf/signalize';

const firstName = createSignal('');
const lastName = createSignal('');

createEffect(() => {
  console.log(`${firstName.get()} ${lastName.get()}`);
});

// Without batch: effect runs twice
firstName.set('John'); // Effect runs
lastName.set('Doe'); // Effect runs again

// With batch: effect runs once
batch(() => {
  firstName.set('Jane');
  lastName.set('Smith');
}); // Effect runs once here
```

## Muting for Bulk Updates

Temporarily suppress notifications:

```typescript
muteSignal(signal);

// Multiple updates without triggering effects
for (const value of values) {
  signal.set(value);
}

unmuteSignal(signal);
signal.touch(); // Notify once with final value
```
