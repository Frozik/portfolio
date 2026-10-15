#!/usr/bin/env node
import { readFileSync } from 'node:fs';
// The `version.json` a vault release publishes, printed to stdout.
//
//   release-manifest <version> <extension zip url> <apk url> <apk sha256> [floor file]
//
// The floor file defaults to `apps/vault-web/release-floor.json`; a floor
// above the version fails the release instead of locking every user out.

import type { IReleaseFloor } from './release-manifest.ts';
import { releaseManifestOf } from './release-manifest.ts';

const DEFAULT_FLOOR = 'apps/vault-web/release-floor.json';

const [version, extensionZipUrl, apkUrl, apkSha256, floorFile = DEFAULT_FLOOR] =
  process.argv.slice(2);
if (
  version === undefined ||
  extensionZipUrl === undefined ||
  apkUrl === undefined ||
  apkSha256 === undefined
) {
  process.stderr.write(
    'usage: release-manifest <version> <extension zip url> <apk url> <apk sha256> [floor file]\n'
  );
  process.exit(2);
}
const floor = JSON.parse(readFileSync(floorFile, 'utf8')) as IReleaseFloor;
process.stdout.write(
  `${JSON.stringify(
    releaseManifestOf({
      version,
      floor,
      extensionZipUrl,
      apk: { url: apkUrl, sha256: apkSha256 },
    }),
    null,
    2
  )}\n`
);
