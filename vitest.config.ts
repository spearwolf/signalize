import {globSync} from 'node:fs';
import swc from 'unplugin-swc';
import {defineConfig} from 'vitest/config';

const coverageInclude = ['src/**/*.ts'];
const coverageExclude = [
  'src/**/*.spec.ts',
  'src/**/*.test.ts',
  'src/__testing__/**',
];

// Paths, not file names: a same-named file in a subdirectory of `src/` is a
// different file and stays under the 100 % rule below.
const fullCoverageExceptions = [
  'src/EffectImpl.ts',
  'src/SignalGroup.ts',
  'src/SignalLink.ts',
  'src/SignalAutoMap.ts',
  'src/collect-errors.ts',
  'src/create-signal.ts',
  'src/link.ts',
  'src/signal-core.ts',
];

const coverageThresholds = {
  perFile: true,
  statements: 97,
  branches: 85,
  functions: 96,
  lines: 98,
  [`!{${fullCoverageExceptions.join(',')}}`]: {
    statements: 100,
    branches: 100,
    functions: 100,
    lines: 100,
  },
  'src/{SignalLink,SignalAutoMap,collect-errors}.ts': {
    statements: 100,
    branches: 95,
    functions: 100,
    lines: 100,
  },
};

// Keys of `coverage.thresholds` that configure the run instead of naming a
// glob group — mirrors the skip list in Vitest's own `resolveThresholds`.
const NON_GLOB_THRESHOLD_KEYS = new Set([
  'perFile',
  'autoUpdate',
  '100',
  'statements',
  'branches',
  'functions',
  'lines',
]);

/*
 * Vitest builds one coverage map per threshold glob and then iterates over
 * its summaries; a glob that matches nothing iterates over zero summaries and
 * the whole group passes. A typo in the path or a glob written against the
 * wrong root turns a 100 % rule into a decoration, without a word of warning.
 * So every glob group is matched here against the files coverage will
 * actually report on, and a group with no match refuses the run.
 */
function assertThresholdGlobsMatch(thresholds: Record<string, unknown>): void {
  const cwd = import.meta.dirname;

  const covered = new Set(globSync(coverageInclude, {cwd}));
  for (const file of globSync(coverageExclude, {cwd})) {
    covered.delete(file);
  }

  if (covered.size === 0) {
    throw new Error(
      `[vitest.config.ts] coverage.include matches no files: ${coverageInclude.join(', ')}`,
    );
  }

  const dead = Object.keys(thresholds)
    .filter((key) => !NON_GLOB_THRESHOLD_KEYS.has(key))
    // `globSync` cannot resolve a leading `!` — measured, it returns zero
    // matches for the negated key — so the generic dead-glob check below
    // would misreport it; the negated group gets its own check underneath.
    .filter((glob) => !glob.startsWith('!'))
    .filter((glob) => !globSync(glob, {cwd}).some((file) => covered.has(file)));

  if (dead.length > 0) {
    throw new Error(
      `[vitest.config.ts] coverage threshold glob group(s) match none of the ${covered.size} files coverage reports on: ${dead.join(' · ')}. Vitest passes an empty group silently, so the rule would not be enforced. Globs are matched relative to the project root.`,
    );
  }

  const staleExceptions = fullCoverageExceptions.filter(
    (path) => !globSync(path, {cwd}).some((file) => covered.has(file)),
  );
  if (staleExceptions.length > 0) {
    throw new Error(
      `[vitest.config.ts] the 100 % rule excuses path(s) coverage does not report on: ${staleExceptions.join(' · ')}. Nothing is exempt under that name, so the file it was renamed to now stands under the 100 % rule unannounced. Paths are matched relative to the project root.`,
    );
  }
  if (covered.size === fullCoverageExceptions.length) {
    throw new Error(
      `[vitest.config.ts] the 100 % rule excuses all ${covered.size} files coverage reports on, so it enforces nothing.`,
    );
  }
}

assertThresholdGlobsMatch(coverageThresholds);

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
     * rather than living outside this config, where their coverage would be
     * measured separately. `pnpm test` runs both projects in one pass and
     * produces a single coverage map over both, which is what makes the per-file
     * thresholds below mean anything: every FinalizationRegistry callback in
     * `src/` is reachable from the gc project alone.
     */
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          // The guard scripts in `scripts/` are plain `.mjs` and are checked by
          // spawning them against a fixture tree, so their specs sit next to them
          // instead of in `src/`. No new project: they need nothing the unit
          // project doesn't already give them.
          include: ['src/**/*.{spec,test}.ts', 'scripts/**/*.spec.mjs'],
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
      include: coverageInclude,
      exclude: coverageExclude,
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      /*
       * Three tiers, because a single per-file number would have to clear the
       * weakest file in the tree and would then protect nothing else.
       *
       * Tier 1 (the plain numbers) is the floor under every file. It is set by
       * the weakest cell in the tree, integer-rounded at or below the current
       * value minus 0.5.
       * Tier 2 (the negated path list) pins every file outside that list at
       * 100 % — including files that do not exist yet, which is the point: new
       * code arrives covered or it arrives named in an error.
       * Tier 3 holds statements, functions and lines of the files it names at
       * 100 but states branches as a percentage, leaving room for a defensive
       * guard that scales with the file's branch count — under twenty, none.
       *
       * Glob groups can only add constraints, never relax them (see Vitest's
       * resolveThresholds: the global tier applies to every file regardless of
       * glob membership). So tier 1 cannot be raised above whichever file has
       * the weakest branch coverage in the tree — today that is SignalGroup.ts.
       */
      thresholds: coverageThresholds,
    },
  },
});
