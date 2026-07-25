import swc from 'unplugin-swc';
import {defineConfig} from 'vitest/config';

/*
 * Vite 8 transpiles TypeScript with oxc, and oxc passes TC39 standard
 * decorators through untouched — Node then chokes on `@signal() accessor foo`.
 * SWC lowers them (`decoratorVersion: '2022-03'`), so it takes over the whole
 * TS transform for the test run. `src/decorators.ts` only relies on the
 * get/set/init accessor contract and `context.name`, which 2022-03 and the
 * final proposal agree on.
 */
export default defineConfig({
  // SWC owns the TypeScript transform; the built-in oxc pass would be dead
  // weight (and Vite warns when only its `esbuild` alias is switched off).
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
    globals: true,
    environment: 'node',
    clearMocks: true,

    root: '.',
    include: ['src/**/*.{spec,test}.ts'],

    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      thresholds: {
        branches: 85,
        functions: 85,
        lines: 95,
        statements: 95,
      },
    },
  },
});
