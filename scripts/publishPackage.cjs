#!/usr/bin/env node

const {execFile} = require('node:child_process');
const process = require('node:process');

const pkgJson = require('../package.json');

/*
 * `npm` is passed as a bare command name and resolved without a shell.
 * The only automated caller is the deploy job in
 * .github/workflows/main.yml, which runs on ubuntu-latest, where `npm` is
 * a real executable on PATH. On Windows it is an `npm.cmd` shim that a
 * shell-less spawn does not resolve; a run there would need
 * `process.platform === 'win32' ? 'npm.cmd' : 'npm'` — not `shell: true`,
 * which would put the shell straight back.
 */
function publishPackage() {
  execFile(
    'npm',
    ['publish', '--access', 'public'],
    (error, stdout, stderr) => {
      console.error(stderr);
      console.log(stdout);
      process.exitCode = error ? 1 : 0;
    },
  );
}

if (pkgJson.version.endsWith('-dev')) {
  console.log(
    'skip publishing, version',
    pkgJson.version,
    'is marked as a *development* version',
  );
  process.exit(0);
} else {
  execFile(
    'npm',
    ['show', pkgJson.name, 'versions', '--json'],
    (error, stdout, stderr) => {
      if (!error) {
        const versions = JSON.parse(stdout);
        if (versions.includes(pkgJson.version)) {
          console.log(
            'skip publishing, version',
            pkgJson.version,
            'is already released',
          );
          process.exit(0);
        } else {
          publishPackage();
        }
      } else {
        console.error(`execFile() panic: ${stderr}`);
        process.exitCode = 1;
      }
    },
  );
}
