/* eslint-env node */
import path from 'path';

import rollupConfigShared from './rollup.config.shared';

export default rollupConfigShared(
  'es2017',
  ({outputDir, packageJson: {rollupBuildName: name}}) => ({
    output: {
      name,
      file: path.join(outputDir, `${name}.js`),
      sourcemap: true,
      sourcemapFile: path.join(outputDir, `${name}.js.map`),
      format: 'esm',
    },
  }),
);
