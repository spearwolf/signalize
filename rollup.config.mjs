import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

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
    },
  ],
  treeshake: 'smallest',
  external: ['@spearwolf/eventize'],
};
