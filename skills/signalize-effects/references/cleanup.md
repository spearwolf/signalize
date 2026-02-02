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

### Critical Behavior

When outer effect re-runs, inner effects are **recreated** (new instances), not re-run:

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
Outer runs         ← Outer re-runs
Inner runs         ← Inner is RECREATED (new instance)
```

The old inner effect still exists until garbage collected. Its cleanup is NOT called until the new outer effect is destroyed.

### Explicit Inner Cleanup

For deterministic inner cleanup, manage it explicitly:

```typescript
createEffect(() => {
  const innerEffect = createEffect(() => {
    // inner logic
    return () => console.log('Inner cleanup');
  });

  return () => {
    innerEffect.destroy(); // Explicitly destroy inner
    console.log('Outer cleanup');
  };
});
```

Now when outer re-runs, inner cleanup is called before recreation.

## Cleanup Timing Table

| Scenario                                 | Cleanup Called? | When?                            |
| ---------------------------------------- | --------------- | -------------------------------- |
| Signal changes, effect re-runs           | YES             | Before re-run                    |
| `effect.destroy()` called                | YES             | Immediately                      |
| Signal destroyed (last dependency)       | YES             | Effect also destroyed            |
| `effect.destroy()` called multiple times | Only once       | First call                       |
| Effect with `autorun: false`, never run  | NO              | Nothing to cleanup               |
| Outer effect re-runs (nested)            | Outer YES       | Inner recreated, old not cleaned |

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
