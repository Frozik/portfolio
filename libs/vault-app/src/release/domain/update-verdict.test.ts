import { updateVerdict } from './update-verdict';
import { parseVersionManifest } from './version-manifest';

const CHANNEL = { latest: 'v1.5.0', minimum: 'v1.2.0' };

describe('the update verdict', () => {
  it('asks a build below the floor to update before it opens a vault', () => {
    expect(updateVerdict('v1.1.9', CHANNEL)).toBe('required');
  });

  it('offers a newer release to a build at or above the floor', () => {
    expect(updateVerdict('v1.2.0', CHANNEL)).toBe('available');
    expect(updateVerdict('1.4.10', CHANNEL)).toBe('available');
  });

  it('leaves the newest release alone, and a build past its tag counts as that release', () => {
    expect(updateVerdict('v1.5.0', CHANNEL)).toBe('current');
    expect(updateVerdict('v1.5.0-3-g48ce7b1-dirty', CHANNEL)).toBe('current');
    expect(updateVerdict('v1.1.9-7-gabcdef0', CHANNEL)).toBe('required');
  });

  it('compares numbers, not text', () => {
    expect(updateVerdict('v1.10.0', { latest: 'v1.9.0', minimum: 'v1.9.0' })).toBe('current');
  });

  it('never pushes a build that carries no release, or a channel it cannot read', () => {
    expect(updateVerdict('unknown', CHANNEL)).toBe('current');
    expect(updateVerdict('48ce7b1', CHANNEL)).toBe('current');
    expect(updateVerdict('v1.0.0', undefined)).toBe('current');
    expect(updateVerdict('v1.0.0', { latest: 'soon', minimum: 'later' })).toBe('current');
  });
});

describe('the version manifest', () => {
  it('reads each client’s channel', () => {
    expect(
      parseVersionManifest({
        web: CHANNEL,
        android: { ...CHANNEL, apkUrl: 'https://example.org/a.apk', sha256: 'ab' },
      })
    ).toEqual({
      web: CHANNEL,
      android: { ...CHANNEL, apkUrl: 'https://example.org/a.apk', sha256: 'ab' },
    });
  });

  it('refuses anything else, so a broken file never blocks the vault', () => {
    expect(parseVersionManifest('<html>')).toBeNull();
    expect(parseVersionManifest({ web: { latest: 1 } })).toBeNull();
  });
});
