> NOTE: formerly known as `@spearwolf/signalize` this library is now in the process of renaming itself `signaler-effectus`. so when `signaler-effectus` is referred to in the following documentation, it is intentional and if `@spearwolf/signalize` is still used, it is probably deprecated and will be adapted in the future.

# signaler-effectus

The library for signals and effects on the web


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


---

_...TBD..._
