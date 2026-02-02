# Dynamic vs Static Effects

## Overview

| Type        | Dependencies           | Initial Run | Use Case                 |
| ----------- | ---------------------- | ----------- | ------------------------ |
| **Dynamic** | Recalculated every run | YES         | Most cases, flexible     |
| **Static**  | Fixed at creation      | NO          | Predictable, performance |

## Dynamic Effects (Default)

Dependencies are determined by which signals are **actually read** during each execution:

```typescript
const showDetails = createSignal(false);
const summary = createSignal('Summary');
const details = createSignal('Details');

createEffect(() => {
  if (showDetails.get()) {
    console.log(details.get());
  } else {
    console.log(summary.get());
  }
});
```

### How Dependencies Change

**When `showDetails` is `false`:**

- Effect depends on: `showDetails`, `summary`
- Changes to `details` do NOT trigger re-run

**When `showDetails` is `true`:**

- Effect depends on: `showDetails`, `details`
- Changes to `summary` do NOT trigger re-run

### Characteristics

- Runs immediately on creation
- Dependencies tracked dynamically via signal reads
- Maximum flexibility for conditional logic
- Can lead to surprising behavior if not understood

## Static Effects

Dependencies are explicitly specified and never change:

```typescript
createEffect(() => {
  console.log(a.get(), b.get(), c.get());
}, [a, b, c]); // Only these three signals trigger re-run
```

### Characteristics

- Does NOT run immediately on creation
- Dependencies fixed - even if you read other signals, they're not tracked
- Predictable subscription behavior
- Must call `.run()` if you need initial execution

### Initial Run Pattern

```typescript
// Option 1: Chain .run()
createEffect(() => {
  processData(signal.get());
}, [signal]).run();

// Option 2: Separate call
const effect = createEffect(callback, [signal]);
effect.run();
```

## When to Use Each

### Use Dynamic Effects When:

- Conditional signal reads
- Dependencies vary based on state
- You want the effect to run immediately
- Simple reactive logic

```typescript
// Good: Simple reactive logic
createEffect(() => {
  document.title = title.get();
});

// Good: Conditional dependencies
createEffect(() => {
  if (isEnabled.get()) {
    performAction(config.get());
  }
});
```

### Use Static Effects When:

- You need predictable subscriptions
- Performance-critical with many signals
- Complex conditional logic where dynamic tracking is confusing
- Object-attached signals with string names

```typescript
// Good: Predictable subscriptions
createEffect(() => {
  syncToServer(localData.get());
}, [localData]);

// Good: Performance - only subscribe to specific signals
createEffect(() => {
  // Read many signals but only react to these two
  render(a.get(), b.get(), c.get(), d.get());
}, [a, b]); // Only a and b trigger re-render
```

## Static Effects with Object-Attached Signals

When using `@signal` decorators or `SignalGroup`, use string names:

```typescript
class Counter {
  @signal() accessor count = 0;
  @signal() accessor step = 1;

  constructor() {
    // String names for attached signals
    createEffect(() => console.log(this.count), ['count', 'step'], {
      attach: this,
    }).run();
  }
}
```

## Comparison Table

| Aspect             | Dynamic                            | Static                                   |
| ------------------ | ---------------------------------- | ---------------------------------------- |
| Initial run        | YES (immediate)                    | NO (manual)                              |
| Dependencies       | Change per execution               | Fixed at creation                        |
| Conditional reads  | Tracked dynamically                | Not tracked                              |
| Subscription count | Varies                             | Constant                                 |
| Mental model       | "Run when anything I read changes" | "Run when these specific signals change" |
| Best for           | Most cases                         | Predictable behavior                     |

## Mixing Approaches

You can read signals not in the dependency array - they just won't trigger re-runs:

```typescript
createEffect(() => {
  // Only 'trigger' causes re-run
  const t = trigger.get();

  // These are read but don't cause re-runs
  const config = configSignal.get();
  const user = userSignal.get();

  doSomething(t, config, user);
}, [trigger]);
```

## beQuiet() for Selective Tracking

In dynamic effects, use `beQuiet()` to read without tracking:

```typescript
import {beQuiet} from '@spearwolf/signalize';

createEffect(() => {
  const tracked = importantSignal.get(); // Creates dependency

  beQuiet(() => {
    const untracked = configSignal.get(); // NO dependency
    console.log(untracked);
  });
});
```

## Common Pitfalls

### 1. Expecting static effect to run initially

```typescript
// This does NOT run on creation!
createEffect(() => {
  console.log(signal.get());
}, [signal]);

// Fix: add .run()
createEffect(() => {
  console.log(signal.get());
}, [signal]).run();
```

### 2. Reading extra signals in static effect

```typescript
createEffect(() => {
  // 'a' and 'b' are static deps
  // 'c' is read but NOT a dependency - won't trigger re-run
  console.log(a.get(), b.get(), c.get());
}, [a, b]);
```

### 3. Dynamic effect with unintended dependencies

```typescript
// Might depend on signals you didn't expect
createEffect(() => {
  if (someCondition) {
    maybeDoSomething(signal1.get(), signal2.get());
  }
  // Now depends on signal1 and signal2 only when someCondition is true
});
```
