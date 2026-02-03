---
name: signalize-utilities
description: 'Utility functions for reactive context control in @spearwolf/signalize: batch (deferred effect execution with priority ordering), beQuiet (suppress dependency tracking), hibernate (complete context isolation). Use for performance optimization and advanced control flow.'
---

# Signalize Utilities

## Overview

| Function      | Purpose                      | Use Case                |
| ------------- | ---------------------------- | ----------------------- |
| `batch()`     | Defer effect execution       | Multiple signal updates |
| `beQuiet()`   | Suppress dependency tracking | One-time reads          |
| `hibernate()` | Complete context isolation   | Escape all contexts     |

## batch() - Deferred Effect Execution

Combine multiple signal updates into **one** effect run:

```typescript
import {batch, createSignal, createEffect} from '@spearwolf/signalize';

const firstName = createSignal('');
const lastName = createSignal('');

createEffect(() => {
  console.log(`${firstName.get()} ${lastName.get()}`);
});

// Without batch: effect runs TWICE
firstName.set('John'); // Effect runs
lastName.set('Doe'); // Effect runs again

// With batch: effect runs ONCE
batch(() => {
  firstName.set('Jane');
  lastName.set('Smith');
}); // Effect runs once here with final values
```

### Key Behaviors

- **Signal values update immediately** inside batch (readable)
- **Effects are deferred** until batch ends
- **Nested batches are flattened** - only outermost batch triggers effects
- **Effects run in priority order** (higher priority first)

### Priority Ordering

Within a batch, effects execute in priority order:

```typescript
createEffect(low, {priority: -100}); // Runs last
createEffect(high, {priority: 1000}); // Runs first
createEffect(normal); // Default priority 0

batch(() => {
  signal.set(newValue);
});
// Execution order: high → normal → low
```

**Default priorities:**

| Type   | Priority | Order       |
| ------ | -------- | ----------- |
| Memo   | 1000     | First       |
| Effect | 0        | After memos |

This ensures memos compute before effects that depend on them.

### Nested Batches

```typescript
batch(() => {
  a.set(1);

  batch(() => {
    b.set(2);
    c.set(3);
  });
  // Inner batch doesn't trigger effects yet

  d.set(4);
});
// ALL effects run once here
```

### Reading Values in Batch

```typescript
batch(() => {
  firstName.set('John');
  console.log(firstName.get()); // 'John' - value is immediate

  // But effects haven't run yet
});
```

## beQuiet() - Suppress Dependency Tracking

Read signals **without** creating dependencies:

```typescript
import {beQuiet, isQuiet} from '@spearwolf/signalize';

createEffect(() => {
  const tracked = signalA.get(); // Creates dependency

  beQuiet(() => {
    const untracked = signalB.get(); // NO dependency created
    console.log(untracked);
  });

  // Effect only re-runs when signalA changes, not signalB
});
```

### Use Cases

**One-time configuration reads:**

```typescript
createEffect(() => {
  const data = dataSignal.get(); // Track this

  beQuiet(() => {
    const config = configSignal.get(); // Don't track config
    process(data, config);
  });
});
```

**Logging without subscribing:**

```typescript
createEffect(() => {
  performAction(signal.get());

  beQuiet(() => {
    console.log('Debug - other value:', otherSignal.get());
  });
});
```

**Conditional non-tracking:**

```typescript
createEffect(() => {
  if (shouldTrack.get()) {
    return trackedSignal.get();
  } else {
    return beQuiet(() => untrackedSignal.get());
  }
});
```

### Check Quiet State

```typescript
if (isQuiet()) {
  // Currently inside beQuiet() context
}
```

## hibernate() - Complete Context Isolation

Temporarily exit **all** reactive contexts:

```typescript
import {hibernate} from '@spearwolf/signalize';

createEffect(() => {
  const val = signal.get(); // Tracked

  hibernate(() => {
    // No current effect context
    // No batch context
    // No beQuiet context

    otherSignal.set(val); // Triggers effects IMMEDIATELY

    // Can create independent effects
    createEffect(() => {
      /* Not nested in outer effect */
    });
  });
});
```

### What hibernate() Clears

| Context      | Action                                      |
| ------------ | ------------------------------------------- |
| `batch()`    | Flushed (pending effects run), then cleared |
| `beQuiet()`  | Cleared (`isQuiet()` returns false)         |
| Effect stack | Cleared (no current effect)                 |

All contexts are **restored** after hibernate callback completes.

### Use Cases

**Escape batch for immediate effect:**

```typescript
batch(() => {
  a.set(1);

  hibernate(() => {
    // This triggers effects immediately, not batched
    criticalSignal.set(urgent);
  });

  b.set(2); // Back in batch
});
```

**Create independent effects:**

```typescript
createEffect(() => {
  trigger.get();

  hibernate(() => {
    // This effect is NOT a child of the outer effect
    createEffect(() => {
      independent.get();
    });
  });
});
```

**Read without any context:**

```typescript
batch(() => {
  beQuiet(() => {
    createEffect(() => {
      // Deeply nested contexts

      hibernate(() => {
        // Clean slate - no batch, no quiet, no effect
        const value = signal.get(); // Would track if in effect
      });
    });
  });
});
```

### Exception Safety

Contexts are properly restored even if an exception is thrown:

```typescript
try {
  hibernate(() => {
    throw new Error('oops');
  });
} catch (e) {
  // Contexts are restored here
}
```

## Comparison Table

| Function      | Affects Dependencies | Affects Effect Execution | Affects Current Effect |
| ------------- | -------------------- | ------------------------ | ---------------------- |
| `batch()`     | No                   | Yes (deferred)           | No                     |
| `beQuiet()`   | Yes (suppressed)     | No                       | No                     |
| `hibernate()` | Yes (cleared)        | Yes (immediate)          | Yes (cleared)          |

## Combining Utilities

### batch + beQuiet

```typescript
batch(() => {
  // Multiple updates, one effect run
  a.set(1);
  b.set(2);

  // Read without tracking (inside the batch)
  beQuiet(() => {
    console.log('Current c:', c.get());
  });
});
```

### Effect with selective tracking

```typescript
createEffect(() => {
  // Track these
  const important = importantSignal.get();

  // Don't track these
  beQuiet(() => {
    const config = configSignal.get();
    const debug = debugSignal.get();
  });

  process(important, config, debug);
});
```

## Pitfalls

### 1. beQuiet doesn't prevent writes

```typescript
beQuiet(() => {
  signal.set(newValue); // Still notifies dependents!
});
```

### 2. hibernate flushes batches

```typescript
batch(() => {
  a.set(1);

  hibernate(() => {
    // Batch was FLUSHED - effects for a.set(1) already ran!
  });
});
```

### 3. Nested beQuiet is redundant

```typescript
beQuiet(() => {
  beQuiet(() => {
    // Still quiet, but redundant nesting
  });
});
```

## See Also

- [Developer Guide](../../docs/guide.md) - Comprehensive guide to all features
- [Full API Reference](../../docs/full-api.md) - Complete API documentation
- [Cheat Sheet](../../docs/cheat-sheet.md) - Quick reference
