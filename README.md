```sh
$ npm i @spearwolf/signalize
````

## signals and effects for typescript

> `signalize` is an event based library that gives your application superpowers in terms of reactivity in the form of signals and effects

if you've tried [SolidJS](https://www.solidjs.com/) before, the concept of _signals_ and _effects_ should sound familiar &mdash; in fact _signalize_ is based on the reactivity primitives of SolidJS [which are very well explained in this article](https://dev.to/ryansolid/a-hands-on-introduction-to-fine-grained-reactivity-3ndf) &mdash; however, only the concepts are shared here - the implementation behind is fundamentally different. so, why create a new implementation and not just use the one from SolidJS? well, the background is explained as follows: _signalize_ is based on [eventize v2+](https://github.com/spearwolf/eventize/tree/development). _signalize_ and _eventize_ together form the foundation for the [three-jsx](https://github.com/spearwolf/three-jsx) project. since the reactivity is an essential part of _three-jsx_, custom development has been the choice at this point to have more direct control over the refinements of the api and implementation.

_PLEASE NOTE: everything in this repository here is &mdash; W O R K &ndash; I N &ndash; P R O G R E S S &mdash; and not optimized for production use - there is currently no official npm package as output either_

creating a __signal__ is easy:

```js
import {createSignal} from '@spearwolf/signalize'

const [foo, setFoo] = createSignal('bar')     // Create a signal with an initial value

console.log('foo=', foo())                    // => "foo= bar"

setFoo('plah!')                               // Update the signal

console.log('foo=', foo())                    // => "foo= plah!"
```

an __effect__ is only a function that is called. so it is not very interesting. but it becomes more interesting when a signal is read within the function. if a signal is assigned a new value at a later time, the effect function is automatically executed _again_!

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


### API cheat sheet

| export | api | description |
|--------|-----|-------------|
| createSignal | `[get, set] = createSignal(initialValue?)` | create a signal |
| | `data = get()` | read the signal value |
| | `get(fn: (data) => void)` | same as `createEffect(() => fn(get()))` |
| | `set(data)` | update the signal value |
| touch | `touch(get)` | same as `set(get())` |
| value | `data = value(get)` | read out the value without creating (side) effects |
| createEffect | `removeEffect = createEffect(callback)` | create an effect; return an unsubscribe function |
| createMemo | `get = createMemo(callback)` | creates an effect and returns a get function which returns the result of the callback |
| batch | `batch(callback)` | batch multiple updates (setter calls) together |

_TODO: add some more descriptions_
