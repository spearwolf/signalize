import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

// No counter guards here: this file creates no signal, effect or
// link — it reads the sources of `src/` as text. There is nothing for
// `assertEffectsCount` / `assertSignalsCount` / `assertLinksCount` to watch.
// Same shape as `index.public-surface.spec.ts`.
//
// Text, not an AST, for the same reason that file gives: TypeScript 7 ships
// no JS compiler API any more (`transpileModule` is gone) and no standalone
// parser is resolvable in this tree.
//
// The rule this file holds: **every message this library authors begins with
// `[signalize] `** — thrown, rejected, reported through
// `reportSignalizeError()`, or written straight to the console. It is
// deliberately not a hand-kept list of messages. A list goes stale the moment
// someone adds a `throw`; a scanner over the sources does not.
//
// What a scanner *can* do instead is go quiet. A regex that stops matching
// iterates over nothing and passes without a word — the same failure mode
// `assertThresholdGlobsMatch()` in `vitest.config.ts` exists for.
// Five things stand against that here, and they matter more than the prefix
// check itself:
//
//   (b) an occurrence the scanner cannot read is a **failure**, never a skip;
//   (c) an error class the scanner does not know, thrown or rejected, fails;
//   (d) each scan has a floor, and the four scans together have one too — the
//       per-scan floors catch one blinded regex, the total catches several
//       bleeding out at once;
//   (e) the file list is recursive, so a new subdirectory cannot take its
//       messages out of the check by existing;
//   (f) `console` is named in exactly two files, so scan D cannot be dodged by
//       aliasing the global instead of spelling out the member access.
//
// (f) has a second half that does not live here: `suspicious/noConsole` in
// `biome.json` is switched on for `src/**/*.ts` with those same two files as
// its only exception. That is what makes `console['warn'](x)` and
// `console?.warn(x)` — spellings no member-access regex would catch — fail at
// `pnpm check`. Measured: the rule does *not* see `const {warn} = console`, so
// the two halves are complementary, not redundant.

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

const PREFIX = '[signalize] ';

/** The error constructors this library builds messages with. */
const ERROR_CONSTRUCTORS = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'AggregateError',
  'SyntaxError',
  'EvalError',
  'ReferenceError',
  'URIError',
]);

/**
 * One floor per scan, each **one below what that scan finds today** (A 26,
 * B 10, C 3, D 2). That is the whole rule, and it is a compromise between two
 * failure modes:
 *
 * - Set to the current count, the numbers become a second inventory: deleting
 *   a single legitimate call site turns the suite red with nothing but a
 *   count to explain it.
 * - Set generously below it, they stop catching what they exist for. Measured
 *   during review: with B at 8 against 10 actual findings, two messages could
 *   be moved out of the scanner's view and the floor still passed.
 *
 * One step of slack absorbs the ordinary edit — a removed `throw`, a
 * deprecation that reaches its removal — while a scan that has gone blind
 * lands at or near zero and is caught. A floor is never an equality, and it
 * is never the thing that catches a *dropped prefix*: (a) and (b) do that.
 */
const MINIMUM_FINDINGS = {A: 25, B: 9, C: 2, D: 1};

/**
 * And one floor over all four together, one below the current total of 41.
 *
 * The per-scan floors each grant a step of slack, so three scans can each give
 * up one finding and every individual floor still holds — measured during
 * review with three silent bypasses at once (an aliased reporter import, an
 * aliased gate import, a destructured `console`). The sum is what refuses
 * that: slack is affordable once, not simultaneously across the file.
 */
const MINIMUM_FINDINGS_TOTAL = 40;

/**
 * The only two files allowed to name `console` (f). Everything else reports
 * through `reportSignalizeError()`, whose fallback *is* these two. Held twice:
 * here, against aliasing, and by `suspicious/noConsole` in `biome.json`, which
 * carries the same two names and fails `pnpm check` on a member access.
 */
const CONSOLE_ALLOWED = new Set(['signalize-error.ts', 'EffectImpl.ts']);

/**
 * `deprecation-warnings.ts` passes its `message` parameter straight through
 * to `reportSignalizeError()`, so that one occurrence is an identifier with
 * no module-wide constant behind it and cannot be classified. It is exempt
 * **by file name**, because scan C already checks the literal text at all
 * three call sites that feed it. A second pass-through anywhere else stays
 * under rule (b) and fails.
 */
const PASSTHROUGH_EXEMPT = new Set(['deprecation-warnings.ts']);

type Scan = 'A' | 'B' | 'C' | 'D';

type Occurrence = {
  file: string;
  line: number;
  scan: Scan;
  expression: string;
  text?: string;
  /**
   * `false` for a console write whose first argument is plainly not a message
   * — `console.error(err)` logs a value, and demanding a prefix from it would
   * mean the rule forbids a legitimate line (see `record`'s `lenient` flag).
   */
  carriesMessage?: boolean;
};

/**
 * Index just past the literal starting at `start`, or -1. Handles escapes and
 * — for a template literal — `${…}` interpolations, whose contents may hold
 * quotes and braces of their own.
 */
function endOfLiteral(src: string, start: number): number {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    if (quote === '`' && ch === '$' && src[i + 1] === '{') {
      const end = balancedEnd(src, i + 1);
      if (end < 0) return -1;
      i = end + 1;
      continue;
    }
    i++;
  }
  return -1;
}

/**
 * Index of the bracket closing the one at `start`, or -1. Skips comments and
 * literals, so a `)` inside a message never ends an argument list.
 */
function balancedEnd(src: string, start: number): number {
  const closing: Record<string, string> = {'(': ')', '{': '}', '[': ']'};
  const stack: string[] = [];
  let i = start;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      if (nl < 0) return -1;
      i = nl + 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) return -1;
      i = end + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const end = endOfLiteral(src, i);
      if (end < 0) return -1;
      i = end;
      continue;
    }
    if (closing[ch] != null) {
      stack.push(closing[ch]);
      i++;
      continue;
    }
    if (ch === stack.at(-1)) {
      stack.pop();
      i++;
      if (stack.length === 0) return i - 1;
      continue;
    }
    i++;
  }
  return -1;
}

/**
 * The source with every comment and every literal blanked to spaces, offsets
 * and line breaks preserved. The locator regexes run against this, the text
 * they point at is sliced out of the original — so prose in a JSDoc block
 * that happens to spell `throw new Error(` is not mistaken for code.
 */
function maskCommentsAndLiterals(src: string): string {
  const out = src.split('');
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < out.length; k++) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      const end = nl < 0 ? src.length : nl;
      blank(i, end);
      i = end;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      const end = close < 0 ? src.length : close + 2;
      blank(i, end);
      i = end;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const literalEnd = endOfLiteral(src, i);
      const end = literalEnd < 0 ? src.length : literalEnd;
      blank(i, end);
      i = end;
      continue;
    }
    i++;
  }
  return out.join('');
}

/**
 * Top-level comma-separated ranges inside `[from, to)`. Bracket depth is
 * counted on the mask (where no literal can lie about it), but whether the
 * trailing range is empty is decided on the original text — on the mask a
 * plain `new Error('…')` is all spaces, and dropping it as blank is exactly
 * how this scanner loses nine of its findings.
 */
function splitTopLevel(
  src: string,
  mask: string,
  from: number,
  to: number,
): [number, number][] {
  const parts: [number, number][] = [];
  let depth = 0;
  let start = from;
  for (let i = from; i < to; i++) {
    const ch = mask[i];
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push([start, i]);
      start = i + 1;
    }
  }
  if (src.slice(start, to).trim().length > 0) parts.push([start, to]);
  return parts;
}

const lineOf = (src: string, index: number): number =>
  src.slice(0, index).split('\n').length;

/**
 * The leading literal text of an expression, or `undefined` when it does not
 * start with one. A template literal contributes everything up to its first
 * interpolation — enough for a prefix, which is what the rule is about.
 */
function leadingLiteralText(expression: string): string | undefined {
  const expr = expression.trim();
  const quote = expr[0];
  if (quote !== "'" && quote !== '"' && quote !== '`') return undefined;
  let out = '';
  let i = 1;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === '\\') {
      out += ch === '\\' && expr[i + 1] === 'n' ? '\n' : expr[i + 1];
      i += 2;
      continue;
    }
    if (ch === quote) break;
    if (quote === '`' && ch === '$' && expr[i + 1] === '{') break;
    out += ch;
    i++;
  }
  return out;
}

/**
 * Module-wide `const NAME = '…'` bindings, so a message routed through a
 * constant is read rather than skipped. Without this step `SHARED_EMPTY_WRITE`
 * and `CYCLE_REJECTED` alone hide six of the twelve throw sites in
 * `SignalGroup.ts`.
 */
function collectStringConstants(src: string): Map<string, string> {
  const constants = new Map<string, string>();
  const pattern =
    /^const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*\n?\s*(['"`])([\s\S]*?)\2\s*;/gm;
  for (const match of src.matchAll(pattern)) {
    constants.set(match[1], match[3]);
  }
  return constants;
}

/** The `message` property of an object literal, by masked-source offsets. */
function messagePropertyOf(
  src: string,
  mask: string,
  braceStart: number,
): string | undefined {
  const braceEnd = balancedEnd(mask, braceStart);
  if (braceEnd < 0) return undefined;
  for (const [from, to] of splitTopLevel(src, mask, braceStart + 1, braceEnd)) {
    const property = mask.slice(from, to);
    const colon = property.indexOf(':');
    const key = (colon < 0 ? property : property.slice(0, colon)).trim();
    if (key !== 'message') continue;
    // A shorthand `{message}` has no colon — hand back the identifier, which
    // is exactly what it is, and let classification decide.
    return colon < 0 ? key : src.slice(from + colon + 1, to);
  }
  return undefined;
}

function scanFile(file: string, src: string): Occurrence[] {
  const mask = maskCommentsAndLiterals(src);
  const constants = collectStringConstants(src);
  const found: Occurrence[] = [];

  /**
   * `lenient` is scan D only, and it is a deliberate hole with a fence around
   * it. `console.error(err)` logs a value, not a message; read strictly it is
   * unclassifiable and fails under (b), which would make a legitimate line
   * impossible to write. So an argument that is neither a literal nor a
   * module-wide string constant is recorded as *not a message* instead.
   *
   * The price, stated plainly: at a console site, a message held in a variable
   * goes unchecked. What keeps that from being a way out is (f) plus
   * `suspicious/noConsole` — only two files may name `console` at all, so the
   * exposure is two files, both of which this scan still counts. Every other
   * scan stays strict.
   */
  const record = (scan: Scan, at: number, expression = '', lenient = false) => {
    const expr = expression.trim();
    const literal = leadingLiteralText(expr);
    const text =
      literal ??
      (/^[A-Za-z_$][\w$]*$/.test(expr) ? constants.get(expr) : undefined);
    found.push({
      file,
      line: lineOf(src, at),
      scan,
      expression: expr,
      text,
      carriesMessage: text != null || !lenient,
    });
  };

  const argumentsAt = (parenIndex: number): string[] => {
    const end = balancedEnd(mask, parenIndex);
    if (end < 0) return [];
    return splitTopLevel(src, mask, parenIndex + 1, end).map(([from, to]) =>
      src.slice(from, to),
    );
  };

  // Scan A — every construction of a known error class.
  for (const match of mask.matchAll(/\bnew\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!ERROR_CONSTRUCTORS.has(match[1])) continue;
    const parenIndex = match.index + match[0].length - 1;
    const args = argumentsAt(parenIndex);
    // `AggregateError(errors, message)` carries its message second.
    const message = args[match[1] === 'AggregateError' ? 1 : 0];
    record('A', match.index, message);
  }

  // Scan B — every diagnostic payload. `reportSignalizeError()` is anchored on
  // the *call*, not on the object literal behind it: an argument that is not a
  // literal — an untyped variable built two lines earlier — is recorded as an
  // unreadable occurrence and fails under (b), rather than being invisible.
  // Measured during review: anchored on `reportSignalizeError({` alone, two
  // messages could be moved into untyped variables, lose their prefix, and
  // leave the suite green. The second anchor covers the annotated literal
  // `instances.ts` builds and hands to a *foreign* copy's reporter instead of
  // calling the local one.
  for (const match of mask.matchAll(/\breportSignalizeError\s*\(/g)) {
    const parenIndex = match.index + match[0].length - 1;
    const first = argumentsAt(parenIndex)[0]?.trim() ?? '';
    record(
      'B',
      match.index,
      first.startsWith('{')
        ? messagePropertyOf(src, mask, src.indexOf('{', parenIndex))
        : first,
    );
  }
  for (const match of mask.matchAll(/:\s*SignalizeErrorPayload\s*=\s*\{/g)) {
    const braceStart = match.index + match[0].length - 1;
    record('B', match.index, messagePropertyOf(src, mask, braceStart));
  }

  // Scan C — the once-per-process deprecation gate, whose message is its
  // second argument.
  for (const match of mask.matchAll(/\bwarnDeprecatedOnce\s*\(/g)) {
    const parenIndex = match.index + match[0].length - 1;
    record('C', match.index, argumentsAt(parenIndex)[1]);
  }

  // Scan D — messages written straight to the console. Two exist
  // (`signalize-error.ts`, `EffectImpl.ts`), both for a handler that threw on
  // the very channel the diagnostic would otherwise take, so reporting them
  // through that channel would recurse. They are messages this library
  // authors like any other, and the rule covers "reported" explicitly.
  for (const match of mask.matchAll(
    /\bconsole\s*\.\s*(?:error|warn|log|info|debug|trace)\s*\(/g,
  )) {
    const parenIndex = match.index + match[0].length - 1;
    record('D', match.index, argumentsAt(parenIndex)[0], true);
  }

  return found;
}

/**
 * Error classes scan A does not know, in any position that carries a message
 * to a caller. Three forms, because one regex would miss two of them:
 *
 * - `throw new X` — the plain case;
 * - `reject(new X` — a rejection is a throw with a different exit, and this
 *   library rejects with `Error` out of `nextValue()`/`asyncValues()`;
 * - `new SomethingError(` anywhere — an error class of our own, constructed
 *   into a variable first and thrown or rejected somewhere else entirely.
 */
function scanUnknownErrorClasses(file: string, src: string): string[] {
  const mask = maskCommentsAndLiterals(src);
  const offenders = new Map<number, string>();
  const patterns: [RegExp, string][] = [
    [/\bthrow\s+new\s+([A-Za-z_$][\w$.]*)/g, 'thrown'],
    [/\breject\s*\(\s*new\s+([A-Za-z_$][\w$.]*)/g, 'rejected'],
    [/\bnew\s+([A-Za-z_$][\w$.]*Error)\s*\(/g, 'constructed'],
  ];
  for (const [pattern, position] of patterns) {
    for (const match of mask.matchAll(pattern)) {
      if (ERROR_CONSTRUCTORS.has(match[1])) continue;
      offenders.set(
        match.index,
        `${file}:${lineOf(src, match.index)} — ${position} new ${match[1]}(`,
      );
    }
  }
  return [...offenders.values()];
}

/** Bare references to `console` in a file that is not allowed to have one. */
function scanConsoleReferences(file: string, src: string): string[] {
  if (CONSOLE_ALLOWED.has(file)) return [];
  const mask = maskCommentsAndLiterals(src);
  return [...mask.matchAll(/\bconsole\b/g)].map(
    (match) => `${file}:${lineOf(src, match.index)}`,
  );
}

/**
 * Every non-spec source, **recursively**. `__testing__/` is the one exclusion
 * and it is named rather than implied: it is test-only support code that
 * `tsconfig.lib.json` excludes from `lib/` outright, so nothing in it is a
 * message this library ships. A listing that stopped at the top level would
 * let the first new subdirectory carry its messages out of this check without
 * anything turning red — verified during review against an `src/internal/`.
 */
const sourceFiles = readdirSync(SRC_DIR, {recursive: true})
  .map(String)
  .map((name) => name.split('\\').join('/'))
  .filter(
    (name) =>
      name.endsWith('.ts') &&
      !name.endsWith('.spec.ts') &&
      !name.endsWith('.test.ts') &&
      !name.startsWith('__testing__/'),
  )
  .sort();

const sources = new Map(
  sourceFiles.map((name) => [
    name,
    readFileSync(join(SRC_DIR, name), 'utf-8') as string,
  ]),
);

const occurrences = [...sources].flatMap(([file, src]) => scanFile(file, src));

const at = (o: Occurrence) => `${o.file}:${o.line}`;

describe('every message this library authors is prefixed', () => {
  it('reads sources at all — the directory listing is not empty', () => {
    // A `readdirSync` pointed at the wrong place would make every assertion
    // below vacuous.
    expect(sourceFiles.length).toBeGreaterThanOrEqual(25);
    expect(sourceFiles).toContain('SignalGroup.ts');
  });

  it('finds at least as many occurrences as each scan is known to have', () => {
    const counts = {
      A: occurrences.filter((o) => o.scan === 'A').length,
      B: occurrences.filter((o) => o.scan === 'B').length,
      C: occurrences.filter((o) => o.scan === 'C').length,
      D: occurrences.filter((o) => o.scan === 'D').length,
    };
    // A scan that suddenly finds less has stopped seeing the code; it has not
    // been tidied up.
    expect(counts.A, 'error constructions').toBeGreaterThanOrEqual(
      MINIMUM_FINDINGS.A,
    );
    expect(counts.B, 'diagnostic payloads').toBeGreaterThanOrEqual(
      MINIMUM_FINDINGS.B,
    );
    expect(counts.C, 'deprecation notices').toBeGreaterThanOrEqual(
      MINIMUM_FINDINGS.C,
    );
    expect(counts.D, 'direct console writes').toBeGreaterThanOrEqual(
      MINIMUM_FINDINGS.D,
    );
    // The per-scan floors each carry one step of slack; spend it in three
    // scans at once and every one of them still passes. This is the line that
    // does not.
    expect(occurrences.length, 'all scans together').toBeGreaterThanOrEqual(
      MINIMUM_FINDINGS_TOTAL,
    );
  });

  it('can read every occurrence it found', () => {
    const unreadable = occurrences
      .filter(
        (o) =>
          o.text == null && o.carriesMessage && !PASSTHROUGH_EXEMPT.has(o.file),
      )
      .map((o) => `${at(o)} [${o.scan}] ${o.expression.slice(0, 70)}`);

    expect(
      unreadable,
      'a message the scanner cannot classify is a failure, not a skip — teach it the form or route the text through a module-wide const',
    ).toEqual([]);
  });

  it('throws and rejects only error classes the scanner knows', () => {
    const offenders = [...sources].flatMap(([file, src]) =>
      scanUnknownErrorClasses(file, src),
    );

    expect(
      offenders,
      'an error class of our own would slip past scan A unseen — add it to ERROR_CONSTRUCTORS',
    ).toEqual([]);
  });

  it('names `console` in two files and nowhere else', () => {
    const offenders = [...sources].flatMap(([file, src]) =>
      scanConsoleReferences(file, src),
    );

    expect(
      offenders,
      'aliasing the global (`const {warn} = console`) is the one console form `suspicious/noConsole` does not see — report through `reportSignalizeError()` instead',
    ).toEqual([]);
  });

  it('prefixes every message it read', () => {
    const violations = occurrences
      .filter((o) => o.text != null && !o.text.startsWith(PREFIX))
      .map((o) => `${at(o)} [${o.scan}] ${o.text.slice(0, 70)}`);

    expect(violations, `every message must begin with "${PREFIX}"`).toEqual([]);
  });
});
