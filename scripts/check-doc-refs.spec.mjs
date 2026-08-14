import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptPath = fileURLToPath(
  new URL('./check-doc-refs.mjs', import.meta.url),
);

function makeTree(dir, {skip = [], docText = 'nothing to see here'} = {}) {
  const files = {
    'AGENTS.md': docText,
    'CLAUDE.md': docText,
    'README.md': docText,
    'CONTRIBUTING.md': docText,
    'docs/quickstart.md': docText,
    'skills/using-x/SKILL.md': docText,
  };
  for (const [file, text] of Object.entries(files)) {
    if (skip.includes(file)) continue;
    const full = path.join(dir, file);
    mkdirSync(path.dirname(full), {recursive: true});
    writeFileSync(full, text);
  }
}

function run(dir) {
  return spawnSync(process.execPath, [scriptPath], {
    env: {...process.env, CHECK_DOC_REFS_ROOT: dir},
    encoding: 'utf8',
  });
}

// No counter guards here: this file spawns a script against a fixture tree
// on disk — it creates no signal, effect or link.
describe('check-doc-refs.mjs', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'check-doc-refs-'));
  });

  afterEach(() => {
    rmSync(dir, {recursive: true, force: true});
  });

  it('exits 0 when every glob matches and no prose carries a line reference', () => {
    makeTree(dir);

    const result = run(dir);

    expect(result.status).toBe(0);
  });

  it('exits 1 and names file, line and reference when a doc carries `create-signal.ts:42`', () => {
    makeTree(dir, {docText: 'nothing to see here\nsee create-signal.ts:42\n'});

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('docs/quickstart.md');
    expect(result.stderr).toContain('create-signal.ts:42');
  });

  it('exits 1 and names the glob when the skills directory is gone', () => {
    makeTree(dir, {skip: ['skills/using-x/SKILL.md']});

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('skills/**/*.md');
  });

  it('exits 1 and names the document when CONTRIBUTING.md is missing', () => {
    makeTree(dir, {skip: ['CONTRIBUTING.md']});

    const result = run(dir);

    expect(result.status).toBe(1);
    // `CONTRIBUTING.md` is also a literal DOC_GLOBS entry, so the dead-glob
    // line alone would print the filename without the REQUIRED_DOCS check
    // ever running — `is not among the` only appears in the latter.
    expect(result.stderr).toContain('is not among the');
    expect(result.stderr).toContain('CONTRIBUTING.md');
  });
});
