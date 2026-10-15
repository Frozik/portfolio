import { millisecondsToISO8601 } from '@frozik/utils/date/iso8601';
import type { TManifest } from '@frozik/vault/format/manifest';
import { CURRENT_SCHEMA_VERSION } from '@frozik/vault/format/manifest';

/** The manifest of a file this app writes first: a new vault, an encrypted export. */
export function newManifest(createdBy: string, now: number): TManifest {
  return {
    format: 'pwv',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: millisecondsToISO8601(now),
    createdBy,
  };
}
