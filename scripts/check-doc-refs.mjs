#!/usr/bin/env node
// A `datei:zeile` reference in prose has a short half-life in this repo (see
// AGENTS.md's module-layering section, whose own EffectImpl.ts reference
// drifted twice before anyone touched it) and nothing here re-derives it. So
// it is banned outright in the docs that describe current behaviour; a symbol
// name doesn't go stale the same way. remediation-plan.md and CHANGELOG.md
// are history and stay exempt — they are allowed to point at where a line
// was, not where it is.

import {globSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// The root is overridable so the spec can point this scan at a fixture
// tree; `pnpm check:refs` never sets it. Gated on `VITEST` too — Vitest sets
// it for every child process it spawns, a stray `CHECK_DOC_REFS_ROOT` left
// in a real shell cannot, so this override cannot silently soften the gate
// outside a test run just because the variable happens to be set.
const projectDir =
  process.env.VITEST && process.env.CHECK_DOC_REFS_ROOT
    ? path.resolve(process.env.CHECK_DOC_REFS_ROOT)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DOC_GLOBS = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'CONTRIBUTING.md',
  'docs/**/*.md',
  'skills/**/*.md',
];

// Named again here, independent of how DOC_GLOBS is spelled: these four
// are what the prose rules of this repo stand on, and a later rewrite of
// the glob list must not be able to drop one without a word.
const REQUIRED_DOCS = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'CONTRIBUTING.md',
];

const REF_PATTERN =
  /\b[A-Za-z0-9_./-]+\.(?:ts|tsx|js|mjs|cjs|json|md|yml|yaml):\d+\b/g;

const files = globSync(DOC_GLOBS, {cwd: projectDir});

const matched = new Set(files);
const deadGlobs = DOC_GLOBS.filter(
  (glob) => globSync(glob, {cwd: projectDir}).length === 0,
);
const missingDocs = REQUIRED_DOCS.filter((doc) => !matched.has(doc));

if (deadGlobs.length > 0 || missingDocs.length > 0) {
  console.error(
    '[check-doc-refs] the document scan has nothing to stand on — a gate whose globs miss reads no line and still exits 0:',
  );
  for (const glob of deadGlobs) {
    console.error(`  \`${glob}\` matches no file — renamed, moved or emptied`);
  }
  for (const doc of missingDocs) {
    console.error(
      `  \`${doc}\` is not among the ${files.length} matched document(s) — this gate is written for a tree that has it`,
    );
  }
  console.error(`  globs are matched relative to \`${projectDir}\`.`);
  process.exit(1);
}

const hits = [];

for (const file of files) {
  const text = readFileSync(path.join(projectDir, file), 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const match of line.matchAll(REF_PATTERN)) {
      hits.push({file, line: i + 1, match: match[0]});
    }
  });
}

if (hits.length > 0) {
  console.error(
    `[check-doc-refs] ${hits.length} datei:zeile reference(s) found in prose docs — line numbers rot, symbol names don't:`,
  );
  for (const {file, line, match} of hits) {
    console.error(`  ${file}:${line} — \`${match}\``);
  }
  process.exit(1);
}
