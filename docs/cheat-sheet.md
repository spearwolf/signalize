# Cheat Sheet

## Signals

```typescript
// Create
const count = createSignal(0);
const list = createSignal([], {
  compare: (a, b) => boolean, // Custom equality
  lazy: boolean,              // Lazy init
  attach: object,             // Lifecycle group
  beforeRead: () => void,     // Read hook
});

// Read
const val = count.get();   // Tracks dependency
const val = count.value;   // No tracking

// Write
count.set(1);
count.value = 1;

// Manage
count.touch();             // Trigger updates
count.onChange(cb);        // Listen for changes
count.destroy();           // Cleanup
muteSignal(count);         // Pause
unmuteSignal(count);       // Resume

// Introspection
isSignal(count);           // boolean
getSignalsCount();         // number

// Helpers
value(count);              // Get value (untracked)
touch(count);              // Trigger update
```

## Effects

```typescript
// Create
createEffect(() => {
  console.log(count.get());
});

// Options
createEffect(() => { ... }, {
  autorun: boolean,           // Default: true
  dependencies: Signal[],     // Static deps
  attach: object,             // Lifecycle group
  priority: number,           // Default: 0

  return () => console.log('cleanup');
});

// Static Dependencies
createEffect(() => { ... }, { dependencies: [count] });


// Introspection
getEffectsCount();         // number
onCreateEffect(fx => ...); // Global hook
onDestroyEffect(fx => ...); // Global hook
// Manual Control
const fx = createEffect(() => { ... }, { autorun: false });
fx.run();
fx.destroy();
```

## Memos

```typescript
// Non-Lazy (default) — recalculates immediately when dependencies change
// Acts as a computed signal: triggers dependent effects automatically
const double = createMemo(() => count.get() * 2);

// Lazy — recalculates only when read
// Does NOT trigger dependent effects on dependency change
const lazyDouble = createMemo(() => count.get() * 2, { lazy: true });

// Options
const memo = createMemo(() => count.get() * 2, {
  lazy: boolean,              // Default: false (non-lazy / eager)
  attach: object,             // Lifecycle group
  priority: number,           // Default: 1000
  name: string | symbol,      // Debug name
});

// Read (both lazy and non-lazy)
console.log(double());
console.log(lazyDouble());
```

## Decorators
*`import { signal, memo } from '@spearwolf/signalize/decorators'`*

```typescript
class Store {
  @signal({
    name: string,             // Override name
    readAsValue: boolean,     // No tracking in getter
    compare: (a,b) => bool,   // Custom equality
  })
  accessor count = 0;

  @memo({
    name: string,             // Override name
  })
  double() {
    return this.count * 2;
  }
}
```

## Object Signals

```typescript
// Access
const sig = findObjectSignalByName(obj, 'prop');
const allSignals = findObjectSignals(obj);   // Signal[]
const allNames = findObjectSignalNames(obj); // (string | symbol)[]

// Helpers
value([obj, 'prop']);      // Get value (untracked)
touch([obj, 'prop']);      // Trigger update

// Cleanup
destroyObjectSignals(obj);
```

## Utilities

```typescript
// Batching
batch(() => {
  count.set(1);
  count.set(2);
});
isQuiet();                 // boolean

// Silence Tracking
beQuiet(() => {
  const val = count.get(); // Not tracked
});

// Suspend Context
hibernate(() => {
  // No tracking, no batching
});

// Signal Helpers
value(sig);                // Get value (untracked)
touch(sig);                // Trigger update
```

## Groups

```typescript
// Static
const group = SignalGroup.findOrCreate(obj);
const existing = SignalGroup.get(obj);
SignalGroup.delete(obj);
SignalGroup.clear(); // Global clear

// Instance
group.attachSignal(sig);
group.attachSignalByName('name', sig);
group.detachSignal(sig);
group.hasSignal('name');
group.signal('name');

group.attachEffect(effect);
group.runEffects();

group.attachLink(link);
group.detachLink(link);

group.attachGroup(childGroup);
group.detachGroup(childGroup);

group.clear(); // Destroy all attached
```

## Links

```typescript
// Create
const linkRef = link(sourceSignal, targetSignal, {
  attach: object,             // Lifecycle group
});

// Unlink
unlink(sourceSignal, targetSignal);

// SignalLink Features
linkRef.mute();            // Pause updates
linkRef.unmute();          // Resume updates
linkRef.toggleMute();      // Toggle pause/resume
linkRef.isMuted;           // boolean

linkRef.touch();           // Force update
linkRef.lastValue;         // Last synced value
linkRef.destroy();         // Cleanup
linkRef.isDestroyed;       // boolean

linkRef.attach(obj);       // Attach to group

// Async
await linkRef.nextValue();
for await (const val of linkRef.asyncValues()) { ... }
```

## AutoMap

```typescript
// Create
const map = new SignalAutoMap();
const mapFromProps = SignalAutoMap.fromProps({ a: 1 }, ['a']);

// Access (Auto-creates signal if missing)
const sig = map.get('key');
const exists = map.has('key');

// Update (Batched)
map.update(new Map([['key', 'value']]));
map.updateFromProps({ key: 'value' });

// Iterate
for (const key of map.keys()) { ... }
for (const sig of map.signals()) { ... }
for (const [key, sig] of map.entries()) { ... }

// Cleanup
map.clear();
```
