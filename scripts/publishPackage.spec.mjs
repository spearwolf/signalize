import {decidePublish, resolveDistTag} from './publishPackage.cjs';

// No counter guards here: this file calls two pure functions over version
// strings and registry answers — it creates no signal, effect or link, and it
// spawns no `npm`.
describe('resolveDistTag()', () => {
  it('publishes a plain release under the `latest` tag', () => {
    expect(resolveDistTag('1.0.0')).toBe('latest');
  });

  it('carries build metadata without letting it change the tag', () => {
    expect(resolveDistTag('1.0.0+build.5')).toBe('latest');
  });

  it('skips a `-dev` version, the safety catch that predates the tags', () => {
    expect(resolveDistTag('1.0.0-dev')).toBe(null);
  });

  it('skips a numbered `-dev` version too', () => {
    expect(resolveDistTag('1.0.0-dev.3')).toBe(null);
  });

  it.each([
    ['1.1.0-alpha.0', 'alpha'],
    ['1.1.0-beta.1', 'beta'],
    ['2.0.0-rc.2', 'rc'],
    ['2.0.0-next.7', 'next'],
  ])('publishes %s under the `%s` tag', (version, tag) => {
    expect(resolveDistTag(version)).toBe(tag);
  });

  it('accepts a prerelease identifier without a counter', () => {
    expect(resolveDistTag('1.1.0-beta')).toBe('beta');
  });

  // The whole point of the allowlist. A typo must not reach `npm publish`:
  // without an identifier it knows, the alternative is a run that either
  // moves `latest` to a prerelease or invents a dist-tag nobody asked for.
  it('refuses a prerelease identifier that is not on the allowlist', () => {
    expect(() => resolveDistTag('1.1.0-btea.1')).toThrow(/btea/);
  });

  it('names the allowed identifiers when it refuses one', () => {
    expect(() => resolveDistTag('1.1.0-btea.1')).toThrow(
      /alpha, beta, rc, next/,
    );
  });

  it.each(['1.0', 'v1.0.0', '1.0.0.0', 'nightly', ''])(
    'refuses %o, which is not a semver version',
    (version) => {
      expect(() => resolveDistTag(version)).toThrow(/semver/);
    },
  );
});

// What `npm show <pkg> versions dist-tags --json` answers, in the two shapes
// it answers in: `versions` is an array, except for a package with exactly one
// published version, where npm hands back the bare string.
const registry = (versions, latest) => ({
  versions,
  distTags: latest == null ? {} : {latest},
});

describe('decidePublish()', () => {
  it('publishes a release that is newer than the current `latest`', () => {
    expect(
      decidePublish({version: '1.1.0', ...registry(['1.0.0'], '1.0.0')}),
    ).toEqual({publish: true, tag: 'latest'});
  });

  it('publishes the first version of a package that has no `latest` yet', () => {
    expect(decidePublish({version: '1.0.0', ...registry([])})).toEqual({
      publish: true,
      tag: 'latest',
    });
  });

  // The one the string comparison gets wrong: '0.9.0' > '0.10.0' as text.
  it('compares release numbers numerically, not as text', () => {
    expect(() =>
      decidePublish({version: '0.9.0', ...registry(['0.10.0'], '0.10.0')}),
    ).toThrow(/older/);
  });

  it('refuses a release that would move `latest` backwards', () => {
    expect(() =>
      decidePublish({version: '0.32.1', ...registry(['1.0.0'], '1.0.0')}),
    ).toThrow(/0\.32\.1/);
  });

  it('names the tag it protects when it refuses', () => {
    expect(() =>
      decidePublish({version: '0.32.1', ...registry(['1.0.0'], '1.0.0')}),
    ).toThrow(/latest/);
  });

  // A prerelease never touches `latest`, so the direction of its version
  // number is nobody's business — a `0.32.1-beta.1` fix on an old line is a
  // legitimate publish while `latest` sits at `1.0.0`.
  it('publishes a prerelease older than `latest` without complaint', () => {
    expect(
      decidePublish({
        version: '0.32.1-beta.1',
        ...registry(['1.0.0'], '1.0.0'),
      }),
    ).toEqual({publish: true, tag: 'beta'});
  });

  it('publishes the release that supersedes a prerelease sitting on `latest`', () => {
    expect(
      decidePublish({
        version: '1.0.0',
        ...registry(['1.0.0-rc.1'], '1.0.0-rc.1'),
      }),
    ).toEqual({publish: true, tag: 'latest'});
  });

  it('skips a version that is already released', () => {
    expect(
      decidePublish({
        version: '1.0.0',
        ...registry(['0.9.0', '1.0.0'], '1.0.0'),
      }),
    ).toEqual({publish: false, reason: 'already-released'});
  });

  it('skips a `-dev` version before it looks at the registry at all', () => {
    expect(decidePublish({version: '1.0.0-dev', ...registry([])})).toEqual({
      publish: false,
      reason: 'development',
    });
  });

  it('reads the single-version string shape npm answers with', () => {
    expect(
      decidePublish({version: '1.0.0', ...registry('1.0.0', '1.0.0')}),
    ).toEqual({publish: false, reason: 'already-released'});
  });

  // The substring trap in that shape: `'1.0.0-beta.10'.includes('1.0.0-beta.1')`
  // is true, and the release would be skipped as one that never happened.
  it('does not mistake a prefix of the single published version for that version', () => {
    expect(
      decidePublish({
        version: '1.0.0-beta.1',
        ...registry('1.0.0-beta.10', null),
      }),
    ).toEqual({publish: true, tag: 'beta'});
  });
});
