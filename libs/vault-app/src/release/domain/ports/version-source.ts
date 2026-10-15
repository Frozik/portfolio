import type { TVersionManifest } from '../version-manifest';

/** Where the client reads the published `version.json`; `null` offline or when it cannot be read. */
export interface IVersionSource {
  read(): Promise<TVersionManifest | null>;
}
