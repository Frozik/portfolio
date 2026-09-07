import { execFileSync } from 'node:child_process';

/** CI computes the release version before building and hands it over here. */
const VERSION_ENV = 'PORTFOLIO_VERSION';
/** What the build reports when it runs outside a git checkout. */
const UNKNOWN_VERSION = 'unknown';

/**
 * The version the build stamps the app with. CI passes the version the
 * release job is about to tag (`v1.4.0`), so the artifact built before the
 * tag already carries it. Locally it is `git describe`: the tag when the
 * commit carries one, otherwise the tag, the commits since it and the short
 * hash (`v1.4.0-3-g48ce7b1`). Tags are the only source of versions —
 * nothing is written back into the repository on release.
 */
export function readAppVersion(): string {
  const fromEnvironment = process.env[VERSION_ENV];
  if (fromEnvironment !== undefined && fromEnvironment.length > 0) {
    return fromEnvironment;
  }
  try {
    return execFileSync('git', ['describe', '--tags', '--always', '--dirty'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return UNKNOWN_VERSION;
  }
}
