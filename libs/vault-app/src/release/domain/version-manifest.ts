import { z } from 'zod';

const RELEASE_CHANNEL = z.object({ latest: z.string(), minimum: z.string() });

const VERSION_MANIFEST = z.object({
  web: RELEASE_CHANNEL.optional(),
  extension: RELEASE_CHANNEL.extend({ zipUrl: z.string() }).optional(),
  android: RELEASE_CHANNEL.extend({ apkUrl: z.string(), sha256: z.string() }).optional(),
});

/** The newest release of a client, and the oldest one still allowed to open a vault. */
export type TReleaseChannel = Readonly<z.infer<typeof RELEASE_CHANNEL>>;

/** `version.json`, published with every release: one channel per client. */
export type TVersionManifest = Readonly<z.infer<typeof VERSION_MANIFEST>>;

export type TReleaseClient = keyof TVersionManifest;

/** `null` for anything that is not a manifest: a broken file never blocks the vault. */
export function parseVersionManifest(json: unknown): TVersionManifest | null {
  const parsed = VERSION_MANIFEST.safeParse(json);
  return parsed.success ? parsed.data : null;
}
