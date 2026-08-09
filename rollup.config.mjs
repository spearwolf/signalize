import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {createBanner} from './rollup/createBanner.mjs';
import {makeVersionWithBuild} from './rollup/makeVersionWithBuild.mjs';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectDir, 'package.json')),
);

const makeBanner = (build) => {
  const version = makeVersionWithBuild(build)(packageJson.version);
  return createBanner({...packageJson, version});
};

export default {
  input: {
    index: 'lib/index.js',
    decorators: 'lib/decorators.js',
  },
  output: [
    {
      banner: makeBanner('esm'),
      dir: 'dist',
      entryFileNames: '[name].js',
      chunkFileNames: 'signalize.[hash].js',
      format: 'es',
      sourcemap: true,
    },
  ],
  treeshake: 'smallest',
  external: ['@spearwolf/eventize'],
  onwarn(warning, warn) {
    // A cycle here is not cosmetic: it makes module-eval order load-bearing
    // and can resurrect the EffectImpl TDZ crash. Fail the build instead.
    if (warning.code === 'CIRCULAR_DEPENDENCY') {
      throw new Error(`circular dependency: ${warning.message}`);
    }
    warn(warning);
  },
};
