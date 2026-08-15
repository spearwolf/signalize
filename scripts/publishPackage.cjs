#!/usr/bin/env node

const {execFile} = require('node:child_process');
const process = require('node:process');

const pkgJson = require('../package.json');

/*
 * The official semver grammar, verbatim from semver.org, with the prerelease
 * and build parts captured. Anything this does not match never reaches
 * `npm publish` — a version npm would reject, or silently reinterpret, costs
 * a release either way.
 */
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

/*
 * Prerelease identifiers that map to a dist-tag of the same name, and the one
 * that means "do not publish at all". The list is closed on purpose: an
 * identifier nobody planned for is a typo, and both ways of guessing at it are
 * worse than stopping. Publishing it untagged moves `latest` to a prerelease,
 * which every plain `npm install` then picks up; publishing it under its own
 * name creates a dist-tag that will outlive the mistake.
 */
const DIST_TAGS = ['alpha', 'beta', 'rc', 'next'];
const SKIP_IDENTIFIER = 'dev';

function parseVersion(version) {
  const match = SEMVER.exec(version);

  if (match == null) {
    throw new Error(`version "${version}" is not a semver version`);
  }

  return {
    release: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4],
  };
}

/**
 * Orders two versions by their release numbers alone, prerelease and build
 * metadata ignored. That is all this script needs: only a version heading for
 * `latest` is ever compared, and against a `latest` that a prerelease can only
 * lose to.
 *
 * @returns {number} negative when `a` precedes `b`, 0 when both name the same
 *   release, positive when `a` follows `b`
 */
function compareReleases(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return 0;
}

/**
 * Decides which npm dist-tag a version belongs under.
 *
 * @param {string} version the `version` field of `package.json`
 * @returns {string|null} the dist-tag to publish under, or `null` when the
 *   version is marked as a development version and must not be published
 * @throws when the version is not semver, or carries a prerelease identifier
 *   that has no dist-tag assigned to it
 */
function resolveDistTag(version) {
  const {prerelease} = parseVersion(version);

  if (prerelease == null) {
    return 'latest';
  }

  const identifier = prerelease.split('.')[0];

  if (identifier === SKIP_IDENTIFIER) {
    return null;
  }

  if (!DIST_TAGS.includes(identifier)) {
    throw new Error(
      `version "${version}" carries the unknown prerelease identifier "${identifier}" — ` +
        `expected one of: ${DIST_TAGS.join(', ')} (or "${SKIP_IDENTIFIER}" to skip publishing)`,
    );
  }

  return identifier;
}

/**
 * Decides what to do with the version in `package.json`, given what the
 * registry already holds. Pure — it is the whole decision, and it makes no
 * network call of its own.
 *
 * @param {object} input
 * @param {string} input.version the `version` field of `package.json`
 * @param {string[]|string} input.versions every published version, in the two
 *   shapes `npm show … versions --json` answers in: an array, or the bare
 *   string of the only published version
 * @param {object} input.distTags the registry's `dist-tags` map
 * @returns {{publish: true, tag: string}|{publish: false, reason: string}}
 * @throws when the version cannot be published as it stands
 */
function decidePublish({version, versions, distTags}) {
  const tag = resolveDistTag(version);

  if (tag == null) {
    return {publish: false, reason: 'development'};
  }

  /*
   * npm drops the array for a package with exactly one published version and
   * answers with that version as a string. Left alone, the membership test
   * below would be a substring test on it — `1.0.0-beta.10` would swallow the
   * release of `1.0.0-beta.1` and report it as one that already happened.
   */
  const published = Array.isArray(versions)
    ? versions
    : versions == null
      ? []
      : [versions];

  if (published.includes(version)) {
    return {publish: false, reason: 'already-released'};
  }

  /*
   * A prerelease is exempt: it publishes under its own tag and leaves `latest`
   * untouched, so an `0.32.1-beta.1` on an old line is a legitimate publish
   * while `latest` sits at `1.0.0`. Only a version heading for `latest` itself
   * has to prove it is not walking the tag backwards — which is what a patch
   * on a superseded line would silently do, handing every plain
   * `npm install` the older library.
   */
  const currentLatest = distTags?.latest;

  if (tag === 'latest' && currentLatest != null) {
    const candidate = parseVersion(version).release;
    const current = parseVersion(currentLatest).release;

    if (compareReleases(candidate, current) < 0) {
      throw new Error(
        `version "${version}" is older than the current "latest" (${currentLatest}) — ` +
          'publishing it would move that tag backwards. Release it under a prerelease ' +
          'identifier, or move the tag by hand once the publish is done',
      );
    }
  }

  return {publish: true, tag};
}

/*
 * `npm` is passed as a bare command name and resolved without a shell.
 * The only automated caller is the deploy job in
 * .github/workflows/main.yml, which runs on ubuntu-latest, where `npm` is
 * a real executable on PATH. On Windows it is an `npm.cmd` shim that a
 * shell-less spawn does not resolve; a run there would need
 * `process.platform === 'win32' ? 'npm.cmd' : 'npm'` — not `shell: true`,
 * which would put the shell straight back.
 *
 * `--tag` is always passed, including for `latest`. npm's default is the same
 * value, so this changes nothing about a normal release — it only takes the
 * decision away from the default.
 */
function publishPackage(distTag) {
  execFile(
    'npm',
    ['publish', '--access', 'public', '--tag', distTag],
    (error, stdout, stderr) => {
      console.error(stderr);
      console.log(stdout);
      process.exitCode = error ? 1 : 0;
    },
  );
}

const SKIP_MESSAGES = {
  development: 'is marked as a *development* version',
  'already-released': 'is already released',
};

function main() {
  /*
   * Everything the version alone decides is decided before the registry is
   * asked. A development version is the common case on `main` and has no
   * business making a network call, and a version this script would refuse
   * should say so without one either.
   */
  let earlyTag;

  try {
    earlyTag = resolveDistTag(pkgJson.version);
  } catch (error) {
    console.error('skip publishing,', error.message);
    process.exitCode = 1;
    return;
  }

  if (earlyTag == null) {
    console.log(
      'skip publishing, version',
      pkgJson.version,
      SKIP_MESSAGES.development,
    );
    return;
  }

  execFile(
    'npm',
    ['show', pkgJson.name, 'versions', 'dist-tags', '--json'],
    (error, stdout, stderr) => {
      if (error) {
        console.error(`execFile() panic: ${stderr}`);
        process.exitCode = 1;
        return;
      }

      const shown = JSON.parse(stdout);
      let decision;

      try {
        decision = decidePublish({
          version: pkgJson.version,
          versions: shown.versions,
          distTags: shown['dist-tags'],
        });
      } catch (decisionError) {
        console.error('skip publishing,', decisionError.message);
        process.exitCode = 1;
        return;
      }

      if (!decision.publish) {
        console.log(
          'skip publishing, version',
          pkgJson.version,
          SKIP_MESSAGES[decision.reason],
        );
        return;
      }

      console.log(
        'publishing version',
        pkgJson.version,
        'under the dist-tag',
        decision.tag,
      );
      publishPackage(decision.tag);
    },
  );
}

module.exports = {decidePublish, resolveDistTag};

if (require.main === module) {
  main();
}
