# @spearwolf/signalize

![npm (scoped)](https://img.shields.io/npm/v/%40spearwolf/signalize)
![GitHub Workflow Status (with event)](https://img.shields.io/github/actions/workflow/status/spearwolf/signalize/main.yml)
![GitHub](https://img.shields.io/github/license/spearwolf/signalize)


> __Signals__ and __effects__ for all❗

![signalize hero image](hero.png)

_@spearwolf/signalize_ is a library for creating __signals__, __effects__ and __connections__.

It is a standalone library and has no dependencies to other frameworks like react, angular, etc.
Since it is a pure javascript library without side effects or special environment requirements, it can be mixed and used together with other librariers / frameworks without conflict.

The library targets modern browsers and javascript based environments.
It is written in **typescript v5** and uses the new [ecmascript decorators](https://github.com/tc39/proposal-decorators).

# ⚙️ Install

```shell
npm i @spearwolf/signalize
```

`ESNext` is currently used as [typescript compile target](https://www.typescriptlang.org/tsconfig#target) (but that may change in the future).
To achieve interoperability with older javascript environments you might have to use an additional transpile pipeline of your own.

| 🔎 Since version 0.5.0 there is also a [CHANGELOG](./CHANGELOG.md)

# Overview 👀

The whole API of _@spearwolf/signalize_ is about these three concepts:

- __signals__
  - like state variables with hidden superpowers
  - when the value of a signal changes, all subscribers are automatically informed
- __effects__
  - are callback functions that are automatically executed when one or more signals &mdash; _which are read within the effect function_ &mdash; change
  - just think of it as a standalone `useEffect()` hook (but without react :wink:)
- __connections__
  - which are basically _links_ between signals and functions
  - like the geometry node connections in blender or the node connections in blueprints of the unreal engine


A __functional API__ is provided, as well as a __class-based API that uses decorators__.

> :bangbang: You could think of signals as a kind of alternative callbacks/promises or as an event-based programming technique

> 🔎 Under the hood the event-driven library [@spearwolf/eventize](https://github.com/spearwolf/eventize) is used &rarr; in fact, *__signals__ and __events__ can complement each other very well!*


# 📖 Usage

> ⚠️ While the library / API is already quite stable and almost completely tested, this documentation is still in an early and catastrophic state ... if you want to get an exact picture of the functionality of the library, you currently have no choice but to inspect the tests and the source code! You are welcome to ask directly/start a [discussion](https://github.com/spearwolf/signalize/discussions) if you want support :)

## Create Signals

Signals are mutable states that can trigger effects when changed.

<table>
  <tbody>
    <tr>
      <th>A class with a signal</th>
      <th>A standalone signal</th>
    </tr>
    <tr>
      <td valign="top">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/a-class-with-a-signal--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/a-class-with-a-signal--light.png">
          <img
            src="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/a-class-with-a-signal--light.png"
            alt="A class with a signal"
            style="max-width: 100%;"
          />
        </picture>
      </td>
      <td valign="top">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/a-standalone-signal--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/a-standalone-signal--light.png">
          <img
            src="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/a-standalone-signal--light.png"
            alt="A standalone signal"
            style="max-width: 100%;"
          />
        </picture>
      </td>
    </tr>
  </tbody>
</table>


## Create Effects

Effects are functions that react to changes in signals and are executed automatically.

_Without_ effects, signals are nothing more than ordinary variables.

With effects, you can easily control behavior changes in your application without having to write complex dependency or monitoring logic.

<table>
  <tbody>
    <tr>
      <th>A class with an effect method</th>
      <th>A standalone effect function</th>
    </tr>
    <tr>
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
    </tr>
  </tbody>
</table>

Effects are always executed the first time and automatically immediately if a signal that is read out within the effect is changed afterwards.

Sometimes, however, this is a little more often than you actually need: If you change a and then b in the example above, the result will be announced by the effect each time. If you only want to get the final result after changing both signals, you can use the `batch(callback)` function.

<details>
<summary>Advanced use of the createEffect API</summary>

### The full signature of createEffect

The `createEffect()` API returns an array with two functions:

```ts
const [run, destroy] = createEffect(myEffectCallback);
```

Optionally you can specify an options object as a parameter:

```ts
const [run, destroy] = createEffect(myEffectCallback, { autorun: true });
```

In which order the options and the effect callback are passed doesn't really matter. both variants are ok ..

```ts
const [run, destroy] = createEffect({ autorun: false }, myEffectCallback);
```
_(currently `autorun` is the only supported option and is `true` by default)_

### The run function

With the _run_ function you can call the effect directly.
Normally you don't need to do this yourself, because it happens automatically.

In combination with the `autorun: false` option &mdash; which prevents the effect from being called automatically &mdash; you can specify exactly the right time for the effect to be executed.
This is  useful if you want it to happen in a `setInterval()` or `requestAnimationFrame()`, for example.

### The destroy function

... is quickly explained: if you don't want to use the effect anymore, you can simply remove it by calling the _destroy_ function (if there is a _cleanup_ function, then of course it will be called finally)

### The effect callback can optionally return a cleanup function

Your _effect callback_ (which is your function that you pass to the effect as parameter) may also optionally return a _cleanup_ function.

Before calling an _effect callback_, a previously returned _cleanup_ function (if you provided it) is executed.

> 🔎 Does this behaviour look familiar? probably because this feature was inspired by [react's useEffect hook](https://react.dev/reference/react/useEffect)

#### An example of using a cleanup function

```js
const [getSelector, makeInteractive] = createSignal();

function onClick(event) {
  console.log('click! selector=', getSelector(), 'element=', event.target);
}

createEffect(() => {
  if (getSelector()) {
    const el = document.querySelector(getSelector());

    el.addEventListener('click', onClick, false);

    return () => {
      el.removeEventListener('click', onClick, false);
    };
  }
})

makeInteractive('#foo');  // foo is now interactive
makeInteractive('.bar');  // bar is now interactive, but foo is not
```

</details>

## Batching

Within the `batch` _callback_, all signals are written, but the dependent effects are deferred until the end of the batch function:

<table>
  <tbody>
    <tr>
      <td valign="top">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/signal-batch-object--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/signal-batch-object--light.png">
          <img
            src="https://github.com/spearwolf/signalize/raw/main/docs/images/gists/signal-batch-object--light.png"
            alt="Batch signals"
            style="max-width: 100%;"
          />
        </picture>
      </td>
      <td valign="top">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/signal-batch-func--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/signal-batch-func--light.png">
          <img
            src="https://github.com/spearwolf/signalize/raw/main/docs/images/gists/signal-batch-func--light.png"
            alt="Batch signals"
            style="max-width: 100%;"
          />
        </picture>
      </td>
    </tr>
  </tbody>
</table>

See [The difference between the standard behavior of effects and the use of batching](./docs/AdvancedGuide.md#the-difference-between-the-standard-behavior-of-effects-and-the-use-of-batching) for more informations on this.

## Create Memos

When an effect is created, the effect callback is executed immediately (and then automatically when the values of the dependent signals change).

A _memo_, on the other hand, allows you to explicitly control when the callback is executed. The _memo_ also returns a result.

On the first call the _memo_ callback is always executed, on subsequent calls the callback is only executed if the dependent signals have changed in the meantime. if not, the previous cached result value is returned.

<table>
  <tbody>
    <tr>
      <td valign="top">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/signal-memo-class--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/signal-memo-class--light.png">
          <img
            src="https://github.com/spearwolf/signalize/raw/main/docs/images/gists/signal-memo-class--light.png"
            alt="Batch signals"
            style="max-width: 100%;"
          />
        </picture>
      </td>
      <td valign="top">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/signal-memo-func--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/main/docs/images/gists/signal-memo-func--light.png">
          <img
            src="https://github.com/spearwolf/signalize/raw/main/docs/images/gists/signal-memo-func--light.png"
            alt="Batch signals"
            style="max-width: 100%;"
          />
        </picture>
      </td>
    </tr>
  </tbody>
</table>

| ‼️ The _memo_ callback `fullName()` is executed _only_ on the first call, __after that only if one or both signals have changed.__

---

_more docs coming!!_

_...TBD..._

[see old README for more infos](./README-legacy.md)
