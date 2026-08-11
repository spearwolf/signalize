#!/usr/bin/env node

const {exec} = require('node:child_process');
const process = require('node:process');

const pkgJson = require('../package.json');

function publishPackage() {
  exec(`npm publish --access public`, (error, stdout, stderr) => {
    console.error(stderr);
    console.log(stdout);
    process.exitCode = error ? 1 : 0;
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
      process.exitCode = 1;
    }
  });
}
