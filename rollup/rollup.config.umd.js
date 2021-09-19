/* eslint-env node */
import path from 'path';

import rollupConfigShared from './rollup.config.shared';

export default rollupConfigShared(
  'umd',
  ({outputDir, packageJson: {name, rollupBuild: {outputName, umd: {globals}}}}) => ({
    output: {
      name,
      file: path.join(outputDir, `${outputName}.umd.js`),
      sourcemap: true,
      sourcemapFile: path.join(outputDir, `${outputName}.umd.js.map`),
      format: 'umd',
      globals,
    },
  }),
);
