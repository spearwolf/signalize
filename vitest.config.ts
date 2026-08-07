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

    /*
     * Two projects, one run. The GC suites need `--expose-gc`, and that flag
     * only survives in a forked worker — so they get their own project here
     * instead of a second config that is invoked separately and, until now,
     * measured separately. `pnpm test` runs all 411 tests and produces a
     * single coverage map over both, which is what makes the per-file
     * thresholds below mean anything: the FinalizationRegistry callbacks in
     * link.ts and SignalGroup.ts are reachable from the gc project alone.
     */
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.{spec,test}.ts'],
          exclude: ['src/**/*.gc.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'gc',
          include: ['src/**/*.gc.spec.ts'],
          pool: 'forks',
          execArgv: ['--expose-gc'],
          fileParallelism: false,
        },
      },
    ],

    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      /*
       * Three tiers, because a single per-file number would have to clear the
       * weakest file in the tree and would then protect nothing else.
       *
       * Tier 1 (the plain numbers) is the floor under every file. It is set by
       * the weakest cell in the tree, integer-rounded at or below the current
       * value minus 0.5.
       * Tier 2 (the negated glob) pins every file no remaining audit package
       * touches at 100 % — including files that do not exist yet, which is the
       * point: new code arrives covered or it arrives named in an error.
       * Tier 3 covers the four files that are at 100 % today but are still on
       * the worklist; they keep statements, functions and lines at 100 and get
       * two uncovered branches of slack for defensive guards.
       *
       * Glob groups can only add constraints, never relax them (see Vitest's
       * resolveThresholds: the global tier applies to every file regardless of
       * glob membership). So tier 1 cannot be raised above the weakest file —
       * that is signal-core.ts at 12/14 branches.
       */
      thresholds: {
        perFile: true,
        statements: 97,
        branches: 85,
        functions: 96,
        lines: 98,
        'src/**/!(EffectImpl|SignalGroup|SignalLink|SignalAutoMap|bequiet|collect-errors|createSignal|link|signal-core).ts':
          {statements: 100, branches: 100, functions: 100, lines: 100},
        'src/{SignalLink,SignalAutoMap,bequiet,collect-errors}.ts': {
          statements: 100,
          branches: 95,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
