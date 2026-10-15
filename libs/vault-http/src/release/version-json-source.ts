import type { IVersionSource } from '@frozik/vault-app/release/domain/ports/version-source';
import { parseVersionManifest } from '@frozik/vault-app/release/domain/version-manifest';

/** The published `version.json`, past every cache: a floor raised for a security fix must be seen at once. */
export function createVersionJsonSource(url: string): IVersionSource {
  return {
    async read() {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        return response.ok ? parseVersionManifest(await response.json()) : null;
      } catch {
        return null;
      }
    },
  };
}
