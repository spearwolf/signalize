# SignalAutoMap

A Map-like structure that **automatically creates signals** when accessing keys. Ideal for dynamic collections of signals.

## Creating a SignalAutoMap

### Empty Map

```typescript
import {SignalAutoMap} from '@spearwolf/signalize';

const signals = new SignalAutoMap();
```

### From Object Properties

```typescript
const user = {name: 'John', age: 30, email: 'john@example.com'};

// All properties
const signals = SignalAutoMap.fromProps(user);

// Specific properties only
const signals = SignalAutoMap.fromProps(user, ['name', 'email']);
```

### From Derived Object (Prototype Chain)

```typescript
class Base {
  a = 1;
}
class Derived extends Base {
  b = 2;
}

const obj = new Derived();
const signals = SignalAutoMap.fromProps(obj, ['a', 'b']); // Works with inherited
```

## Accessing Signals

### Auto-Creating Access

`get()` automatically creates a signal if it doesn't exist:

```typescript
const signals = new SignalAutoMap();

// Signal created on first access (with undefined value)
const nameSignal = signals.get('name');
nameSignal.set('John');
nameSignal.get(); // 'John'

// Type-safe access
const count = signals.get<number>('count');
```

### Check Without Creating

`has()` checks existence WITHOUT creating:

```typescript
signals.has('name'); // false - not yet accessed
signals.get('name'); // Creates signal
signals.has('name'); // true - now exists
```

## Updating Values

### From Map (Batched)

Updates are batched - effects run once, not per-signal:

```typescript
const updates = new Map([
  ['name', 'Jane'],
  ['age', 25],
]);

signals.update(updates); // Effects run once after all updates
```

### From Object Properties

```typescript
const newData = {name: 'Jane', age: 25, extra: 'ignored'};

// Update specific keys
signals.updateFromProps(newData, ['name', 'age']);

// Update all keys from object
signals.updateFromProps(newData);
```

## Iteration

```typescript
// Iterate over signals
for (const signal of signals.signals()) {
  console.log(signal.value);
}

// Iterate over keys
for (const key of signals.keys()) {
  console.log(key);
}

// Iterate over entries
for (const [key, signal] of signals.entries()) {
  console.log(key, signal.value);
}
```

## Cleanup

```typescript
signals.clear(); // Destroys all signals, empties the map
```

**Important:** SignalAutoMap does NOT automatically attach to SignalGroups. Call `clear()` explicitly.

## Use Cases

### Dynamic Form Fields

```typescript
const formFields = new SignalAutoMap();

// Fields created as needed
formFields.get('username').set('');
formFields.get('password').set('');

// Validate all fields
createEffect(() => {
  for (const signal of formFields.signals()) {
    validate(signal.get());
  }
});

// Reset form
formFields.clear();
```

### Sync with API Data

```typescript
const dataSignals = SignalAutoMap.fromProps(initialData);

// Update from API response
async function refresh() {
  const data = await fetch('/api/data').then((r) => r.json());
  dataSignals.updateFromProps(data); // Batched update
}
```

### Entity Collections

```typescript
const userSignals = new SignalAutoMap();

function getUser(id: string) {
  return userSignals.get(id);
}

getUser('user-1').set({name: 'Alice'});
getUser('user-2').set({name: 'Bob'});

// React to specific user changes
createEffect(() => {
  console.log('User 1:', getUser('user-1').get());
});
```

### Settings/Config

```typescript
const settings = SignalAutoMap.fromProps({
  theme: 'light',
  fontSize: 14,
  language: 'en',
});

// Components can subscribe to specific settings
createEffect(() => {
  applyTheme(settings.get('theme').get());
});

// Bulk update from preferences
settings.updateFromProps(savedPreferences);
```

## Key Behaviors

| Behavior         | Description                                      |
| ---------------- | ------------------------------------------------ |
| Auto-creation    | `get(key)` creates signal if not exists          |
| No auto-creation | `has(key)` checks without creating               |
| Batched updates  | `update()` and `updateFromProps()` batch changes |
| Symbol keys      | Fully supported alongside string keys            |
| undefined values | Preserved (signal created with undefined)        |

## Integration with Effects

```typescript
const fields = SignalAutoMap.fromProps({a: 1, b: 2, c: 3});

// React to any field change
createEffect(() => {
  for (const signal of fields.signals()) {
    signal.get(); // Track all
  }
  console.log('Something changed');
});

// React to specific field
createEffect(() => {
  console.log('A is now:', fields.get('a').get());
});
```

## Integration with SignalGroup

To manage lifecycle, manually attach signals:

```typescript
const group = SignalGroup.findOrCreate(this);
const signals = new SignalAutoMap();

// After creating signals, attach to group
for (const signal of signals.signals()) {
  group.attachSignal(signal);
}

// Or clear manually
signals.clear();
```

## Pitfalls

### 1. get() always creates

```typescript
// This creates a signal even if you just want to check
signals.get('maybeExists');

// Use has() to check without creating
if (signals.has('maybeExists')) {
  signals.get('maybeExists');
}
```

### 2. No automatic lifecycle management

```typescript
// SignalAutoMap doesn't auto-attach to groups
// Must call clear() or manually attach to group
signals.clear(); // Don't forget!
```

### 3. Empty update does nothing

```typescript
signals.update(new Map()); // No-op, existing values preserved
```
