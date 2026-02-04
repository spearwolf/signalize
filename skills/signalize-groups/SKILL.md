---
name: signalize-groups
description: 'Lifecycle and organizational management for @spearwolf/signalize: SignalGroup for class/object-attached reactivity and logical grouping, parent-child hierarchies, named signals, SignalAutoMap for dynamic signal collections. Use when managing multiple related signals, component lifecycles, or logical units of reactive state.'
---

# Signalize Groups

## Overview

SignalGroups serve two main purposes:

1. **Lifecycle Management** - Destroy all signals/effects when an object is destroyed
2. **Logical Grouping** - Organize related signals/effects together

## When to Use SignalGroups

- Managing state for a class instance or component
- Grouping logically related signals (form fields, feature modules)
- Hierarchical state organization (app → page → component)
- Need to reset/clear a subset of application state

## Quick Start

```typescript
import {createSignal, createEffect, SignalGroup} from '@spearwolf/signalize';

class Counter {
  constructor() {
    // Create or get existing group for this object
    const group = SignalGroup.findOrCreate(this);

    // Attach signals and effects
    this.count = createSignal(0, {attach: this});

    createEffect(
      () => {
        console.log('Count:', this.count.get());
      },
      {attach: this},
    );
  }

  destroy() {
    // Destroys all attached signals, effects, and links
    SignalGroup.delete(this);
  }
}
```

## SignalGroup API

### Creation and Access

```typescript
// Create or get existing group for an object
const group = SignalGroup.findOrCreate(obj);

// Get existing group (returns undefined if none)
const group = SignalGroup.get(obj);

// Delete group and destroy all attached resources
SignalGroup.delete(obj);

// Clear ALL groups globally (useful in tests)
SignalGroup.clear();
```

### Attaching Resources

**Via options (recommended):**

```typescript
createSignal(value, {attach: obj}); // or {attach: group}
createEffect(callback, {attach: obj});
createMemo(factory, {attach: obj});
link(source, target, {attach: obj});
```

**Via group methods:**

```typescript
group.attachSignal(signal);
group.attachEffect(effect);
group.attachLink(link);
```

### Detaching (Without Destroying)

```typescript
group.detachSignal(signal); // Remove from group, signal survives
group.detachEffect(effect);
group.detachLink(link);
```

### Cleanup

```typescript
group.clear(); // Destroy all resources, keep group
SignalGroup.delete(obj); // Destroy resources AND remove group
```

## Named Signals

Store and retrieve signals by name:

```typescript
const group = SignalGroup.findOrCreate(this);

// Attach with name
group.attachSignalByName('userName', userSignal);
group.attachSignalByName(Symbol('private'), privateSignal);

// Lookup
const signal = group.signal('userName');
const exists = group.hasSignal('userName');

// Remove name association (without destroying signal)
group.attachSignalByName('userName'); // Pass no signal to remove
```

## Parent-Child Hierarchies

Groups can form hierarchies where children inherit parent's named signals:

```typescript
const appGroup = SignalGroup.findOrCreate(app);
const pageGroup = SignalGroup.findOrCreate(page);

// Establish hierarchy
appGroup.attachGroup(pageGroup);

// Parent's named signals are accessible from child
appGroup.attachSignalByName('config', configSignal);
pageGroup.signal('config'); // Returns parent's signal
pageGroup.hasSignal('config'); // true
```

### Hierarchy Behavior

- Child can access parent's named signals
- Clearing parent **also clears children**
- Re-parenting (attach to different parent) auto-detaches from previous parent

```typescript
appGroup.clear(); // Both app AND page resources destroyed
```

## Logical Grouping Patterns

### Component Pattern

```typescript
class MyComponent {
  constructor() {
    SignalGroup.findOrCreate(this);

    this.visible = createSignal(true, {attach: this});
    this.data = createSignal(null, {attach: this});

    createEffect(
      () => {
        if (this.visible.get()) this.render();
      },
      {attach: this},
    );
  }

  dispose() {
    SignalGroup.delete(this);
  }
}
```

### Feature Module Pattern

```typescript
// Auth module
const authKey = {module: 'auth'};
const currentUser = createSignal(null, {attach: authKey});
const isAuthenticated = createMemo(() => currentUser.get() !== null, {
  attach: authKey,
});

// Reset auth state
function logout() {
  SignalGroup.get(authKey)?.clear();
}
```

### Form Pattern

```typescript
const formKey = {form: 'login'};
const username = createSignal('', {attach: formKey});
const password = createSignal('', {attach: formKey});
const isValid = createMemo(
  () => username.get().length > 0 && password.get().length >= 8,
  {attach: formKey},
);

function resetForm() {
  SignalGroup.delete(formKey);
  // Re-create if needed
}
```

### Hierarchical App Pattern

```typescript
const app = {type: 'app'};
const page = {type: 'page', name: 'home'};
const widget = {type: 'widget', id: 'sidebar'};

SignalGroup.findOrCreate(app).attachGroup(SignalGroup.findOrCreate(page));
SignalGroup.findOrCreate(page).attachGroup(SignalGroup.findOrCreate(widget));

// App config accessible everywhere
SignalGroup.findOrCreate(app).attachSignalByName('theme', themeSignal);
SignalGroup.findOrCreate(widget).signal('theme'); // Inherited from app
```

## Running Effects

Run all effects in a group (and child groups):

```typescript
group.runEffects();
```

## SignalAutoMap

For dynamic collections of signals, use `SignalAutoMap`:

```typescript
const fields = SignalAutoMap.fromProps({name: '', email: ''});
fields.get('name').set('John');
fields.updateFromProps(apiResponse);
fields.clear();
```

See [references/signal-auto-map.md](references/signal-auto-map.md) for details.

## Pitfalls to Avoid

### 1. Cannot attach destroyed signal

```typescript
signal.destroy();
group.attachSignal(signal); // Error!
```

### 2. Cannot attach group to itself

```typescript
group.attachGroup(group); // Error!
```

### 3. Detaching doesn't destroy

```typescript
group.detachSignal(signal);
// Signal still exists! Must destroy separately if needed
signal.destroy();
```

### 4. Clear vs Delete

```typescript
group.clear(); // Resources destroyed, group still exists
SignalGroup.delete(obj); // Resources destroyed, group removed
```

## Best Practices

1. **Use `{attach: obj}` option** - Cleaner than manual `group.attachSignal()`
2. **Clean up in dispose/destroy** - Always call `SignalGroup.delete(this)` in cleanup
3. **Use hierarchies for inheritance** - App-wide config accessible to children
4. **Consider logical grouping** - Even without classes, group related state
5. **Test cleanup** - Use `assertSignalsCount(0)` to verify no leaks

## See Also

- [references/signal-auto-map.md](references/signal-auto-map.md) - SignalAutoMap details
- [Developer Guide](https://raw.githubusercontent.com/spearwolf/signalize/refs/heads/main/docs/guide.md) - Comprehensive guide to all features
- [Full API Reference](https://raw.githubusercontent.com/spearwolf/signalize/refs/heads/main/docs/full-api.md) - Complete API documentation
- [Cheat Sheet](https://raw.githubusercontent.com/spearwolf/signalize/refs/heads/main/docs/cheat-sheet.md) - Quick reference
