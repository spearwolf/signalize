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

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const DOC_GLOBS = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'CONTRIBUTING.md',
  'docs/**/*.md',
  'skills/**/*.md',
];

const REF_PATTERN =
  /\b[A-Za-z0-9_./-]+\.(?:ts|tsx|js|mjs|cjs|json|md|yml|yaml):\d+\b/g;

const files = globSync(DOC_GLOBS, {cwd: projectDir});

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
