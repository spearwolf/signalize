/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-env node */
import path from 'path';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import {sizeSnapshot} from 'rollup-plugin-size-snapshot';
import {terser} from 'rollup-plugin-terser';

import createBannerPlugin from './bannerPlugin';
import {makeVersionWithBuild} from './makeVersionWithBuild';
import {rewriteExternalsPlugin} from './rewriteExternalsPlugin';

const projectDir = path.resolve(path.join(path.dirname(__filename), '..'));
const outputDir = path.join(projectDir, 'build');

const packageJson = require(path.join(projectDir, 'package.json'));

const extensions = ['.js', '.ts', '.json'];

const externals = ['eventize-js'];

export default (build, rewriteExternals, buildConfig) => {
  const version = makeVersionWithBuild(build)(packageJson.version);
  const overrideConfig = buildConfig({outputDir, version, packageJson});

  const plugins = [
    typescript(),
    createBannerPlugin({...packageJson, version}),
    commonjs(),
    resolve({
      extensions,
    }),
    replace({
      preventAssignment: true,
      NODE_ENV: JSON.stringify('production'),
    }),
    terser({
      output: {comments: /^!/},
      ecma: 2017,
      safari10: true,
      compress: {
        global_defs: {
          DEBUG: false,
        },
      },
    }),
    sizeSnapshot(),
  ];

  if (rewriteExternals) {
    plugins.unshift(rewriteExternalsPlugin(externals));
  }

  return {
    plugins,
    input: 'src/index.ts',
    ...overrideConfig,
  };
};
