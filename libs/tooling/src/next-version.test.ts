import { describe, expect, it } from 'vitest';

import { nextVersion, versionOfTag } from './next-version.ts';

describe('nextVersion', () => {
  it('bumps the part the release type names', () => {
    expect(nextVersion('2.1.0', 'patch')).toBe('2.1.1');
    expect(nextVersion('2.1.0', 'minor')).toBe('2.2.0');
    expect(nextVersion('2.1.0', 'major')).toBe('3.0.0');
  });

  it('yields nothing when the commits release nothing', () => {
    expect(nextVersion('2.1.0', null)).toBeUndefined();
  });

  it('refuses a tag that is not a version', () => {
    expect(() => nextVersion('latest', 'patch')).toThrow(/not a semantic version/);
  });

  it('reads the version out of the release tag', () => {
    expect(versionOfTag('v2.1.0')).toBe('2.1.0');
  });
});
