## Signals

## Create

### Functions

- `[λ, setλ] = createSignal()`
- `[λ, setλ] = createSignal(initialValue)`
- `[λ, setλ] = createSignal(initialValue, options)`

  | option         | type                |
  | -------------- | ------------------- |
  | `lazy`         | `boolean`           |
  | `compareFn`    | `(a, b) => boolean` |
  | `beforeReadFn` | `() => void`        |

### Decorators

- `@signal() accessor λ = initialValue`
- `@signal(options) accessor λ = initialValue`

  | option        | type                 |
  | ------------- | -------------------- |
  | `readAsValue` | `boolean`            |
  | `name`        | `string` \| `symbol` |

- `@signalReader(options) accessor λ$`

  | option | type                 |
  | ------ | -------------------- |
  | `name` | `string` \| `symbol` |

## Read

- `λ()`
- `value(λ)`
- `beQuiet(callback)`

## Write

- `setλ(value)`
- `touch(value)`
- `batch(callback)`

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

- `[run, destroy] = createEffect(callback)`
- `[run, destroy] = createEffect(callback, {autorun: false})`

### Static Effects

- `[run, destroy] = createEffect(callback, {dependencies: ['foo', 'bar', ..]})`
- `[run, destroy] = createEffect(callback, {dependencies, autorun: false})`

### Decorators

- `@effect() foo() { .. }`
- `@effect(options) foo() { .. }`

  | option      | type                          |
  | ----------- | ----------------------------- |
  | `deps`      | `Array< string` \| `symbol >` |
  | `signal`    | `string` \| `symbol`          |
  | `autostart` | `boolean`                     |
  | `autorun`   | `boolean`                     |


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
