#!/usr/bin/env node
// The `versionCode` of a release's APK, printed to stdout: `android-version-code <version>`.

import { androidVersionCode } from './android-version-code.ts';

const [version] = process.argv.slice(2);
if (version === undefined) {
  process.stderr.write('usage: android-version-code <version>\n');
  process.exit(2);
}
process.stdout.write(`${androidVersionCode(version)}\n`);
