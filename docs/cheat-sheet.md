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

isSignal(x); getSignalsCount();   // live = created, not destroyed, still reachable
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

// self-write: each nested run's cleanup runs at once when superseded — none is dropped
// async: cleanup of a superseded run runs LATE (on settle), rejections are reported
// a throwing callback no longer stops the other effects of that write
// set() re-raises after the delivery — several failures as an AggregateError
// but a throwing FIRST run destroys the effect and throws at createEffect()
//   — unless {attach} holds it; same for createMemo() and its memo signal
onEffectError(({error, effectId, phase}) => {});  // → unsubscribe
// no handler → console.error instead of an unhandled rejection
// handler MUST be sync or catch itself — nothing awaits it
// handler throws → dispatch stops; lower-priority handlers miss the event
```

## Memos

```ts
import {createMemo} from '@spearwolf/signalize';

const m = createMemo(() => a.get() * 2, {
  lazy:         false,   // true: recompute on read; effects do NOT re-run
  priority:     1000,
  attach:       obj,
  name:         'm',     // group registration
  batchWrites:  false,   // true only if computer() itself writes OTHER signals —
                          // costs read-freshness: a dirty composed memo read
                          // inside the batch can come back stale (permanently,
                          // if that memo is lazy)
});
m();                 // SignalReader
```

## Links

```ts
import {link, unlink, getLinksCount} from '@spearwolf/signalize';

const con = link(src, target, {attach: obj});  // target: signal | callback
unlink(src, target);  unlink(src);
// unlink(src) tears every link down, then reports — several failures as an AggregateError
// held until destroy()/unlink()/{attach} clears/source|target dies — a link on a still-live source is never reclaimed by GC alone

con.lastValue; con.isMuted; con.isDestroyed;  // lastValue = last announced value; a frame superseded by a re-entrant write, or one whose callback destroyed the link, does not set it
con.mute(); con.unmute(); con.toggleMute();
con.touch(); con.destroy(); con.attach(obj);

await con.nextValue({signal});                                    // rejects with an Error on destroy, with signal.reason on abort
for await (const v of con.asyncValues((v, i) => i >= 5, {signal})) {/* … */} // last-value-only, shared retain across parallel iterators, dropped after the last iterator; abort THROWS, destroy ends quietly

getLinksCount(); getLinksCount(src);                              // link() warns once per source at 1000 links
```

## Context modes

```ts
import {batch, beQuiet, isQuiet, hibernate} from '@spearwolf/signalize';

batch(() => { a.set(1); b.set(2); });   // dedup + priority flush
                                         // callback must be sync — async throws TypeError (tsc rejects it too)
const v = beQuiet(() => a.get());       // no track, no notify; returns the callback's result
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
getSignalGroupsCount();                     // live group count; collected groups are not counted

g.attachSignal(s); g.attachSignalByName('n', s);
g.attachSignalByName('n', s2);  // rebind: destroys s unless attachSignal'd/other name
g.attachSignalByName('n');      // releases the name the same way
g.detachSignal(s); g.signal('n'); g.hasSignal('n');
g.attachEffect(e); g.runEffects();  // attachEffect throws on a destroyed effect
g.attachLink(l);   g.detachLink(l);  // a destroyed link takes itself out of the group
g.attachGroup(c);  // throws on self or on a descendant
g.detachGroup(c);
g.off();    // destroy attached effects/links, drop external subs, keep signals — not an in-effect {attach} memo's
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
m.delete('k');                   // destroy that signal + drop the entry → boolean
m.clear();
```

An entry whose signal is destroyed from the outside leaves the map in the same
turn — `has(key)` goes `false`, `get(key)` creates a fresh one, `delete(key)`
reports `false`.

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
  // dies with the parent effect if the instance is built inside an effect body
}
```

## Counters (debug / leak checks)

```ts
getSignalsCount(); getEffectsCount(); getLinksCount();
```

`getSignalsCount()` and `getLinksCount()` also come down on their own once a
dropped signal or link is collected — eventually, never observably. Compare
them after explicit teardown, not after dropping references.
