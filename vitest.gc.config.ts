import {defineConfig, mergeConfig} from 'vitest/config';
import baseConfig from './vitest.config.js';

/*
 * The gc project in vitest.config.ts already runs `SignalGroup.gc.spec.ts`
 * and `link.gc.spec.ts` under --expose-gc, so this config is no longer
 * what makes those suites run. Both projects already use Vitest 4's default
 * `forks` pool, with a fresh child process per spec file even in the
 * parallel default run — so there is no cross-file state this run
 * uniquely exposes, and it is not "one worker" either. What it actually
 * adds: `fileParallelism: false` runs every file serially instead of
 * just the two gc-project files, and --expose-gc applies to the whole
 * suite instead of only those two. That is why `pnpm test:gc` stays in
 * CI and in `pnpm world` for now.
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      pool: 'forks',
      execArgv: ['--expose-gc'],
      fileParallelism: false,
    },
  }),
);
