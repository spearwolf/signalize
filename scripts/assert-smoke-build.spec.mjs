import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptPath = fileURLToPath(
  new URL('./assert-smoke-build.mjs', import.meta.url),
);

function run(dir) {
  return spawnSync(process.execPath, [scriptPath], {
    env: {...process.env, ASSERT_SMOKE_BUILD_ROOT: dir},
    encoding: 'utf8',
  });
}

// No counter guards here: this file spawns a script against a fixture tree
// on disk — it creates no signal, effect or link.
describe('assert-smoke-build.mjs', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'assert-smoke-build-'));
  });

  afterEach(() => {
    rmSync(dir, {recursive: true, force: true});
  });

  it('exits 0 when smoke/build carries a *.test.js', () => {
    const buildDir = path.join(dir, 'smoke', 'build');
    mkdirSync(buildDir, {recursive: true});
    writeFileSync(path.join(buildDir, 'dist-smoke.test.js'), '');

    const result = run(dir);

    expect(result.status).toBe(0);
  });

  it('exits 1 when smoke/build is empty', () => {
    mkdirSync(path.join(dir, 'smoke', 'build'), {recursive: true});

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('smoke/build/*.test.js');
  });

  it('exits 1 when the compiled file was renamed off the *.test.js convention', () => {
    const buildDir = path.join(dir, 'smoke', 'build');
    mkdirSync(buildDir, {recursive: true});
    writeFileSync(path.join(buildDir, 'dist-smoke.js'), '');

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('smoke/build/*.test.js');
  });
});
