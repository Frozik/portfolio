import semver from 'semver';

/** The oldest release of each client still allowed to open a vault; raised by hand for a security fix. */
export interface IReleaseFloor {
  readonly web: string;
  readonly extension: string;
  readonly android: string;
}

export interface IReleaseManifest {
  readonly web: { readonly latest: string; readonly minimum: string };
  readonly extension: {
    readonly latest: string;
    readonly minimum: string;
    readonly zipUrl: string;
  };
  readonly android: {
    readonly latest: string;
    readonly minimum: string;
    readonly apkUrl: string;
    readonly sha256: string;
  };
}

function parsed(version: string, what: string): string {
  const valid = semver.valid(semver.clean(version));
  if (valid === null) {
    throw new Error(`${what} is not a release version: "${version}"`);
  }
  return valid;
}

/**
 * `version.json` for one release: every client's channel gets this release as
 * the latest and its floor as the minimum. A floor above the release being
 * published would lock every user out, so it refuses one.
 */
export function releaseManifestOf({
  version,
  floor,
  extensionZipUrl,
  apk,
}: {
  readonly version: string;
  readonly floor: IReleaseFloor;
  readonly extensionZipUrl: string;
  /** The signed APK as published with the release, and its SHA-256 a user may check. */
  readonly apk: { readonly url: string; readonly sha256: string };
}): IReleaseManifest {
  const latest = parsed(version, 'The release');
  for (const [client, minimum] of Object.entries(floor)) {
    if (semver.gt(parsed(minimum, `The ${client} floor`), latest)) {
      throw new Error(`The ${client} floor ${minimum} is above the release ${version}`);
    }
  }
  return {
    web: { latest: `v${latest}`, minimum: floor.web },
    extension: { latest: `v${latest}`, minimum: floor.extension, zipUrl: extensionZipUrl },
    android: { latest: `v${latest}`, minimum: floor.android, apkUrl: apk.url, sha256: apk.sha256 },
  };
}
