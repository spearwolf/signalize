# CHANGELOG

## `v0.17.0` (2024-10-23)

_❗BREAKING CHANGES❗_

- refactor `createSignal()` and `createEffect()` api calls
  - introduce the `Signal` class (formerly `SignalObject`)
    - as return result of `createSignal(): Signal`
    - rename previous `Signal` _type_ &rarr; `ISignalImpl`
  - introduce a new `Effect` class
    - as return result of `createEffect(): Effect`
    - rename previous `Effect` class &rarr; `EffectImpl`
  - rename some `createSignal()` options
    - rename `compareFn` &rarr; `compare`
    - rename `beforeReadFn` &rarr; `beforeRead`
- introduce the new `SignalGroup` API
- remove some awkward and mistakable decorators
  - remove `@signalReader()`
  - remove `@effect()`
- refactor public api exports
  - rename `queryObjectSignal()` &rarr; `findObjectSignalByName()`
  - rename `getObjectSignalKeys()` &rarr; `findObjectSignalKeys()`
  - rename `getObjectSignals()` &rarr; `findObjectSignals()`
  - rename `destroySignals()` &rarr; `destroyObjectSignals()`
- cleanup types
- remove `connect()`, `unconnect()` and `class Connection`
- introduce `link()`, `unlink()` and `class SignalGroup`
  - as a more general approach and replacement of the previous connection api

### Migration Guide

#### Change `createSignal()` calls

The signature of the call to `createSignal()` has changed; a signal _object_ is now returned.
The previous calls in the form `const [val, setVal] = createSignal()` can be transformed into the form `const {get: val, set: setVal} = createSignal()`. Alternatively, you can now simply call `const val = createSignal()` and read the signal using `val.get()` or `val.value` and write it using `val.set()`.

#### Change `createEffect()` calls

Similarly, the `createEffect()` function now also returns an effect _object_.
The previous call `const [run, destroy] = createEffect()` should be rewritten as follows: `const {run, destroy} = createEffect()`. Alternatively, simply use the effect object:
```ts
const effect = createEffect(...)
...
effect.destroy()
```

#### Replace `@signalReader()` declarations

The `SignalGroup` API now replaces the awkward `@signalReader` decorator.

For each object that uses the `@signal()` decorator, a `SignalGroup` is automatically created, in which the signals are stored according to their name.
It is therefore possible to retrieve the signal api object via `group.getSignal(name)`.

Before:

```ts
class Foo {
  @signal() accessor bar = 123;
  @signalReader() accessor bar$;
}

const f = new Foo();

f.bar$((val) => {
  console.log('bar changed to', val);
});
```

After:

```ts
class Foo {
  @signal() accessor bar = 123;
}

const f = new Foo();

const bar = SignalGroup.get(f).getSignal('bar');

bar.onChange((val) => {
  console.log('bar changed to', val);
});
```

#### Replace `@effect()` declarations

The `SignalGroup` API now replaces the mistakable `@effect` decorator.

The necessity to call the methods annotated as `@effect()` in the constructor once has led to misunderstandings and ambiguities, especially when it was an effect with static dependencies. With the new `attach` option for effects, the behavior is now explicit and clear. 

Before:

```ts
class Foo {
  @signal() accessor bar = 123;
  @signal() accessor plah = 'abc';
  
  constructor() {
    this.staticEffect(); 
    this.dynamicEffect(); 
  }
  
  @effect(['bar', 'plah'])
  staticEffect() {
    console.log('bar, plah :=', this.bar, this.plah);
  }

  @effect() dynamicEffect() {
    console.log('plah, bar :=', this.plah, this.bar);
  }
  
  destroy() {
    destroySignalsAndEffects(this);
  }
}
```

After:

```ts
class Foo {
  @signal() accessor bar = 123;
  @signal() accessor plah = 'abc';
  
  constructor() {
    createEffect(() => this.dynamicEffect(), { attach: this });

    createEffect(
      () => this.staticEffect(),
      [ 'bar', 'plah' ],
      { attach: this },
    ).run();
  }
  
  staticEffect() {
    console.log('bar, plah :=', this.bar, this.plah);
  }

  dynamicEffect() {
    console.log('plah, bar :=', this.plah, this.bar);
  }

  destroy() {
    SignalGroup.destroy(this);
  }
}
```

#### Refactor `connect()` and `unconnect()` usages

The *connection* api is now replaced by the `class SignalGroup` and the `link()` and `unlink()` functions..


## `v0.16.0` (2024-08-04)

- update to `@spearwolf/eventize@4.0.1`
- use `Symbol.for` for constants

## `v0.15.0` (2024-07-22)

_maintenance update_

- **no** new feature inside!
- just updated most build dependencies
- BUT also updated the (only) runtime dependency [@spearwolf/eventize](https://github.com/spearwolf/eventize) to v4.x:
  and this is a ❗BREAKING CHANGE❗ since the new eventize api switches to the functional api by default
- _so you may need to make adjustments to your codebase if you use the eventize api directly (independently of signalize)_
  

## `v0.14.0` (2024-06-25)

- `createSignal()` now returns a polymorphic api
  - a new object-based api is returned, see the [SignalObject](./src/SignalObject.ts) class for details
  - but the returned api can still be used as an array of [reader, writer] functions
  - so you don't need to change existing code that uses the reader and writer function syntax
  - but you can use the new object-based api, which may be more convenient (depending on your coding style and context)
  - more docs will follow later ;)
- upgrade build dependencies

## `v0.13.0`

_maintenance release_

- upgrade build dependencies
- remove unnecessary optional dependencies

## `v0.12.0`

- `createEffect()` now also supports _async_ callbacks. if an async effect callback creates a cleanup callback as return value, it will be executed like a normal cleanup callback when the effect is re-executed

## `v0.11.0`

- add the `beQuiet()` helper for dynamic effects. within the beQuiet callback, an active dynamic effect will not be noticed when a signal is read.
- add another test to demonstrate the dynamic nature of effects

## `v0.10.1`

- fix `@effect` decorator types

## `v0.10.0`

- the `@effect` decorator now supports the specification of _static_ signal dependencies (via `signal` or `deps` options)
  - in this case, you can use the `autostart: false` option to control whether the effect is executed immediately when the effect method is called for the first time - or only later when one of the static signal dependencies changes
  - by default (if it is not specified), then `autostart` is activated
- if no name is specified in the `@signalReader` decorator, then the name is automatically determined from the accessor field name. with the special feature that the field name is cut off at the end if the field has a `$` in the name. for example, the signal name `foo` is extracted from the field name `foo$`

## `v0.9.0`

- ensure that each object has its own signal instance when using the `@signal` decorator
- add `name` and `readAsValue: true` options to `@signal` decorator
- introduce `@signalReader({name: 'foo'})` class accessor decorator
- export `getObjectSignalKeys(obj)` helper

## `v0.8.0`

- the createEffect api was enhanced
  - `createEffect(callback, [sigA, sigB, ..])`
    - similar to react's createEffect hook, you can now (optionally) specify a dependency array. in the dependency array, you specify the signals that will execute the effect on change. the signals do not have to match the signals used in the effect callback. if such static dependencies are specified, the effect callback will no longer be executed automatically when you create the effect. it will only be executed later if at least one signal changes.
- a signal reader callback is no longer called immediately ..
  - only when the signal changes
  - the callback is no longer called as a dynamic effect
  - it only uses the original signal as a static effect dependency
- introduce the type helper `SignalFuncs<Type>` &mdash; the return value type of `createSignal()`
- the pre-compile step for jest is omitted, now ts-jest is used and jest can be called directly without any indirection 🥳

## `v0.7.0`

- the decorators are no longer included in the default export (index.js)
  - to use the decorators, the user must import them from `@spearwolf/signalize/decorators'
- fix package type definitions

## `v0.6.1`

- no _commonjs_ format is delivered anymore
- the _esm_ format is no longer bundled
- use `import type ..` syntax

## `v0.6.0`

- switch package to `type: module`
  - this hopefully solves the problem that typescript cannot resolve the types correctly when `signalize.mjs` is loaded 😵
  - the final package output will now completely omit `.mjs` file endings

## `v0.5.2`

- mark package as side effects free
- update (mainly dev) dependencies

## `v0.5.1`

- upgrade dev depenedencies
  - this includes an upgrade from typescript 5.1 to 5.2, which brings with it new build artefacts

## `v0.5.0`

- upgrade dependency `@spearwolf/eventize` to `v3.0.0`
- remove `type=module` from package.json
  - instead, use `*.mjs` file extension for _esm_ output
- introduce CHANGELOG 😉

## `0.4.0` (2023-03-02)

- upgrade to typescript@5
  - refactor build pipeline
- mute, unmute and destroy signals
  - `muteSignal(get)`
  - `unmuteSignal(get)`
  - `destroySignal(get)`
- fix effect cleanup callback
  - if an effect is executed again, the cleanup callback from the last effect is called first (the behavior is similar to the react.useEffect() cleanup function)
- add `getEffectsCount()` and `onDestroyEffect()` helpers
- auto cleanup/unsubscription of effects and memos when all their signals are destroyed
- change signature of the `createEffect()` helper: an array with a _run_ and _unsubscribe_ function is now returned
- refactor child effects

## `0.3.2` (2023-02-22)

- typescript: export all types
