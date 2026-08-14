import {spawnSync} from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptPath = fileURLToPath(
  new URL('./check-layering.mjs', import.meta.url),
);
const srcDir = fileURLToPath(new URL('../src', import.meta.url));

// The ladder in the guard names every module of `src/`, so a fixture
// holding only the file under test would be reported as a broken table
// rather than as a clean scan. The tree is therefore a copy of the real
// `src/`, with the line under test appended to `constants.ts` — rank 0,
// which makes any value edge out of it a violation.
function makeTree(dir, tail = '') {
  cpSync(srcDir, path.join(dir, 'src'), {recursive: true});
  if (tail !== '') {
    appendFileSync(path.join(dir, 'src', 'constants.ts'), tail);
  }
}

function run(dir) {
  return spawnSync(process.execPath, [scriptPath], {
    env: {...process.env, CHECK_LAYERING_ROOT: dir},
    encoding: 'utf8',
  });
}

// No counter guards here: this file spawns a script against a fixture tree
// on disk — it creates no signal, effect or link.
describe('check-layering.mjs', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'check-layering-'));
  });

  afterEach(() => {
    rmSync(dir, {recursive: true, force: true});
  });

  it('exits 0 on the tree as it stands', () => {
    makeTree(dir);

    const result = run(dir);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('exits 1 and names the rank hop for a value import pointing up', () => {
    makeTree(dir, "\nimport {createSignal} from './create-signal.js';\n");

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/constants.ts');
    expect(result.stderr).toContain('rank 0 `leaves` → rank 6 `factories`');
  });

  it('reads no edge out of a multi-line template literal quoting an import', () => {
    makeTree(
      dir,
      "\nexport const HINT = `\n  a leaf module may not write:\n  import {createSignal} from './create-signal.js'\n`;\n",
    );

    const result = run(dir);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('reads no edge out of a single-line template literal on an export line', () => {
    makeTree(
      dir,
      "\nexport const HINT = `never write import {createSignal} from './create-signal.js' here`;\n",
    );

    const result = run(dir);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('reads a dynamic import out of a template literal interpolation', () => {
    makeTree(
      dir,
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the fixture is the file content the guard reads, not a template of its own — the `${` is what the test is about
      "\nexport const DYNAMIC = `${import('./create-signal.js')}`;\n",
    );

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/constants.ts');
    expect(result.stderr).toContain('rank 0 `leaves` → rank 6 `factories`');
  });

  it('reads no edge out of a nested template literal inside an interpolation', () => {
    makeTree(
      dir,
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the fixture is the file content the guard reads, not a template of its own — the `${` is what the test is about
      "\nexport const NESTED = `outer ${`inner\nimport {createSignal} from './create-signal.js'\n`} tail`;\n",
    );

    const result = run(dir);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it("reports the real import's own line, not a line inside the template literal above it", () => {
    const original = readFileSync(path.join(srcDir, 'constants.ts'), 'utf8');
    const importLine = "import {createSignal} from './create-signal.js';";
    const tail = `\nexport const HINT = \`\n  line one\n  line two\n  line three\n\`;\n${importLine}\n`;
    makeTree(dir, tail);

    // Computed from the fixture's own text instead of hard-coded: the line
    // depends on how long the real `constants.ts` happens to be, which this
    // spec has no reason to pin.
    const content = original + tail;
    const expectedLine = content
      .slice(0, content.lastIndexOf(importLine))
      .split('\n').length;

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`src/constants.ts:${expectedLine} —`);
  });
});
