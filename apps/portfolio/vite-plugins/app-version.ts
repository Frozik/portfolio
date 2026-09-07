import { execFileSync } from 'node:child_process';

/** What the build reports when it runs outside a git checkout. */
const UNKNOWN_VERSION = 'unknown';

/**
 * The version the build stamps the app with: the release tag when the
 * commit carries one (`v1.4.0`), otherwise the tag, the commits since it
 * and the short hash (`v1.4.0-3-g48ce7b1`), or just the hash before the first
 * release. Tags are the only source of versions — nothing is written back
 * into the repository on release.
 */
export function readAppVersion(): string {
  try {
    return execFileSync('git', ['describe', '--tags', '--always', '--dirty'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return UNKNOWN_VERSION;
  }
}
