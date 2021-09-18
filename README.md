```sh
$ npm i @spearwolf/signalize
````

## signals and effects for typescript

> `signalize` is an event based library that gives your application superpowers in terms of reactivity in the form of signals and effects

if you've tried [SolidJS](https://www.solidjs.com/) before, the concept of _signals_ and _effects_ should sound familiar &mdash; in fact `signalize` is partly based on the reactivity primitives of SolidJS [which are very well explained in this article](https://dev.to/ryansolid/a-hands-on-introduction-to-fine-grained-reactivity-3ndf) &mdash; however, only the concepts are shared here - the implementation is fundamentally different.

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
