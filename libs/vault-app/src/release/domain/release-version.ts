import { isNil } from 'lodash-es';

export interface IReleaseVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** `v1.4.0`, `1.4.0`, or a build past a tag (`v1.4.0-3-g48ce7b1`), which counts as that release. */
const RELEASE_VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

/** `null` for a build that carries no release (`unknown`, a bare commit hash). */
export function parseReleaseVersion(text: string): IReleaseVersion | null {
  const match = RELEASE_VERSION.exec(text.trim());
  if (isNil(match)) {
    return null;
  }
  const [, major = '', minor = '', patch = ''] = match;
  return { major: Number(major), minor: Number(minor), patch: Number(patch) };
}

/** Negative when `left` is older, positive when newer, zero for the same release. */
export function compareReleaseVersions(left: IReleaseVersion, right: IReleaseVersion): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}
