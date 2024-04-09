## Overview

- **Signals**
  - **create**
    - `[λ, setλ] = createSignal()`
    - `@signal() accessor α`
    - `@signalReader() accessor β`
  - **read**
    - `λ()`
    - `λ(effect)`
    - `value(λ)`
    - `beQuiet(callback)`
  - **write**
    - `setλ(value)`
    - `touch(λ)`
    - `batch(callback)`
  - **destroy**
    - `destroySignal(λ)`
- **Effects**
  - **static**
    - `λ(callback)`
    - `[run, destroy] = createEffect(callback, [...dependencies])`
    - `[run, destroy] = createEffect(callback, options)`
  - **dynamic**
    - `[run, destroy] = createEffect(callback)`
    - `[run, destroy] = createEffect(callback, options)`
  - **object decorator**
    - `@effect(options) foo() { .. }`
- **Memo**
  - `λ = createMemo(callback)`
  - `@memo() compute() { .. }`
- **Connections**
  - `γ = connect()`
    - `γ.nextValue(): Promise`
    - `γ.touch()`
    - `γ.mute()`
    - `γ.unmute()`
    - `γ.toggle()`
    - `γ.isMuted`
    - `γ.destroy()`
    - `γ.isDestroyed`
  - `unconnect(γ)`
- **utils**
  - `isSignal(λ)`
  - `muteSignal(λ)`
  - `unmuteSignal(λ)`
  - `getSignalsCount()`
  - `getEffectsCount()`
  - **objects**
    - `queryObjectSignal(Ω, name)`
    - `queryObjectSignals(Ω)`
    - `getObjectSignalKeys(Ω)`
    - `destroyEffects(...Ω)`
    - `destroySignals(...Ω)`
    - `destroySignalsAndEffects(...Ω)`


## Signals

Signals are mutable states that can trigger effects when changed.

### Create

```js
import {createSignal} from '@spearwolf/signalize';

const [foo, setFoo] = createSignal('abc');

foo();           // read out the signal value => 'abc'
setFoo('bar');   // write a new value
```

#### API

- `[λ, setλ] = createSignal()`
- `[λ, setλ] = createSignal(initialValue)`
- `[λ, setλ] = createSignal(initialValue, options)`

##### Return value

`createSignal()` &rarr; `[signalReader, signalWriter]` returns a tuple with two functions. the first function is the _signal reader_, the second is the _signal writer_.

If the _signal reader_ is called as a function, it returns the current _signal value_ as the return value.

If the _signal writer_ is called with a value, this value is set as the new _signal value_. When the signal value _changes_, any effects that depend on it will be executed.

Reading and writing is always immediate. Any effects are called synchronously. However, it is possible to change this behavior using `batch()`, `beQuiet()`, `value()` or other methods of this library. 

You can destroy the reactivity of a signal with `destroySignal(signalReader)`. A destroyed signal will no longer trigger any effects. But both the _signal reader_ and the _signal writer_ are still usable and will read and write the _signal value_.


##### Options

| option         | type                | description |
| -------------- | ------------------- | ----------- |
| `compareFn`    | `(a, b) => boolean` | Normally, the equality of two values is checked with the strict equality operator `===`. If you want to go a different way here, you can pass a function that does this. |
| `lazy`         | `boolean`           | If this flag is set, it is assumed that the value is a function that _returns the current value_. This function is then executed _lazy_, i.e. only when the signal is read for the first time. At this point, however, it should be noted that the _signal value_ is initially only _lazy_. once resolved, it is no longer _lazy_. |
| `beforeReadFn` | `() => void`        | the name says it all: a callback that is executed before the signal value is read. not intended for everyday use, but quite useful for edge cases and testing. |


### Object Decorators

```js
import {signal, signalReader} from '@spearwolf/signalize/decorators';

class Foo {
  @signal() accessor foo = 'bar';

  @signal({readAsValue: true}) accessor xyz = 123;
  @signalReader() accessor xyz$;
}

const obj = new Foo();

obj.foo;             // => 'bar'
obj.foo = 'plah';    // set value to 'plah'

obj.xyz;             // => 123
obj.xyz$();          // => 123
obj.xyz = 456;       // set value to 456
```

> 🔎 The use of `$` or `$$` as postfixes to variable names is optional and a matter of personal preference.
> However, _signalize_ mostly uses the convention that anything with a `$` prefix represents a _signal reader_ and not the value directly.
> Similarly, a `$$` postfix on the variable name indicates that it is a tuple of _signal reader_ and _signal writer_ (which is what `createSignal()` returns).
> By the way, signal readers are often represented in this documentation as λ, β, γ or other greek letters.

#### API

- `@signal() accessor Λ = initialValue`
- `@signal(options) accessor Λ = initialValue`

  | option        | type                 | description |
  | ------------- | -------------------- | ----------- |
  | `name`        | `string` \| `symbol` | The name of the signal. setting a name is optional, the signal name is usually the same as the _accessor_ name. each object has an internal map of its signals, where the key is the signal name. the name is used later, for example, for `queryObjectSignal()` or `destroySignal()` |
  | `readAsValue` | `boolean`            | If enabled, the value of the signal will be read without informing the dependencies, just like the `value(λ)` helper does. However, if the signal was defined as an object accessor using the decorator, it is not possible to access the signal reader without the help of `@signalReader()` or `queryObjectSignal()`. |

- `@signalReader() accessor Λ$`
- `@signalReader(options) accessor Λ$`

  | option | type                 | description |
  | ------ | -------------------- | ----------- |
  | `name` | `string` \| `symbol` | Creates a readable object accessor that does not contain the signal value but the _signal reader_ (function). the name of the signal is optional. if not specified, then the internal signal name is assumed to be the same as the accessor name. if the accessor name ends with a `$`, then the `$` is stripped from the signal name. |


### Read

- Calling the _signal reader_ without arguments `λ()` returns the value of the signal. If this _is called up within a dynamic effect_, the effect remembers this signal and marks it as a dependent signal.
- `value(λ)` returns the value of the signal. in contrast to the previous variant, however, no effect is notified here. it really only returns the value, there are no side effects.
- `beQuiet(callback)` executes the callback immediately. if a signal is read out within the callback, this is done without notifying an active dynamic effect. it does not matter whether the signal is read out directly or with the `value()` helper.


### Write

- Calling the _signal writer_ `setλ(value)` sets a new signal value. if the value changes (this is normally simply checked using the `===` operator), all effects that have marked this signal as a dependency are executed immediately.
- `touch(λ)` does not change the value of the signal. however, all dependent effects are still notified and executed.
- `batch(callback)` executes the callback immediately. if values are changed within the callback signal, the values are changed immediately - but any dependent effects are only executed once after the end of the callback. this prevents effects with multiple dependencies from being triggered multiple times if several signals are written.


### Destroy

- `destroySignal(λ)`

Destroys the reactivity of the signal. This signal will no longer be able to cause any effects.
However, the _signal reader_ and _signal writer_ functions will continue to work.


## Effects

Effects are functions that react to changes in signals and are executed automatically.

Without effects, signals are nothing more than ordinary variables.

With effects, you can easily control behavior changes in your application without having to write complex dependency or monitoring logic.

### Dynamic Effects

<table>
  <tbody>
    <tr>
      <th>A dynamic effect function</th>
      <th>A class with a dynamic effect</th>
    </tr>
    <tr>
      <td valign="top">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/a-standalone-effect-function--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/a-standalone-effect-function--light.png">
          <img
            src="https://github.com/spearwolf/signalize/raw/main/docs/images/gists/a-standalone-effect-function--light.png"
            alt="A standalone effect function"
            style="max-width: 100%;"
          />
        </picture>
      </td>
      <td valign="top">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/a-class-with-an-effect-method--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/a-class-with-an-effect-method--light.png">
          <img
            src="https://github.com/spearwolf/signalize/raw/main/docs/images/gists/a-class-with-an-effect-method--light.png"
            alt="A class with an effect method"
            style="max-width: 100%;"
          />
        </picture>
      </td>
    </tr>
  </tbody>
</table>

**Dynamic effects** are always executed the first time. During the execution of an effect callback function, the read signals are tracked. If one of the signals is changed afterwards, the effect is (automatically) called again.

> 🔎 The signals used are re-recorded each time the effect runs again.
> This is why they are called _dynamic_ effects.

**Static effects** do not track signals; instead, dependencies are defined in advance during effect creation:

```js
createEffect(() => {
  const sum = a() + b();
  console.log('sum of', a(), 'and', b(), 'is', sum);
}, [a, b]);
```

It doesn't matter which signals are used within the effect function, the effect will be re-run whenever a signal in the signal dependencies list changes.


### Static Effects

- `λ(callback)`
- `[run, destroy] = createEffect(callback, [...dependencies])`
- `[run, destroy] = createEffect(callback, options)`


### Dynamic Effects

- `[run, destroy] = createEffect(callback)`
- `[run, destroy] = createEffect(callback, options)`


### Object Decorator

- `@effect() foo() { .. }`
- `@effect(options) foo() { .. }`

  | option      | type                          | description |
  | ----------- | ----------------------------- | ----------- |
  | `deps`      | `Array<` λ \| `string` \| `symbol` `>` | these are the signal dependencies that mark this as a _static_ effect. otherwise it is a _dynamic_ effect |
  | `signal`    | λ \| `string` \| `symbol`          | is a shortcut that can be used when there is only one signal dependency |
  | `autostart` | `boolean`                     | an effect becomes _active_ only after it is called manually for the first time. the signal dependencies are determined when the effect is executed. for a static effect, the dependencies are known beforehand, so you can choose whether the effect callback should be executed when the static effect is called for the first time, or only after the signal dependencies have been changed |
  | `autorun`   | `boolean`                     | if disabled, the effect will not be executed automatically, but only when it is called manually (if it is called manually and the dependent signals have not changed, nothing will happen when it is called) |
