#!/usr/bin/env node
// Guard for SEC-001: the bundle banner must be a pure function of
// package.json. Anything ambient that leaks into it — a build date, a
// random, a clock — makes two builds of the same commit produce different
// bytes, and a consumer can no longer verify the published artifact against
// their own rebuild. Rendering the banner twice under deliberately different
// ambient state catches that, at the cost of also catching module-top-level
// reads via the mechanism below.
//
// The two banner modules load through a cache-busted dynamic `import()`,
// issued *after* Date/Math.random are stubbed — not a static top-level
// import. A static import is evaluated once per process, before any stub
// can run: a module-top-level `new Date()` (as opposed to one read inside
// the exported function) would be captured once and reused for both
// renders, and this witness would report "reproducible" for a banner that
// isn't. Appending a distinct query string per render makes Node treat each
// import as a separate module instance with its own top-level evaluation
// (confirmed for this Node version: a bare re-import of the same specifier
// reuses the cached instance, a requery does not) — so a module-level read
// in either file is now stubbed the same as a function-level one. The
// boundary that remains: only these two directly-imported files are
// cache-busted. A module-level read buried in something *they* statically
// import — neither does today — would need its own cache-busted import to
// be caught the same way.

import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const pkg = JSON.parse(
  readFileSync(path.join(projectDir, 'package.json'), 'utf8'),
);

const BUILD = 'esm';

async function renderUnder(isoDate, randomValue) {
  const RealDate = globalThis.Date;
  const realRandom = Math.random;
  const fixed = RealDate.parse(isoDate);
  class StubDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixed);
      else super(...args);
    }
    static now() {
      return fixed;
    }
  }
  globalThis.Date = StubDate;
  Math.random = () => randomValue;
  try {
    // The query string is only a cache key, never resolved as part of the
    // path — it forces a fresh module instance so this render's stub is in
    // place for the modules' top-level evaluation, not just for the call
    // below it.
    const cacheBust = encodeURIComponent(isoDate);
    const {createBanner} = await import(
      `../rollup/createBanner.mjs?t=${cacheBust}`
    );
    const {makeVersionWithBuild} = await import(
      `../rollup/makeVersionWithBuild.mjs?t=${cacheBust}`
    );
    return createBanner({
      ...pkg,
      version: makeVersionWithBuild(BUILD)(pkg.version),
    });
  } finally {
    globalThis.Date = RealDate;
    Math.random = realRandom;
  }
}

const first = await renderUnder('2001-02-03T04:05:06Z', 0.125);
const second = await renderUnder('2044-11-22T21:20:19Z', 0.875);

const fail = (msg) => {
  console.error(`[check-banner] ${msg}`);
  process.exit(1);
};

if (first !== second) {
  fail(
    'the banner is not reproducible — two renders under different ambient ' +
      'state produced different text. Two builds of the same commit would ' +
      'ship different bytes (SEC-001).\n' +
      `--- render A ---\n${first}\n--- render B ---\n${second}`,
  );
}

// Positive pins, so the check cannot pass by the banner going empty or
// losing the build tag the version carries.
const expectedVersionLine = `@version ${pkg.version}+${BUILD}`;
if (!first.startsWith('/*!')) {
  fail('the banner no longer starts with the `/*!` legal-comment marker');
}
if (!first.split('\n').includes(expectedVersionLine)) {
  fail(
    `the banner has no \`${expectedVersionLine}\` line — expected the ` +
      'package version plus the build tag and nothing else',
  );
}
