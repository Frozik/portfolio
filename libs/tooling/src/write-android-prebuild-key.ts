#!/usr/bin/env node
// What `expo prebuild` makes an app's native project from, as one hash printed to stdout:
// `android-prebuild-key <app dir> [ENV_VARIABLE ...]`. The fingerprint covers the native
// modules, config plugins and dependencies; the variables are the ones the app's config reads,
// which the fingerprint does not see, so each edition of a build gets a key of its own.

import { createFingerprintAsync } from '@expo/fingerprint';

const [appDirectory, ...variables] = process.argv.slice(2);
if (appDirectory === undefined) {
  process.stderr.write('usage: android-prebuild-key <app dir> [ENV_VARIABLE ...]\n');
  process.exit(2);
}
const environment = Object.fromEntries(variables.map(name => [name, process.env[name] ?? null]));
const fingerprint = await createFingerprintAsync(appDirectory, {
  platforms: ['android'],
  silent: true,
  extraSources: [
    {
      type: 'contents',
      id: 'prebuild-environment',
      contents: JSON.stringify(environment),
      reasons: ['app config'],
    },
  ],
});
process.stdout.write(`${fingerprint.hash}\n`);
