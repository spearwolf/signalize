#!/usr/bin/env node
// `tsc --project smoke/tsconfig.json` compiles a smoke file that was
// renamed off the `*.test.ts` convention just as happily as one that
// wasn't, and `node --test "smoke/build/*.test.js"` then runs an empty
// list and exits 0. A stale `smoke/build/` masks the same rename, which
// is why `test:smoke` deletes it first. So the match is asserted here,
// between the compile and the run, where an empty list still means
// something.

import {globSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// The root is overridable so the spec can point this check at a fixture
// tree; `pnpm test:smoke` never sets it. Gated on `VITEST` too — Vitest sets
// it for every child process it spawns, a stray `ASSERT_SMOKE_BUILD_ROOT`
// left in a real shell cannot, so this override cannot silently soften the
// gate outside a test run just because the variable happens to be set.
const projectDir =
  process.env.VITEST && process.env.ASSERT_SMOKE_BUILD_ROOT
    ? path.resolve(process.env.ASSERT_SMOKE_BUILD_ROOT)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BUILD_GLOB = 'smoke/build/*.test.js';

if (globSync(BUILD_GLOB, {cwd: projectDir}).length === 0) {
  console.error(
    `[assert-smoke-build] no file matched \`${BUILD_GLOB}\` after compiling \`smoke/\` — a smoke test file was likely renamed off the \`*.test.ts\` convention. \`tsc\` alone cannot catch this, and a stale \`smoke/build/\` would have masked it too.`,
  );
  process.exit(1);
}
