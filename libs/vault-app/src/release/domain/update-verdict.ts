import { isNil } from 'lodash-es';

import { compareReleaseVersions, parseReleaseVersion } from './release-version';
import type { TReleaseChannel } from './version-manifest';

/** `required`: this build is below the security floor and may not open a vault. */
export type TUpdateVerdict = 'current' | 'available' | 'required';

/**
 * Where a running build stands against its channel. A build that carries no
 * release (a local one) and a channel that is absent or unreadable are never
 * pushed: only a version the release published can be below its floor.
 */
export function updateVerdict(
  current: string,
  channel: TReleaseChannel | undefined
): TUpdateVerdict {
  const running = parseReleaseVersion(current);
  if (isNil(running) || isNil(channel)) {
    return 'current';
  }
  const minimum = parseReleaseVersion(channel.minimum);
  if (!isNil(minimum) && compareReleaseVersions(running, minimum) < 0) {
    return 'required';
  }
  const latest = parseReleaseVersion(channel.latest);
  return !isNil(latest) && compareReleaseVersions(running, latest) < 0 ? 'available' : 'current';
}
