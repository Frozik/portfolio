import { execFileSync } from 'node:child_process';

import { isNil } from 'lodash-es';

/** What the build reports when it runs outside a git checkout. */
const UNKNOWN_VERSION = 'unknown';
const RELEASE_TAGS = 'v*';

/**
 * The version the build stamps the app with. CI passes the version the
 * release job is about to tag (`v1.4.0`) in `versionEnv`, so the artifact
 * built before the tag already carries it. Locally it is `git describe`: the
 * tag when the commit carries one, otherwise the tag, the commits since it and
 * the short hash (`v1.4.0-3-g48ce7b1`). Tags are the only source of versions —
 * nothing is written back into the repository on release. Only `v*` tags are
 * releases: `calls-filter-latest` moves to each new APK and must not be read as one.
 */
export function readAppVersion(versionEnv: string): string {
  const fromEnvironment = process.env[versionEnv];
  if (!isNil(fromEnvironment) && fromEnvironment.length > 0) {
    return fromEnvironment;
  }
  try {
    return execFileSync(
      'git',
      ['describe', '--tags', '--match', RELEASE_TAGS, '--always', '--dirty'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    ).trim();
  } catch {
    return UNKNOWN_VERSION;
  }
}
