# @spearwolf/signalize

[![npm version](https://badge.fury.io/js/@spearwolf%2Fsignalize.svg)](https://badge.fury.io/js/@spearwolf%2Fsignalize)

## Signals and Effects for Typescript

This library provides a simple and intuitive way to work with _signals_ and _effects_ :rocket:

**Signals** are variables that can change over time and respond to events. Signals let you model data in your application and control how it evolves over time.

**Effects** are functions that respond to signals and perform a specific action when a signal changes. With effects, you can easily control behavior changes in your application without having to write complex dependency or monitoring logic.

If you've ever used [SolidJS](https://www.solidjs.com/), or heard of [preactjs/signals](https://github.com/preactjs/signals), you'll probably be familiar with it &mdash; in fact, the article [A Hands-on Introduction to Fine-Grained Reactivity](https://dev.to/ryansolid/a-hands-on-introduction-to-fine-grained-reactivity-3ndf) inspired me to create my own standalone library for it. Thank you Ryan &mdash; an amazing article you wrote there ;)

:fire: _UPDATE 2023-02-22_ &rarr; in fact, there seems to be a lot of hype around this topic right now. among other things, angular also seems to be getting signals soon, here are some more links:
- [useSignal() is the Future of Web Frameworks](https://www.builder.io/blog/usesignal-is-the-future-of-web-frameworks)
- [Angular Signals Demo](https://angular-signals.netlify.app/)

### The current state of this library

> THIS LIBRARY IS FOR ANYONE WHO WANTS TO CODE WITH SIGNALS WITHOUT BEING TIED TO ONE OF THE _BIG_ FRAMEWORKS LIKE REACT, SOLIDJS OR ANGULAR &mdash; JUST YOU, VANILLA JS AND SIGNALS :rocket:

- The current version of the library is in a :heavy_check_mark: __stable__ state, the API is minimal but fully implemented and tested!
- So far I have used this library in smaller projects (e.g. web components), which worked wonderfully :smile:
- Feel free to try out &mdash; contributions of any kind are welcome :+1:
## Getting Started

### Install

```sh
$ npm i @spearwolf/signalize
````

:point_right: This library has no dependency other than [@spearwolf/eventize](https://github.com/spearwolf/eventize) (which therefore does not require any further dependencies).

:point_right: If you only want to work with signals and effects, there is no reason to use the API of _spearwolf/eventize_ directly (that's what _spearwolf/signals_ does in the background) &mdash; on the other hand the two libraries complement each other perfectly and work hand in hand!

### Create a Signal

Creating a __signal__ is easy:

```js
import {createSignal} from '@spearwolf/signalize'

const [foo, setFoo] = createSignal('bar')     // Create a signal with an initial value

console.log('foo=', foo())                    // => "foo= bar"

setFoo('plah!')                               // Update the signal

console.log('foo=', foo())                    // => "foo= plah!"
```

### Create an Effect

An __effect__ is a function that is called. so it is not very interesting. but it becomes more interesting when a signal is read within the function. if a signal is assigned a new value at a later time, the effect function is automatically executed _again_!

the following example produces the same output as the previous one:

```js
import {createSignal, createEffect} from '@spearwolf/signalize'

const [foo, setFoo] = createSignal('bar')

createEffect(() => {
  console.log('foo=', foo())    // => "foo= bar"
})

setFoo('plah!')                 // the effect function is called again now
                                // => "foo= plah!"
```


## API Cheat Sheet

| export | usage | description |
|--------|-------|-------------|
| createSignal | `[get, set] = createSignal(initialValue?)` | create a signal |
| | `data = get()` | read the signal value |
| | `get(fn: (data) => void)` | same as `createEffect(() => fn(get()))` |
| | `set(data)` | update the signal value |
| touch | `touch(get)` | same as `set(get())` &mdash; no! wait, `set(get())` will _not_ signal an update, but `touch()` will do the magic without changing the value |
| value | `data = value(get)` | read out the value without creating (side) effects |
| createEffect | `removeEffect = createEffect(callback)` | create an effect; return an unsubscribe function. the callback can return an optional _cleanup_ callback function. this callback will be called before next effect run or when the effect is destroyed (e.b. using the unsubscribe function) |
| createMemo | `get = createMemo(callback)` | creates an effect and returns a signal get function which returns the result of the callback |
| batch | `batch(callback)` | batch multiple updates (setter calls) together |
| destroySignal | `destroySignal(get)` | destroy the signal. effects (and memos) are automatically released when all their used signals are destroyed. you can still use the getter and setter from the signal, but no effects are triggered anymore. _tidying up is good practice, otherwise everything will overflow at some point_ ;) |
| muteSignal | `muteSignal(get)` | this is the reversible variant of `destroySignal()`. you can still use the getter and setter of the signal, but no effects are triggered in the background. in contrast to `destroySignal()`, event subscriptions of effects are not removed in the background, they remain, just in the inactive state. so _mute_ is not a replacement for _destroy_ |
| unmuteSignal | `unmuteSignal(get)` | unmute the signal. this is the counterpart to `muteSignal()` |
| onCreateEffect | `unsubscribe = onCreateEffect(callback: (effect) => void)` | will be called whenever an effect is created with `createEffect()`; return an unsubscribe function &mdash; _NOTE: this is a global hook, which probably only should be used rarely and sparingly, but it is documented here as well_ |
| onDestroyEffect | `unsubscribe = onCreateEffect(callback: (effect) => void)` | will be called whenever an effect is destroyed; return an unsubscribe function &mdash; _NOTE: this is a global hook, which probably only should be used rarely and sparingly, but it is documented here as well_ |
| getEffectsCount | `getEffectsCount() => number` | return the number of active effects. _NOTE: is mainly interesting for tests_ |

For more infos about the api and its behavior and usage, the reader is recommended to take a look at the sources, more precisely the test specs, where many partial aspects of this library are described in detail with examples.


## CHANGLELOG

### 0.4.0 (2023-03-02)

- upgrade to typescript@5
  - refactor build pipeline
- mute, unmute and destroy signals
  - `muteSignal(get)`
  - `unmuteSignal(get)`
  - `destroySignal(get)`
- fix effect cleanup callback
  - if an effect is executed again, the cleanup callback from the last effect is called first (the behavior is similar to the react.useEffect() cleanup function)
- add `getEffectsCount()` helper
- auto cleanup/unsubscribe of effects and memos when all their signals are destroyed

### 0.3.2 (2023-02-22)

- typescript: export all types
