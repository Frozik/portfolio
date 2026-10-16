/**
 * The version for an extension manifest, which takes only dotted integers, out of the app version
 * the build is stamped with (`v1.4.0`, or `v1.4.0-3-g48ce7b1` locally); nothing when it has none.
 */
export function manifestVersionOf(appVersion: string | undefined): string | undefined {
  return /^v?(\d+\.\d+\.\d+)/.exec(appVersion ?? '')?.[1];
}
