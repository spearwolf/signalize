# Link Async Patterns

## nextValue()

Get a Promise that resolves with the next value change:

```typescript
const source = createSignal(0);
const target = createSignal(0);
const conn = link(source, target);

const next = conn.nextValue();

source.set(42);

await next; // Resolves to 42
```

### Behavior

- Resolves on the **next** value change (not current value)
- Each call returns a **new** Promise
- Promise value is immutable after resolution

```typescript
const promise = conn.nextValue();

source.set(1);
await promise; // 1

source.set(2);
await promise; // Still 1 - already resolved
```

### On Destroy

If the link is destroyed before next value, the promise rejects:

```typescript
const promise = conn.nextValue();
conn.destroy();

await promise; // Rejects with undefined
```

### Use Cases

#### Wait for specific condition

```typescript
async function waitForPositive(conn: SignalLink<number>) {
  while (true) {
    const value = await conn.nextValue();
    if (value > 0) return value;
  }
}
```

#### Timeout pattern

```typescript
const next = conn.nextValue();
const timeout = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Timeout')), 5000),
);

const value = await Promise.race([next, timeout]);
```

## asyncValues()

Get an AsyncGenerator to iterate over future values:

```typescript
const source = createSignal(0);
const target = createSignal(0);
const conn = link(source, target);

// Process values as they arrive
for await (const value of conn.asyncValues()) {
  console.log('Got:', value);

  if (value >= 10) break; // Stop condition
}
```

### Stop Function

Provide a stop function to control iteration:

```typescript
// Stop after 5 values
for await (const value of conn.asyncValues((val, index) => index >= 5)) {
  process(value);
}
```

The stop function receives:

- `value`: The current value
- `index`: Zero-based iteration count

### Use Cases

#### Process stream of values

```typescript
async function processStream() {
  for await (const data of conn.asyncValues()) {
    await sendToServer(data);
  }
}
```

#### Collect values until condition

```typescript
async function collectUntilDone() {
  const results = [];

  for await (const value of conn.asyncValues((v) => v === 'DONE')) {
    results.push(value);
  }

  return results;
}
```

#### Batch processing

```typescript
async function processBatches() {
  const batch = [];

  for await (const value of conn.asyncValues()) {
    batch.push(value);

    if (batch.length >= 10) {
      await processBatch(batch);
      batch.length = 0;
    }
  }
}
```

## Combining with Signals

### Update signal from async source

```typescript
const data = createSignal<Data | null>(null);
const status = createSignal('idle');

async function startStream() {
  status.set('streaming');

  for await (const value of conn.asyncValues()) {
    data.set(value);
  }

  status.set('done');
}
```

### Cancellation

```typescript
let shouldStop = false;

async function processWithCancel() {
  for await (const value of conn.asyncValues(() => shouldStop)) {
    await process(value);
  }
}

// Later: cancel
shouldStop = true;
```

## Important Notes

### 1. asyncValues() yields future values only

The iterator does not yield the current value, only future changes:

```typescript
source.set(1); // Current value

for await (const val of conn.asyncValues()) {
  // First yield is when source.set() is called AFTER this line
}
```

### 2. Breaking out of iteration

Always provide an exit condition or use `break`:

```typescript
// With stop function
for await (const v of conn.asyncValues((_, i) => i >= 100)) {
}

// With break
for await (const v of conn.asyncValues()) {
  if (done) break;
}
```

### 3. Link destruction ends iteration

```typescript
const iterator = conn.asyncValues();

// In another context
conn.destroy();

// Iterator will complete (no error, just stops)
```

### 4. Error handling

```typescript
try {
  for await (const value of conn.asyncValues()) {
    await riskyOperation(value);
  }
} catch (error) {
  console.error('Stream error:', error);
}
```

## Comparison

| Method          | Returns             | Yields   | Use Case                  |
| --------------- | ------------------- | -------- | ------------------------- |
| `nextValue()`   | `Promise<T>`        | Once     | Wait for single change    |
| `asyncValues()` | `AsyncGenerator<T>` | Multiple | Process stream of changes |
