---
name: signalize-testing
description: 'Testing patterns for @spearwolf/signalize code: assert helpers for counting signals/effects/links, subscription leak detection, cleanup verification patterns. Use when writing tests for signalize-based code.'
---

# Signalize Testing

## Overview

Testing signalize code requires attention to:

1. **Cleanup verification** - No leaked signals, effects, or links
2. **Subscription tracking** - No orphaned subscriptions
3. **State isolation** - Tests don't affect each other

## Count Assertions

### getSignalsCount()

```typescript
import {
  getSignalsCount,
  createSignal,
  destroySignal,
} from '@spearwolf/signalize';

// Check active signals
expect(getSignalsCount()).toBe(0);

const sig = createSignal(0);
expect(getSignalsCount()).toBe(1);

destroySignal(sig);
expect(getSignalsCount()).toBe(0);
```

### getEffectsCount()

```typescript
import {getEffectsCount, createEffect} from '@spearwolf/signalize';

expect(getEffectsCount()).toBe(0);

const effect = createEffect(() => {});
expect(getEffectsCount()).toBe(1);

effect.destroy();
expect(getEffectsCount()).toBe(0);
```

### getLinksCount()

```typescript
import {getLinksCount, link, unlink, createSignal} from '@spearwolf/signalize';

const a = createSignal(0);
const b = createSignal(0);

expect(getLinksCount()).toBe(0);

link(a, b);
expect(getLinksCount()).toBe(1);

unlink(a, b);
expect(getLinksCount()).toBe(0);
```

## Test Setup Pattern

Use `beforeEach` and `afterEach` to verify clean state:

```typescript
import {
  getSignalsCount,
  getEffectsCount,
  getLinksCount,
  SignalGroup,
} from '@spearwolf/signalize';

describe('MyFeature', () => {
  beforeEach(() => {
    // Verify clean state before each test
    expect(getSignalsCount()).toBe(0);
    expect(getEffectsCount()).toBe(0);
    expect(getLinksCount()).toBe(0);
  });

  afterEach(() => {
    // Clear all SignalGroups
    SignalGroup.clear();

    // Verify no leaks after each test
    expect(getSignalsCount()).toBe(0);
    expect(getEffectsCount()).toBe(0);
    expect(getLinksCount()).toBe(0);
  });

  it('should work correctly', () => {
    // Test code...
  });
});
```

## Helper Functions

Create reusable assertion helpers:

```typescript
function assertSignalsCount(expected: number, context?: string) {
  const actual = getSignalsCount();
  if (actual !== expected) {
    throw new Error(
      `Expected ${expected} signals, got ${actual}${context ? ` (${context})` : ''}`,
    );
  }
}

function assertEffectsCount(expected: number, context?: string) {
  const actual = getEffectsCount();
  if (actual !== expected) {
    throw new Error(
      `Expected ${expected} effects, got ${actual}${context ? ` (${context})` : ''}`,
    );
  }
}

function assertLinksCount(expected: number, context?: string) {
  const actual = getLinksCount();
  if (actual !== expected) {
    throw new Error(
      `Expected ${expected} links, got ${actual}${context ? ` (${context})` : ''}`,
    );
  }
}
```

## Cleanup Patterns

### Always Destroy in Tests

```typescript
it('should update signal', () => {
  const sig = createSignal(0);

  sig.set(1);
  expect(sig.get()).toBe(1);

  // ALWAYS cleanup
  destroySignal(sig);
});
```

### Use SignalGroup for Complex Tests

```typescript
it('should manage component state', () => {
  const obj = {};
  const group = SignalGroup.findOrCreate(obj);

  const count = createSignal(0, {attach: obj});
  createEffect(() => console.log(count.get()), {attach: obj});

  // ... test logic ...

  // Single cleanup destroys everything
  SignalGroup.delete(obj);
});
```

### Cleanup Multiple Resources

```typescript
it('should handle multiple signals', () => {
  const a = createSignal(1);
  const b = createSignal(2);
  const c = createSignal(3);

  // ... test logic ...

  // Destroy all at once
  destroySignal(a, b, c);
});
```

## Testing Effects

### Verify Effect Execution

```typescript
it('should run effect on signal change', () => {
  const sig = createSignal(0);
  const callback = jest.fn();

  createEffect(() => {
    callback(sig.get());
  });

  expect(callback).toHaveBeenCalledWith(0); // Initial run

  sig.set(1);
  expect(callback).toHaveBeenCalledWith(1);
  expect(callback).toHaveBeenCalledTimes(2);

  destroySignal(sig);
});
```

### Verify Effect Cleanup

```typescript
it('should call cleanup on destroy', () => {
  const sig = createSignal(0);
  const cleanup = jest.fn();

  const effect = createEffect(() => {
    sig.get();
    return cleanup;
  });

  expect(cleanup).not.toHaveBeenCalled();

  effect.destroy();
  expect(cleanup).toHaveBeenCalledTimes(1);

  destroySignal(sig);
});
```

### Verify Cleanup on Re-run

```typescript
it('should call cleanup before re-run', () => {
  const sig = createSignal(0);
  const cleanup = jest.fn();

  createEffect(() => {
    sig.get();
    return cleanup;
  });

  sig.set(1);
  expect(cleanup).toHaveBeenCalledTimes(1); // Called before re-run

  sig.set(2);
  expect(cleanup).toHaveBeenCalledTimes(2);

  destroySignal(sig);
});
```

### Verify Nested Effect Cleanup on Parent Re-run

```typescript
it('should call nested effect cleanup when parent re-runs', () => {
  const parentSig = createSignal(0);
  const childSig = createSignal(0);
  const parentCleanup = jest.fn();
  const childCleanup = jest.fn();

  const parent = createEffect(() => {
    parentSig.get();

    createEffect(() => {
      childSig.get();
      return childCleanup;
    });

    return parentCleanup;
  });

  expect(parentCleanup).not.toHaveBeenCalled();
  expect(childCleanup).not.toHaveBeenCalled();

  // Trigger parent re-run
  parentSig.set(1);

  // Both cleanups should be called (parent first, then child)
  expect(parentCleanup).toHaveBeenCalledTimes(1);
  expect(childCleanup).toHaveBeenCalledTimes(1);

  parent.destroy();

  // Final cleanups
  expect(parentCleanup).toHaveBeenCalledTimes(2);
  expect(childCleanup).toHaveBeenCalledTimes(2);

  destroySignal(parentSig, childSig);
});
```

## Testing Batches

```typescript
it('should batch updates', () => {
  const a = createSignal(0);
  const b = createSignal(0);
  const callback = jest.fn();

  createEffect(() => {
    callback(a.get(), b.get());
  });

  callback.mockClear(); // Clear initial call

  batch(() => {
    a.set(1);
    b.set(2);
  });

  // Only one call, not two
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(1, 2);

  destroySignal(a, b);
});
```

## Testing Async Code

### nextValue()

```typescript
it('should resolve next value', async () => {
  const a = createSignal(0);
  const b = createSignal(0);
  const conn = link(a, b);

  const nextPromise = conn.nextValue();

  a.set(42);

  await expect(nextPromise).resolves.toBe(42);

  destroySignal(a, b);
});
```

### Async Effects

```typescript
it('should handle async effect', async () => {
  const sig = createSignal(0);
  let result = 0;

  createEffect(async () => {
    const val = sig.get();
    await Promise.resolve();
    result = val * 2;
  });

  // Wait for async effect
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(result).toBe(0);

  sig.set(5);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(result).toBe(10);

  destroySignal(sig);
});
```

## Testing Classes with Decorators

```typescript
it('should work with decorated class', () => {
  class Counter {
    @signal() accessor count = 0;
  }

  const counter = new Counter();

  expect(counter.count).toBe(0);
  counter.count = 5;
  expect(counter.count).toBe(5);

  // Cleanup
  destroyObjectSignals(counter);
});
```

## Common Pitfalls

### 1. Forgetting cleanup

```typescript
// BAD - leaks signal
it('should work', () => {
  const sig = createSignal(0);
  expect(sig.get()).toBe(0);
  // Missing: destroySignal(sig)
});
```

### 2. Not waiting for async

```typescript
// BAD - might not verify correctly
it('should handle async', () => {
  const sig = createSignal(0);
  createEffect(async () => {
    /* async work */
  });
  // Missing: await
});
```

### 3. Test order dependency

```typescript
// BAD - tests affect each other
let sharedSignal: Signal<number>;

beforeAll(() => {
  sharedSignal = createSignal(0); // Shared state!
});
```

## Best Practices

1. **Always verify counts** in beforeEach/afterEach
2. **Use SignalGroup** for complex test setups
3. **Call `SignalGroup.clear()`** in afterEach as safety net
4. **Destroy signals explicitly** - don't rely on garbage collection
5. **Use jest.fn()** to verify effect execution
6. **Test cleanup callbacks** - they're critical for resource management
7. **Handle async properly** with await or timers

## See Also

- [Developer Guide](../../docs/guide.md) - Comprehensive guide to all features
- [Full API Reference](../../docs/full-api.md) - Complete API documentation
- [Cheat Sheet](../../docs/cheat-sheet.md) - Quick reference
