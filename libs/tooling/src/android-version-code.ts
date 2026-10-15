import semver from 'semver';

const MAJOR_STEP = 1_000_000;
const MINOR_STEP = 1_000;
/** Google Play's largest `versionCode`; sideloaded APKs keep to it all the same. */
const VERSION_CODE_CEILING = 2_100_000_000;

/**
 * Android's `versionCode` of a release: `major·10⁶ + minor·10³ + patch`, so
 * every later release installs over an earlier one. A minor or patch past 999
 * would collide with the next field, so it is refused.
 */
export function androidVersionCode(version: string): number {
  const parsed = semver.parse(semver.clean(version));
  if (parsed === null) {
    throw new Error(`Not a release version: "${version}"`);
  }
  if (parsed.minor >= MINOR_STEP || parsed.patch >= MINOR_STEP) {
    throw new Error(`${version}: minor and patch must stay below ${MINOR_STEP}`);
  }
  const code = parsed.major * MAJOR_STEP + parsed.minor * MINOR_STEP + parsed.patch;
  if (code < 1 || code > VERSION_CODE_CEILING) {
    throw new Error(`${version} gives the versionCode ${code}, outside 1…${VERSION_CODE_CEILING}`);
  }
  return code;
}
