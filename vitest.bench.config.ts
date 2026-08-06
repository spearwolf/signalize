import swc from 'unplugin-swc';
import {defineConfig} from 'vitest/config';

/*
 * Separate root from vitest.config.ts on purpose: bench files must never be
 * picked up by `pnpm test` (its `include` is scoped to `src`), and spec
 * files must never be picked up here. Two roots, two concerns, no
 * accidental overlap.
 *
 * Same SWC transform as vitest.config.ts — see the comment there for why oxc
 * cannot own this pass (TC39 decorators used across `src`, which the bench
 * files import from).
 */
export default defineConfig({
  oxc: false,

  plugins: [
    swc.vite({
      module: {type: 'es6'},
      jsc: {
        target: 'es2023',
        parser: {syntax: 'typescript', decorators: true},
        transform: {decoratorVersion: '2022-03'},
      },
    }),
  ],

  test: {
    root: '.',
    include: ['bench/**/*.bench.ts'],
  },
});
