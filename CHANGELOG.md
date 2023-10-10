# CHANGELOG

## `v0.7.0`

- the decorators are no longer included in the default export (index.js)
  - to use the decorators, the user must import them from `@spearwolf/signalize/decorators'
- fix package type definitions

## `v0.6.1`

- no _commonjs_ format is delivered anymore
- the _esm_ format is no longer bundled
- use `import type ..` syntax

## `v0.6.0`

- switch package to `type: module`
  - this hopefully solves the problem that typescript cannot resolve the types correctly when `signalize.mjs` is loaded 😵
  - the final package output will now completely omit `.mjs` file endings

## `v0.5.2`

- mark package as side effects free
- update (mainly dev) dependencies

## `v0.5.1`

- upgrade dev depenedencies
  - this includes an upgrade from typescript 5.1 to 5.2, which brings with it new build artefacts

## `v0.5.0`

- upgrade dependency `@spearwolf/eventize` to `v3.0.0`
- remove `type=module` from package.json
  - instead, use `*.mjs` file extension for _esm_ output
- introduce CHANGELOG 😉
