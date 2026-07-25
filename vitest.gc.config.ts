import {defineConfig, mergeConfig} from 'vitest/config';
import baseConfig from './vitest.config.js';

/*
 * `SignalGroup.gc.spec.ts` skips itself unless `globalThis.gc` exists.
 * Forked workers get `--expose-gc` via `execArgv`; worker threads reject that
 * flag, hence the explicit `pool: 'forks'`. Everything runs in one worker so
 * the forced collections can't race other test files.
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
