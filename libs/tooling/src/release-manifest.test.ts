import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { IReleaseFloor } from './release-manifest.ts';
import { releaseManifestOf } from './release-manifest.ts';

const ZIP = 'https://example.org/vault-extension.zip';
const APK = { url: 'https://example.org/ciphra-vault.apk', sha256: 'ab'.repeat(32) };
const FLOOR_FILE = resolve(import.meta.dirname, '../../../apps/vault-web/release-floor.json');

describe('the release manifest', () => {
  it('names the release as every client’s latest and keeps each floor', () => {
    expect(
      releaseManifestOf({
        version: 'v1.4.0',
        floor: { web: 'v1.2.0', extension: 'v1.0.0', android: 'v1.1.0' },
        extensionZipUrl: ZIP,
        apk: APK,
      })
    ).toEqual({
      web: { latest: 'v1.4.0', minimum: 'v1.2.0' },
      extension: { latest: 'v1.4.0', minimum: 'v1.0.0', zipUrl: ZIP },
      android: { latest: 'v1.4.0', minimum: 'v1.1.0', apkUrl: APK.url, sha256: APK.sha256 },
    });
  });

  it('refuses a floor above the release, which would lock every user out', () => {
    expect(() =>
      releaseManifestOf({
        version: 'v1.4.0',
        floor: { web: 'v1.5.0', extension: 'v1.0.0', android: 'v1.0.0' },
        extensionZipUrl: ZIP,
        apk: APK,
      })
    ).toThrow('web');
  });

  it('refuses what is not a release version', () => {
    expect(() =>
      releaseManifestOf({
        version: 'main',
        floor: { web: 'v0.0.0', extension: 'v0.0.0', android: 'v0.0.0' },
        extensionZipUrl: ZIP,
        apk: APK,
      })
    ).toThrow('main');
  });

  it('reads the committed floor', () => {
    const floor = JSON.parse(readFileSync(FLOOR_FILE, 'utf8')) as IReleaseFloor;

    expect(() =>
      releaseManifestOf({ version: 'v999.0.0', floor, extensionZipUrl: ZIP, apk: APK })
    ).not.toThrow();
  });
});
