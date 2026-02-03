# Effect Cleanup Patterns

## The Cleanup Pattern

Effects can return a cleanup function that runs:

1. **Before every re-execution** (when dependencies change)
2. **When the effect is destroyed**

**NOTE:** Cleanup is only called if the effect returns a callback!

```typescript
createEffect(() => {
  const resource = acquireResource(signal.get());

  // Cleanup is only necessary if we have a resource
  if (resource) {
    // Cleanup: release before next run or on destroy
    return () => {
      releaseResource(resource);
    };
  }
});
```

## Common Use Cases

### Timers

```typescript
createEffect(() => {
  const interval = setInterval(() => tick(), delay.get());
  return () => clearInterval(interval);
});
```

### Event Listeners

```typescript
createEffect(() => {
  const handler = () => handleClick(signal.get());
  element.addEventListener('click', handler);
  return () => element.removeEventListener('click', handler);
});
```

### Subscriptions

```typescript
createEffect(() => {
  const unsubscribe = store.subscribe(channel.get(), onMessage);
  return () => unsubscribe();
});
```

### DOM Manipulation

```typescript
createEffect(() => {
  const el = document.createElement('div');
  el.textContent = content.get();
  container.appendChild(el);
  return () => container.removeChild(el);
});
```

### Fetch with Abort

```typescript
createEffect(() => {
  const controller = new AbortController();

  fetch(url.get(), {signal: controller.signal})
    .then((res) => res.json())
    .then((data) => result.set(data));

  return () => controller.abort();
});
```

## Cleanup Execution Order

```typescript
let log = [];

const effect = createEffect(() => {
  log.push('effect runs');
  return () => log.push('cleanup runs');
});

// log: ['effect runs']

signal.set(newValue);
// log: ['effect runs', 'cleanup runs', 'effect runs']
//                       ↑ cleanup FIRST, then new execution

effect.destroy();
// log: [..., 'cleanup runs']  ← final cleanup
```

## Capturing Values in Cleanup

Cleanup receives NO parameters. Capture what you need from the effect body:

```typescript
createEffect(() => {
  const currentId = resourceId.get();
  const handle = openResource(currentId);

  return () => {
    // currentId is captured from THIS run
    closeResource(currentId, handle);
  };
});
```

## Async Effects and Cleanup

Async effects can also return cleanup functions:

```typescript
createEffect(async () => {
  const data = await fetchData(signal.get());
  process(data);

  return () => {
    cancelProcessing(data);
  };
});
```

**Important:** Async cleanup is called asynchronously. In tests, use `await` or timers:

```typescript
effect.destroy();
await new Promise((resolve) => setTimeout(resolve, 0));
// Now async cleanup has run
```

## Nested Effects and Cleanup

### Behavior (v0.26.0+)

When an outer effect re-runs, all nested (child) effects are **destroyed** (with their cleanup callbacks called) and then **recreated**:

```typescript
createEffect(() => {
  console.log('Outer runs');

  createEffect(() => {
    console.log('Inner runs');
    return () => console.log('Inner cleanup');
  });

  return () => console.log('Outer cleanup');
});
```

**Initial run:**

```
Outer runs
Inner runs
```

**After outer dependency changes:**

```
Outer cleanup      ← Outer cleanup first
Inner cleanup      ← Inner cleanup called (inner effect destroyed)
Outer runs         ← Outer re-runs
Inner runs         ← Inner is RECREATED (new instance)
```

**On final destroy:**

```
Outer cleanup
Inner cleanup
```

### Deeply Nested Effects

Cleanup cascades through all levels:

```typescript
createEffect(() => {
  // Level 1
  createEffect(() => {
    // Level 2
    createEffect(() => {
      // Level 3
      return () => console.log('Level 3 cleanup');
    });
    return () => console.log('Level 2 cleanup');
  });
  return () => console.log('Level 1 cleanup');
});
```

When Level 1 re-runs:

```
Level 1 cleanup
Level 2 cleanup
Level 3 cleanup
Level 1 runs
Level 2 runs
Level 3 runs
```

### Multiple Sibling Effects

All sibling child effects are cleaned up when parent re-runs:

```typescript
createEffect(() => {
  createEffect(() => {
    return () => console.log('Child A cleanup');
  });

  createEffect(() => {
    return () => console.log('Child B cleanup');
  });

  return () => console.log('Parent cleanup');
});
```

When parent re-runs:

```
Parent cleanup
Child A cleanup
Child B cleanup
Parent runs
Child A runs
Child B runs
```

### Capturing Values in Nested Cleanup

Child effect cleanup captures values from when it was created:

```typescript
createEffect(() => {
  const parentValue = parentSignal.get();

  createEffect(() => {
    return () => {
      // parentValue is captured from when THIS inner effect was created
      console.log('Cleaning up for parent value:', parentValue);
    };
  });
});
```

## Cleanup Timing Table

| Scenario                                 | Cleanup Called? | When?                                      |
| ---------------------------------------- | --------------- | ------------------------------------------ |
| Signal changes, effect re-runs           | YES             | Before re-run                              |
| `effect.destroy()` called                | YES             | Immediately                                |
| Signal destroyed (last dependency)       | YES             | Effect also destroyed                      |
| `effect.destroy()` called multiple times | Only once       | First call                                 |
| Effect with `autorun: false`, never run  | NO              | Nothing to cleanup                         |
| Outer effect re-runs (nested)            | YES (all)       | Parent cleanup, then children, then re-run |

## Pitfalls to Avoid

### 1. Forgetting cleanup for resources

```typescript
// BAD - memory/resource leak!
createEffect(() => {
  const ws = new WebSocket(url.get());
  ws.onmessage = handleMessage;
});

// GOOD
createEffect(() => {
  const ws = new WebSocket(url.get());
  ws.onmessage = handleMessage;
  return () => ws.close();
});
```

### 2. Cleanup accessing wrong values

```typescript
// BAD - id might be stale
let id;
createEffect(() => {
  id = resourceId.get();
  return () => closeResource(id); // Uses outer 'id' variable
});

// GOOD - capture in closure
createEffect(() => {
  const id = resourceId.get();
  return () => closeResource(id); // Captures this run's id
});
```

### 3. Assuming cleanup runs on first execution

Cleanup only runs BEFORE re-runs, not on first run:

```typescript
createEffect(() => {
  // This is the first run - no cleanup before this
  setup();
  return () => teardown(); // Called before NEXT run
});
```

### 4. Not handling async cleanup timing

```typescript
// Cleanup might not complete before effect re-runs
createEffect(async () => {
  return async () => {
    await slowCleanup(); // Might still be running when effect re-runs
  };
});

// Consider synchronous cleanup with async work
createEffect(() => {
  const controller = new AbortController();
  doAsyncWork(controller.signal);
  return () => controller.abort(); // Synchronous - triggers async cancellation
});
```
