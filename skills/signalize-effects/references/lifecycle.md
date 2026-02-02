# Effect Lifecycle Hooks

## Overview

Signalize provides global hooks to observe effect creation and destruction:

```typescript
import {onCreateEffect, onDestroyEffect} from '@spearwolf/signalize';
```

## onCreateEffect

Subscribe to effect creation events:

```typescript
const unsubscribe = onCreateEffect((effectImpl) => {
  console.log('Effect created:', effectImpl);
});

// Create effects - hook is called for each
createEffect(() => console.log('A'));
createEffect(() => console.log('B'));

// Stop listening
unsubscribe();
```

## onDestroyEffect

Subscribe to effect destruction events:

```typescript
const unsubscribe = onDestroyEffect((effectImpl) => {
  console.log('Effect destroyed:', effectImpl);
});

const effect = createEffect(() => signal.get());
effect.destroy(); // Hook is called

unsubscribe();
```

## Use Cases

### Debugging

```typescript
// Log all effect activity
onCreateEffect((e) => console.log('Created:', e));
onDestroyEffect((e) => console.log('Destroyed:', e));
```

### Metrics

```typescript
let activeEffects = 0;

onCreateEffect(() => {
  activeEffects++;
  console.log('Active effects:', activeEffects);
});

onDestroyEffect(() => {
  activeEffects--;
  console.log('Active effects:', activeEffects);
});
```

### Testing

```typescript
describe('MyComponent', () => {
  let createdEffects: any[] = [];
  let unsubscribe: () => void;

  beforeEach(() => {
    createdEffects = [];
    unsubscribe = onCreateEffect((e) => createdEffects.push(e));
  });

  afterEach(() => {
    unsubscribe();
  });

  it('creates expected effects', () => {
    new MyComponent();
    expect(createdEffects.length).toBe(3);
  });
});
```

### Custom Effect Registry

```typescript
const effectRegistry = new Map();

onCreateEffect((effect) => {
  effectRegistry.set(effect, {
    createdAt: Date.now(),
    stack: new Error().stack,
  });
});

onDestroyEffect((effect) => {
  effectRegistry.delete(effect);
});

// Debug: find long-lived effects
function findOldEffects(maxAge: number) {
  const now = Date.now();
  return [...effectRegistry.entries()].filter(
    ([_, info]) => now - info.createdAt > maxAge,
  );
}
```

## The EffectImpl Object

The callback receives the internal `EffectImpl` instance. This is a low-level object primarily useful for debugging:

```typescript
onCreateEffect((effectImpl) => {
  // effectImpl is the internal effect representation
  // Useful for debugging, not for regular use
});
```

## Important Notes

1. **Hooks are global** - They fire for ALL effects in the application
2. **Return value is unsubscribe function** - Always clean up when done
3. **Hooks are synchronous** - Called immediately when effect is created/destroyed
4. **Use sparingly** - Primarily for debugging and testing

## Cleanup Pattern

```typescript
// Store unsubscribe functions
const cleanupFns: (() => void)[] = [];

cleanupFns.push(onCreateEffect(handleCreate));
cleanupFns.push(onDestroyEffect(handleDestroy));

// Later: cleanup all
cleanupFns.forEach((fn) => fn());
```
