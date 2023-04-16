![signaler-effectus hero](./signaler-effectus-hero.png)

> The library for signals and effects on the web

_Signaler-effectus_ targets modern browsers and javascript based environments.
It is written in **Typescript v5** and uses the new [ecmascript decorators](https://github.com/tc39/proposal-decorators).

`esnext` is currently used as [typescript target](https://www.typescriptlang.org/tsconfig#target) (but that may change in the future).
To achieve interoperability with older javascript environments you might have to use an additional transpile pipeline of your own.

_Signaler-effectus_ is a standalone package with only one dependency [spearwolf/eventize](https://github.com/spearwolf/eventize) (which does not need any dependencies to other packages)


# Install

```shell
npm install signaler-effectus
```

# Usage

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
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/a_class_with_a_signal--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/a_class_with_a_signal--light.png">
          <img
            src="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/a_class_with_a_signal--light.png"
            alt="A class with a signal"
            style="max-width: 100%;"
          />
        </picture>
      </td>
      <td valign="top">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/a_standalone_signal--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/a_standalone_signal--light.png">
          <img
            src="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/a_standalone_signal--light.png"
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
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/a_class_with_an_effect_method--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/a_class_with_an_effect_method--light.png">
          <img
            src="https://github.com/spearwolf/signalize/raw/dev/docs/images/a_class_with_an_effect_method--light.png"
            alt="A class with an effect method"
            style="max-width: 100%;"
          />
        </picture>
      </td>
      <td valign="top">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/a_standalone_effect_function--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/a_standalone_effect_function--light.png">
          <img
            src="https://github.com/spearwolf/signalize/raw/dev/docs/images/a_standalone_effect_function--light.png"
            alt="A standalone effect function"
            style="max-width: 100%;"
          />
        </picture>
      </td>
    </tr>
  </tbody>
</table>

Effects are always executed automatically immediately if a signal that is read out within the effect is changed afterwards.

Sometimes, however, this is a little more often than you actually need: If you change a and then b in the example above, the result will be announced by the effect each time. If you only want to get the final result after changing both signals, you can use the `batch(callback)` function. Within the batch callback, all signals are written, but the dependent effects are not executed until the end of the batch function:

<table>
  <tbody>
    <tr>
      <th></th>
      <th></th>
    </tr>
    <tr>
      <td valign="top">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/signal_batch_object--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/signal_batch_object--light.png">
          <img
            src="https://github.com/spearwolf/signalize/raw/dev/docs/images/signal_batch_object--light.png"
            alt="A class with an effect method"
            style="max-width: 100%;"
          />
        </picture>
      </td>
      <td valign="top">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/signal_batch_func--dark.png">
          <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/signal_batch_func--light.png">
          <img
            src="https://github.com/spearwolf/signalize/raw/dev/docs/images/signal_batch_func--light.png"
            alt="A standalone effect function"
            style="max-width: 100%;"
          />
        </picture>
      </td>
    </tr>
  </tbody>
</table>

The difference between the standard behavior of effects and the use of batch is clearly visible on a timeline:

<picture>
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/timeline-a-b-e.png">
  <img
    src="https://raw.githubusercontent.com/spearwolf/signalize/dev/docs/images/timeline-a-b-e.png"
    alt="A timeline with two signals with an effect"
    style="max-width: 100%;"
  />
</picture>

---

_...TBD..._

[see old README for more infos](./README-legacy.md)
