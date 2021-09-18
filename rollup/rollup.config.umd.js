/* eslint-env node */
import path from 'path';

import rollupConfigShared from './rollup.config.shared';

export default rollupConfigShared(
  'es2017',
  false, // <- include externals in build output
  ({outputDir, packageJson: {rollupBuildName: name}}) => ({
    output: {
      name,
      file: path.join(outputDir, `${name}.umd.js`),
      sourcemap: true,
      sourcemapFile: path.join(outputDir, `${name}.umd.js.map`),
      format: 'umd',
      globals: {
        'eventize-js': 'eventize',
      },
    },
  }),
);
