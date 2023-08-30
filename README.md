# @spearwolf/signalize

[![npm version](https://badge.fury.io/js/@spearwolf%2Fsignalize.svg)](https://badge.fury.io/js/@spearwolf%2Fsignalize)

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


A __functional api__ is provided, as well as a __class-based api that uses decorators__.

> :bangbang: You could think of signals as a kind of alternative callbacks/promises or as an event-based programming technique

> 🔎 Under the hood the event-driven library [@spearwolf/eventize](https://github.com/spearwolf/eventize) is used &rarr; in fact, *__signals__ and __events__ can complement each other very well!*


# 📖 Usage

> ⚠️ While the library/api is already quite stable and almost completely tested, this documentation is still in an early and catastrophic state ... if you want to get an exact picture of the functionality of the library, you currently have no choice but to inspect the tests and the source code! You are welcome to ask directly/start a [discussion](https://github.com/spearwolf/signalize/discussions) if you want support :)

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

## Batching

Within the `batch` _callback_, all signals are written, but the dependent effects are deferred until the end of the batch function:

<table>
  <tbody>
    <tr>
      <th></th>
      <th></th>
    </tr>
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


---


_...TBD..._

[see old README for more infos](./README-legacy.md)
