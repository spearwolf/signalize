#!/usr/bin/env node
// `pnpm compile:types` sets `stripInternal: true`, which is the whole point
// of tagging an implementation-layer symbol `@internal` — but nothing else
// in the repo reads what actually landed in `lib/*.d.ts` afterwards.
// `pnpm check`, `pnpm test:smoke` and `pnpm checkPkgTypes` all pass on a
// `lib/` whose declarations reference a symbol that isn't declared anywhere
// in them (measured: `@internal` on `SignalLink`'s `[$queueUnsubscribes]`
// field alone, without also stripping the constant it comes from, produces
// exactly that and every one of the three still exits 0) — `skipLibCheck`
// and `attw`'s module-shape reading both look past it, and `pnpm typecheck`
// never includes `lib/` in the first place. This is the one gate that reads
// the emitted declarations themselves, with `skipLibCheck` off.
//
// `--ignoreConfig` is required from the command line under TypeScript 7
// once files are named directly (otherwise `TS5112`), which is also why the
// flags below are spelled out again instead of pointing at a tsconfig.

import {execFileSync} from 'node:child_process';
import {globSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// The root is overridable so a spec can point this check at a fixture tree;
// `pnpm check:dts` never sets it. Gated on `VITEST` too — Vitest sets it for
// every child process it spawns, a stray `CHECK_DTS_ROOT` left in a real
// shell cannot, so this override cannot silently soften the gate outside a
// test run just because the variable happens to be set.
const projectDir =
  process.env.VITEST && process.env.CHECK_DTS_ROOT
    ? path.resolve(process.env.CHECK_DTS_ROOT)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// `**`, not a flat `lib/*.d.ts`: a subdirectory in `src/` emits its
// declarations into `lib/<dir>/`, and a flat glob would drop exactly those
// from the check without a sound — the empty-set guard below stays quiet
// because the root of `lib/` still matches plenty.
const DTS_GLOB = 'lib/**/*.d.ts';
const dtsFiles = globSync(DTS_GLOB, {cwd: projectDir});

// The trap this gate exists to close, one step earlier: a `tsc` invocation
// asked to check zero files checks nothing, and nothing checked is not the
// same as nothing wrong. Handing `tsc` an empty file list does fail — under
// TypeScript 7.0.2 with `--ignoreConfig` it answers with its command-line
// help and exit 1 (measured) — but that failure is about argument shape and
// says not a word about `lib/`. `pnpm world` runs `clean` before `check`, so
// a missing `lib/` is not hypothetical: this script's own place in the chain
// (see `package.json`) keeps it out of that window, but a direct
// `pnpm check:dts` on a fresh checkout still has to name the reason.
if (dtsFiles.length === 0) {
  console.error(
    `[check-dts] no file matched \`${DTS_GLOB}\` — run \`pnpm compile\` first. ` +
      'Not one declaration was read, which is not the same as the ' +
      'declarations being correct.',
  );
  process.exit(1);
}

const tscBin = path.join(projectDir, 'node_modules', '.bin', 'tsc');

try {
  execFileSync(
    tscBin,
    [
      '--noEmit',
      '--ignoreConfig',
      '--skipLibCheck',
      'false',
      '--module',
      'nodenext',
      '--moduleResolution',
      'nodenext',
      '--target',
      'es2023',
      '--strict',
      '--strictNullChecks',
      'false',
      '--types',
      '',
      ...dtsFiles,
    ],
    {cwd: projectDir, stdio: 'inherit'},
  );
} catch (err) {
  // An exit status means `tsc` ran and already printed its own diagnostics to
  // `stdio: 'inherit'`; this only has to propagate the code, not add a second
  // message.
  if (typeof err.status === 'number' && err.status !== 0) {
    process.exit(err.status);
  }
  // Without one it never ran — a missing `node_modules/.bin/tsc` throws
  // `ENOENT` here with no `status` at all — so nothing has been printed and
  // the failure would be a bare exit 1. A gate whose whole purpose is to say
  // what it found says this much too.
  console.error(
    `[check-dts] \`${tscBin}\` produced no exit status: ${err.message}. ` +
      'The declarations were not checked — run `pnpm install` if the binary is missing.',
  );
  process.exit(1);
}
