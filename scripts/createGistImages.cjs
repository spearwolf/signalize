/* eslint-env node */
/* eslint-disable no-console */

const path = require('path');
const execShPromise = require('exec-sh').promise;

const projectDir = path.resolve(__dirname, '..');

const gists = [
  'a-class-with-a-signal.js',
  'a-standalone-signal.js',
  'a-class-with-an-effect-method.js',
  'a-standalone-effect-function.js',
  'signal-batch-object.js',
  'signal-batch-func.js',
  'signal-memo-func.ts',
  'signal-memo-class.ts',
];

async function makeGistImages(presets) {
  for (const preset of presets) {
    for (const gistname of gists) {
      const basename = gistname.replace(/\.[tj]s$/, '');
      try {
        await execShPromise(
          `pnpm dlx carbon-now-cli --config docs/gists/carbon-now.json -p ${preset} --save-to docs/images/gists --save-as ${basename}--${preset} docs/gists/${gistname}`,
          {cwd: projectDir},
        );
      } catch (e) {
        console.log('Error: ', e);
      }
    }
  }
}

makeGistImages(['light', 'dark']);
