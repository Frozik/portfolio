import semver from 'semver';

export type ReleaseType = 'major' | 'minor' | 'patch';

/** `v2.1.0` → `2.1.0`; the tag format `v${version}` of `semantic-release.json`. */
export function versionOfTag(tag: string): string {
  return tag.replace(/^v/, '');
}

/** The version a release of `releaseType` would create; nothing when no release is due. */
export function nextVersion(
  lastVersion: string,
  releaseType: ReleaseType | null
): string | undefined {
  if (releaseType === null) {
    return undefined;
  }
  const bumped = semver.inc(lastVersion, releaseType);
  if (bumped === null) {
    throw new Error(`nextVersion: "${lastVersion}" is not a semantic version`);
  }
  return bumped;
}
