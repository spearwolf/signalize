# Cheat sheet

One-page lookup. For details see [api.md](api.md) and [recipes.md](recipes.md).

## Signals

```ts
import {createSignal, destroySignal, isSignal, muteSignal, unmuteSignal,
        getSignalsCount, value, touch} from '@spearwolf/signalize';

const c = createSignal(0, {
  lazy:       false,                // factory in initial when true
  compare:    (a, b) => a === b,    // custom equality
  beforeRead: () => {/* hook */},   // tracked-read only
  attach:     obj,                  // SignalGroup lifecycle
});

c.get();           // tracked read
c.value;           // untracked read
c.set(1);          // write
c.value = 1;       // setter
c.set(fn, {lazy: true});       // store factory; evaluate on next read
c.set(v,  {touch: true});      // notify even if equal

c.touch(); c.destroy();
c.muted = true;    c.muted = false;   // muted: set() still stores, nobody is notified
c.onChange(cb);    // → unsubscribe()

isSignal(x); getSignalsCount();
value(c); value([obj, 'prop']);  // untracked
touch(c); touch([obj, 'prop']);  // notify
```

## Effects

```ts
import {createEffect, getEffectsCount, onCreateEffect,
        onDestroyEffect, onEffectError} from '@spearwolf/signalize';

createEffect(() => {
  read(c.get());
  return () => cleanup();
}, {
  autorun:      true,    // false → manual eff.run()
  dependencies: [c],     // static deps; disables auto-tracking (child effects
                         //   still work); no autorun
  priority:     0,       // higher first
  attach:       obj,
});

createEffect(cb, [c]);                 // shorthand → static
createEffect(cb, ['name'], {attach: obj}); // by name (group lookup)

const eff = createEffect(cb, {autorun: false});
eff.run(); eff.destroy();

// Recursion guard
EffectImpl.maxDepth = 256;

// async: cleanup of a superseded run is DISCARDED, rejections are reported
onEffectError(({error, effectId, phase}) => {});  // → unsubscribe
// no handler → console.error instead of an unhandled rejection
// handler MUST be sync or catch itself — nothing awaits it
// handler throws → dispatch stops; lower-priority handlers miss the event
```

## Memos

```ts
import {createMemo} from '@spearwolf/signalize';

const m = createMemo(() => a.get() * 2, {
  lazy:     false,   // true: recompute on read; effects do NOT re-run
  priority: 1000,
  attach:   obj,
  name:     'm',     // group registration
});
m();                 // SignalReader
```

## Links

```ts
import {link, unlink, getLinksCount} from '@spearwolf/signalize';

const con = link(src, target, {attach: obj});  // target: signal | callback
unlink(src, target);  unlink(src);

con.lastValue; con.isMuted; con.isDestroyed;
con.mute(); con.unmute(); con.toggleMute();
con.touch(); con.destroy(); con.attach(obj);

await con.nextValue();
for await (const v of con.asyncValues((v, i) => i >= 5)) {/* … */}

getLinksCount(); getLinksCount(src);
```

## Context modes

```ts
import {batch, beQuiet, isQuiet, hibernate} from '@spearwolf/signalize';

batch(() => { a.set(1); b.set(2); });   // dedup + priority flush
beQuiet(() => a.get());                 // no track, no notify
hibernate(() => { /* outer ctx suspended; new ctx allowed */ });
isQuiet();
```

## SignalGroup

```ts
import {SignalGroup, getSignalGroupsCount} from '@spearwolf/signalize';

const g = SignalGroup.findOrCreate(obj);   // throws on null
SignalGroup.get(obj);                       // existing or undefined
SignalGroup.delete(obj);                    // clear & remove
SignalGroup.clear();                        // global
getSignalGroupsCount();                     // live group count

g.attachSignal(s); g.attachSignalByName('n', s);
g.detachSignal(s); g.signal('n'); g.hasSignal('n');
g.attachEffect(e); g.runEffects();
g.attachLink(l);   g.detachLink(l);
g.attachGroup(c);  g.detachGroup(c);
g.off();    // destroy attached effects/links, drop external subs, keep signals
g.clear();  // full teardown
```

## SignalAutoMap

```ts
import {SignalAutoMap} from '@spearwolf/signalize';

const m = new SignalAutoMap();
const m2 = SignalAutoMap.fromProps({a: 1, b: 2}, ['a']);

m.get('k');                      // auto-creates
m.has('k');
m.update(new Map([['k', 'v']]));         // batched
m.updateFromProps({k: 'v'}, ['k']);      // batched
for (const k of m.keys()) {}
for (const s of m.signals()) {}
for (const [k, s] of m.entries()) {}
m.clear();
```

## Object signals

```ts
import {findObjectSignalByName, findObjectSignals, findObjectSignalNames,
        destroyObjectSignals} from '@spearwolf/signalize';

findObjectSignalByName(obj, 'prop');
findObjectSignals(obj);          // Signal[] | undefined
findObjectSignalNames(obj);      // (string|symbol)[] | undefined
destroyObjectSignals(obj1, obj2);
```

## Decorators

```ts
import {signal} from '@spearwolf/signalize/decorators';
import {createMemo} from '@spearwolf/signalize';

class Foo {
  @signal({                         // all options optional
    name:        'count',
    readAsValue: false,             // true → getter is .value (untracked)
    compare:     (a, b) => a === b,
    beforeRead:  () => {},
    attach:      something,
  }) accessor count = 0;

  // no memo decorator — bind a memo to the instance group instead
  doubled = createMemo(() => this.count * 2, {attach: this});
}
```

## Counters (debug / leak checks)

```ts
getSignalsCount(); getEffectsCount(); getLinksCount();
```
