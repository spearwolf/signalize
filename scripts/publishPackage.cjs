#!/usr/bin/env node
/* eslint-disable no-console */

const {exec} = require('child_process');
const process = require('process');

const pkgJson = require('../package.json');

function publishPackage() {
  exec(`npm publish --access public`, (error, stdout, stderr) => {
    console.error(stderr);
    console.log(stdout);
    process.exit(!error ? 0 : error);
  });
}

if (pkgJson.version.endsWith('-dev')) {
  console.log(
    'skip publishing, version',
    pkgJson.version,
    'is marked as a *development* version',
  );
  process.exit(0);
} else {
  exec(`npm show ${pkgJson.name} versions --json`, (error, stdout, stderr) => {
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
      console.error(`exec() panic: ${stderr}`);
    }
  });
}
