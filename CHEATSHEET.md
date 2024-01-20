## Signals

Signals are mutable states that can trigger effects when changed.

## Create

```js
import {createSignal} from '@spearwolf/signalize';

const [foo, setFoo] = createSignal('abc');

foo();           // read out the signal value => 'abc'
setFoo('bar');   // write a new value
```

### API

- `[λ, setλ] = createSignal()`
- `[λ, setλ] = createSignal(initialValue)`
- `[λ, setλ] = createSignal(initialValue, options)`

  | option         | type                |
  | -------------- | ------------------- |
  | `lazy`         | `boolean`           |
  | `compareFn`    | `(a, b) => boolean` |
  | `beforeReadFn` | `() => void`        |


### Decorators

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

> The use of `$` or `$$` as postfixes to variable names is optional and a matter of personal preference.
> However, _signalize_ uses the convention that anything with a `$` prefix represents a _signal reader_ and not the value directly.
> Btw. signal readers are also often represented as λ in this documentation.
> Similarly, a `$$` postfix on the variable name indicates that it is a tuple of _signal reader_ and _signal writer_ (which is what `createSignal()` returns).

#### API

- `@signal() accessor Λ = initialValue`
- `@signal(options) accessor Λ = initialValue`

  | option        | type                 |
  | ------------- | -------------------- |
  | `readAsValue` | `boolean`            |
  | `name`        | `string` \| `symbol` |

- `@signalReader(options) accessor Λ$`

  | option | type                 |
  | ------ | -------------------- |
  | `name` | `string` \| `symbol` |


## Read

- `λ()` returns the value of the signal. If this is called up within a dynamic effect, the effect remembers this signal and marks it as a dependent signal.
- `value(λ)` returns the value of the signal. in contrast to the previous variant, however, no effect is notified here. it really only returns the value, there are no side effects.
- `beQuiet(callback)` executes the callback immediately. if a signal is read out within the callback, this is done without notifying an active dynamic effect. it does not matter whether the signal is read out directly or with the `value()` helper.


## Write

- `setλ(value)` sets a new signal value. if the value changes (this is normally simply checked using the `===` operator), all effects that have marked this signal as a dependency are executed immediately.
- `touch(λ)` does not change the value of the signal. however, all dependent effects are still notified and executed.
- `batch(callback)` executes the callback immediately. if values are changed within the callback signal, the values are changed immediately - but any dependent effects are only executed once after the end of the callback. this prevents effects with multiple dependencies from being triggered multiple times if several signals are written.


## Destroy

- `destroySignal(λ)`
- `destroySignals(...Ω)`
- `destroySignalsAndEffects(...Ω)`


## Other

- `isSignal(λ): boolean`
- `muteSignal(λ)`
- `unmuteSignal(λ)`
- `getSignalsCount(): number`
- `queryObjectSignal(Ω, name)`
- `queryObjectSignals(Ω)`
- `getObjectSignalKeys(Ω)`


## Effects

### Dynamic Effects

- `[, destroy] = createEffect(callback)`
- `[run, destroy] = createEffect(callback, {autorun: false})`


### Static Effects

- `[run, destroy] = createEffect(callback, {dependencies: ['foo', 'bar', ..]})`
- `[run, destroy] = createEffect(callback, {dependencies, autorun: false})`


### Decorators

- `@effect() foo() { .. }`
- `@effect(options) foo() { .. }`

  | option      | type                          | description |
  | ----------- | ----------------------------- | ----------- |
  | `deps`      | `Array<` λ \| `string` \| `symbol` `>` | these are the signal dependencies that mark this as a _static_ effect. otherwise it is a _dynamic_ effect |
  | `signal`    | λ \| `string` \| `symbol`          | is a shortcut that can be used when there is only one signal dependency |
  | `autostart` | `boolean`                     | an effect becomes _active_ only after it is called manually for the first time. the signal dependencies are determined when the effect is executed. for a static effect, the dependencies are known beforehand, so you can choose whether the effect callback should be executed when the static effect is called for the first time, or only after the signal dependencies have been changed |
  | `autorun`   | `boolean`                     | if disabled, the effect will not be executed automatically, but only when it is called manually (if it is called manually and the dependent signals have not changed, nothing will happen when it is called) |


### Memo

- `λ = createMemo(callback)`
- `@memo() heavyCalc() { .. }`


### Destroy

- `destroyEffects(...Ω)`
- `destroySignalsAndEffects(...Ω)`


## Other

- `getEffectsCount(): number`


## Connections

- `connect()`
- `unconnect()`
