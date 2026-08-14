import {spawnSync} from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptPath = fileURLToPath(new URL('./check-dts.mjs', import.meta.url));
const repoDir = fileURLToPath(new URL('..', import.meta.url));

// Two things a fixture tree needs beyond its declarations. The guard spawns
// `<root>/node_modules/.bin/tsc`, so the tree gets a symlink to the repo's
// own `node_modules` — a copy would move gigabytes for a run that reads three
// files. And `--module nodenext` asks the nearest `package.json` what module
// kind a declaration is in; the real `lib/` sits under an ESM manifest, so the
// fixture carries one too.
function makeTree(dir, files, {withTsc = true} = {}) {
  writeFileSync(path.join(dir, 'package.json'), '{"type": "module"}\n');
  if (withTsc) {
    symlinkSync(
      path.join(repoDir, 'node_modules'),
      path.join(dir, 'node_modules'),
    );
  }
  for (const [file, text] of Object.entries(files)) {
    const full = path.join(dir, file);
    mkdirSync(path.dirname(full), {recursive: true});
    writeFileSync(full, text);
  }
}

function run(dir) {
  return spawnSync(process.execPath, [scriptPath], {
    env: {...process.env, CHECK_DTS_ROOT: dir},
    encoding: 'utf8',
  });
}

// No counter guards here: this file spawns a script against a fixture tree
// on disk — it creates no signal, effect or link.
describe('check-dts.mjs', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'check-dts-'));
  });

  afterEach(() => {
    rmSync(dir, {recursive: true, force: true});
  });

  it('exits 0 on a `lib/` whose declarations agree with each other', () => {
    makeTree(dir, {
      'lib/a.d.ts': 'export declare const a: number;\n',
      'lib/b.d.ts':
        "import type {a} from './a.js';\nexport declare const x: typeof a;\n",
    });

    const result = run(dir);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('names the TypeScript error when one declaration imports what another does not declare', () => {
    makeTree(dir, {
      'lib/a.d.ts': 'export declare const a: number;\n',
      'lib/b.d.ts':
        "import type {b} from './a.js';\nexport declare const x: b;\n",
    });

    const result = run(dir);

    // `tsc` exits 2 on diagnostics and prints them through the inherited
    // stdio; the guard propagates that code rather than flattening it to 1.
    expect(result.status).toBe(2);
    expect(result.stdout).toContain('lib/b.d.ts');
    expect(result.stdout).toContain('TS2305');
  });

  it('reads a declaration in a subdirectory of `lib/`', () => {
    makeTree(dir, {
      'lib/a.d.ts': 'export declare const a: number;\n',
      'lib/sub/b.d.ts':
        "import type {b} from '../a.js';\nexport declare const x: b;\n",
    });

    const result = run(dir);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('lib/sub/b.d.ts');
    expect(result.stdout).toContain('TS2305');
  });

  it('exits 1 and names the glob when `lib/` does not exist', () => {
    makeTree(dir, {});

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no file matched');
    expect(result.stderr).toContain('lib/**/*.d.ts');
  });

  it('exits 1 and names the glob when `lib/` exists but holds no declaration', () => {
    makeTree(dir, {'lib/README.md': 'not a declaration\n'});

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no file matched');
    expect(result.stderr).toContain('lib/**/*.d.ts');
  });

  it('names the binary when `tsc` cannot be spawned at all', () => {
    makeTree(
      dir,
      {'lib/a.d.ts': 'export declare const a: number;\n'},
      {withTsc: false},
    );

    const result = run(dir);

    // No `status` comes back from a failed spawn, so nothing printed the
    // diagnostics `tsc` would have printed — the guard has to.
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(path.join('node_modules', '.bin', 'tsc'));
    expect(result.stderr).toContain('produced no exit status');
  });
});
