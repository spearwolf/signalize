#!/usr/bin/env node
// Rollup's `CIRCULAR_DEPENDENCY` is the only thing that ever looks at the
// layering of `src/`, and it sees a ring, not a direction. A value import
// that points sideways or upwards without closing one passes every gate:
// `tsc` is silent, the bundle builds, the tests are green. The bill arrives
// with whichever later edge completes the ring, and `pnpm bundle` then names
// that edge instead of the one that broke the order. So the direction gets
// its own gate here, in `pnpm check`.
//
// The ranks below are written down, not derived from the import graph. A
// rank computed from the edges would adopt every new edge as the truth and
// the guard could only ever pass.

import {globSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const srcDir = path.join(projectDir, 'src');

// The scope is the one `tsconfig.lib.json` compiles: everything that can end
// up in the bundle. Specs and test helpers may import in any direction —
// they carry no layering because they ship to nobody.
const SOURCE_GLOB = '**/*.ts';
const isOutOfScope = (file) =>
  file.endsWith('.spec.ts') || file.startsWith('__testing__/');

// Each entry is one layer, its index is its rank. A value import may only
// point at a strictly lower rank — sibling edges fall through too, which is
// what turns a new one into a decision instead of a habit.
const LAYERS = [
  {
    name: 'leaves',
    what: 'pull no value out of this package at all',
    modules: [
      'collect-errors',
      'constants',
      'effect-error-handlers',
      'effect-hook',
      'global-effect-stack',
      'global-queues',
      'thenable-guard',
      'types',
      'UniqIdGen',
    ],
  },
  {
    name: 'primitives',
    what: 'are built from leaves alone',
    modules: ['batch', 'be-quiet', 'Effect', 'instances'],
  },
  {
    name: 'core',
    what: 'hold the signal store, the error channel and the hibernate scope',
    modules: ['hibernate', 'signal-core', 'signalize-error'],
  },
  {
    name: 'lookups',
    what: 'read the core: object-to-signal lookup and the warn-once channel',
    modules: ['deprecation-warnings', 'object-signals'],
  },
  {
    name: 'groups',
    what: 'own group membership and the signal accessors',
    modules: ['SignalGroup', 'touch', 'value'],
  },
  {
    name: 'classes',
    what: 'are the three carrying implementations',
    modules: ['EffectImpl', 'Signal', 'SignalLink'],
  },
  {
    name: 'factories',
    what: 'create the things above and wire them together',
    modules: ['create-signal', 'effects', 'link'],
  },
  {
    name: 'composites',
    what: 'are assembled from the factories',
    modules: ['create-memo', 'decorators', 'SignalAutoMap'],
  },
  {
    name: 'entries',
    what: 'are the published entry points',
    modules: ['index'],
  },
];

const problems = [];
const violations = [];

const files = globSync(SOURCE_GLOB, {cwd: srcDir})
  .filter((file) => !isOutOfScope(file))
  .sort();

// A guard whose glob quietly matches nothing reports a clean tree forever.
if (files.length === 0) {
  problems.push(
    `no source file matched \`src/${SOURCE_GLOB}\` — the scan found nothing to check`,
  );
}

const moduleOf = (file) => file.replace(/\.ts$/, '');
const scope = new Set(files.map(moduleOf));

const rankOf = new Map();
for (const [rank, layer] of LAYERS.entries()) {
  for (const module of layer.modules) {
    if (rankOf.has(module)) {
      // The first entry keeps the module. A second one that overwrote it
      // would move every edge into and out of that module and bury the real
      // problem under a pile of invented violations.
      problems.push(
        `\`${module}\` is listed in two layers — \`${LAYERS[rankOf.get(module)].name}\` and \`${layer.name}\`; the second listing is ignored`,
      );
      continue;
    }
    rankOf.set(module, rank);
    if (!scope.has(module)) {
      problems.push(
        `layer \`${layer.name}\` lists \`${module}\`, which is not a source file — drop it from the table`,
      );
    }
  }
}
for (const module of scope) {
  if (!rankOf.has(module)) {
    problems.push(
      `\`src/${module}.ts\` sits in no layer — give it a rank in the table above, it decides what it may import`,
    );
  }
}

const named = (rank) => `rank ${rank} \`${LAYERS[rank].name}\``;

// Reads a file into the two views the scan needs. `code` has the comments
// removed — a `from "…"` inside a JSDoc sentence is not an import, and a
// commented-out one is not a live edge. `bare` additionally empties every
// string literal, keeping its quotes: the specifier of a real import
// survives as `from ''`, while an error message quoting the words `from
// './x.js'` does not. Only the statement counter reads `bare`, so the
// specifiers themselves stay intact in `code`.
function readViews(text) {
  let code = '';
  let bare = '';
  let i = 0;
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === '//') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (two === '/*') {
      i += 2;
      while (i < text.length && text.slice(i, i + 2) !== '*/') {
        // Newlines survive so the reported line numbers stay the file's own.
        if (text[i] === '\n') {
          code += '\n';
          bare += '\n';
        }
        i++;
      }
      i += 2;
      continue;
    }
    const char = text[i];
    if (char === "'" || char === '"' || char === '`') {
      code += char;
      bare += char;
      i++;
      while (i < text.length && text[i] !== char) {
        if (text[i] === '\\') {
          code += text.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (text[i] === '\n') bare += '\n';
        code += text[i];
        i++;
      }
      code += char;
      bare += char;
      i++;
      continue;
    }
    code += char;
    bare += char;
    i++;
  }
  return {code, bare};
}

// `import … from '…'` and `export … from '…'`, clause captured, statement
// terminator excluded so two of them on one line stay two.
const FROM_STATEMENT =
  /(?:^|\n)[ \t]*(?:import|export)\b([^;'"]*?)\bfrom\s*(['"])([^'"]+)\2/g;
// `import './x.js'` — no clause, so it is always a value edge.
const SIDE_EFFECT_IMPORT = /(?:^|\n)[ \t]*import\s*(['"])([^'"]+)\1/g;
// `import('./x.js')` — the module is loaded, so it is a value edge too.
const DYNAMIC_IMPORT = /\bimport\s*\(\s*(['"])([^'"]+)\1/g;
const FROM_OCCURRENCE = /\bfrom\s*['"]/g;

// `type` is a modifier only when something follows it. On its own it is an
// ordinary binding, and `{type as b}` renames that binding rather than
// marking anything — the one three-token shape that has to be read as a
// value. `{type as}` (two tokens, the binding `as` marked) and
// `{type as as as}` (the binding `as` marked and renamed) are type edges.
const hasTypeModifier = (text) =>
  /^type\s+\S/.test(text) && !/^type\s+as\s+\S+$/.test(text);

// True only when every binding the statement introduces is erased by tsc.
// `import {type A, b}`, a default or namespace clause next to a braced one,
// and `export * from` all stay value edges.
function isTypeOnly(clause) {
  const text = clause.trim();
  if (/^type\b/.test(text)) return hasTypeModifier(text);
  const braces = text.match(/\{([\s\S]*)\}/);
  if (braces == null) return false;
  const outside =
    text.slice(0, braces.index) + text.slice(braces.index + braces[0].length);
  if (outside.replace(/,/g, '').trim().length > 0) return false;
  const specifiers = braces[1]
    .split(',')
    .map((specifier) => specifier.trim())
    .filter((specifier) => specifier.length > 0);
  return specifiers.length > 0 && specifiers.every(hasTypeModifier);
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

for (const file of files) {
  const {code: source, bare} = readViews(
    readFileSync(path.join(srcDir, file), 'utf8'),
  );
  const from = rankOf.get(moduleOf(file));

  const edges = [];
  let statements = 0;

  for (const match of source.matchAll(FROM_STATEMENT)) {
    statements += 1;
    if (isTypeOnly(match[1])) continue;
    edges.push({specifier: match[3], index: match.index});
  }
  for (const match of source.matchAll(SIDE_EFFECT_IMPORT)) {
    edges.push({specifier: match[2], index: match.index});
  }
  for (const match of source.matchAll(DYNAMIC_IMPORT)) {
    edges.push({specifier: match[2], index: match.index});
  }

  // If the scanner read fewer statements than the file has module
  // specifiers, it met a form it does not know — which would show up as a
  // clean file rather than as an error.
  const occurrences = [...bare.matchAll(FROM_OCCURRENCE)].length;
  if (statements !== occurrences) {
    problems.push(
      `\`src/${file}\` has ${occurrences} module specifier(s) after \`from\`, but the scanner recognised ${statements} statement(s) — it does not understand a syntax used here`,
    );
  }

  for (const {specifier, index} of edges) {
    // Bare specifiers (`node:*`, `@spearwolf/eventize`) leave the package
    // and carry no rank.
    if (!specifier.startsWith('.')) continue;

    const line = lineAt(source, index) + (source[index] === '\n' ? 1 : 0);
    const target = path
      .relative(
        srcDir,
        path.resolve(path.dirname(path.join(srcDir, file)), specifier),
      )
      .replace(/\.js$/, '.ts');
    const to = moduleOf(target);

    if (!scope.has(to)) {
      problems.push(
        `\`src/${file}\` line ${line} imports \`${specifier}\`, which resolves to \`src/${target}\` — not a file this guard knows`,
      );
      continue;
    }
    if (from == null || !rankOf.has(to)) continue;

    if (rankOf.get(to) >= from) {
      violations.push({file, line, specifier, from, to: rankOf.get(to)});
    }
  }
}

if (problems.length > 0) {
  console.error(
    `[check-layering] ${problems.length} problem(s) with the layer table or the scan — the result cannot be trusted:`,
  );
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
}

if (violations.length > 0) {
  console.error(
    `[check-layering] ${violations.length} import edge(s) do not point downwards — a value import may only reach a strictly lower layer:`,
  );
  for (const {file, line, specifier, from, to} of violations) {
    console.error(
      `  src/${file}:${line} — \`${specifier}\`: ${named(from)} → ${named(to)}`,
    );
  }
  console.error('  the ladder, bottom first:');
  for (const [rank, layer] of LAYERS.entries()) {
    console.error(`    ${named(rank)} — modules that ${layer.what}`);
  }
}

if (problems.length > 0 || violations.length > 0) {
  process.exit(1);
}
