/* eslint-env node */
import path from 'path';

import rollupConfigShared from './rollup.config.shared';

export default rollupConfigShared(
  'esm',
  ({outputDir, packageJson: {name, rollupBuild: {outputName}}}) => ({
    output: {
      name,
      file: path.join(outputDir, `${outputName}.js`),
      sourcemap: true,
      sourcemapFile: path.join(outputDir, `${outputName}.js.map`),
      format: 'esm',
    },
  }),
);
