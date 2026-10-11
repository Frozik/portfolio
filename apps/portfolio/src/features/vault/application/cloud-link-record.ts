import type { IVaultKeys } from '@frozik/vault/format/vault-keys';
import type { ISealedRecordStore, TVaultKey } from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';
import type { ISealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import { createSealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import { z } from 'zod';

import type { TCloudLocation } from '../domain/cloud-files';
import type { IWebDavSecrets } from '../domain/ports/cloud';

/** The device record a vault's cloud is sealed in: where it lives and, for WebDAV, the app password. */
const CLOUD_LINK_RECORD = 'cloud-link';

export interface ICloudLinkRecord {
  readonly location: TCloudLocation;
  readonly webdav: IWebDavSecrets | null;
}

const CLOUD_LINK_SCHEMA = z.object({
  location: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('google-drive'),
      space: z.enum(['my-drive', 'app-data']),
      path: z.string(),
    }),
    z.object({
      kind: z.literal('webdav'),
      url: z.string(),
      username: z.string(),
      path: z.string(),
    }),
  ]),
  webdav: z
    .object({
      password: z.string().min(1),
      features: z.object({
        conditionalRequests: z.boolean(),
        moveReplace: z.boolean(),
        revisionKind: z.enum(['etag', 'last-modified']),
      }),
    })
    .nullable(),
});

/** A record this version cannot read is no link: the settings offer to connect again. */
function decodeCloudLink(value: unknown): ICloudLinkRecord | null {
  const parsed = CLOUD_LINK_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Where the vault lives, sealed with its key: before the unlock this device
 * shows only the vault's name, never the cloud, the address or the login.
 */
export function cloudLinkRecord(
  store: ISealedRecordStore,
  { vaultKey, keys }: { readonly vaultKey: TVaultKey; readonly keys: IVaultKeys },
  random: IRandom
): ISealedJsonRecord<ICloudLinkRecord> {
  return createSealedJsonRecord({
    store,
    vaultKey,
    recordKey: CLOUD_LINK_RECORD,
    dek: keys.dek,
    label: 'pwv/device-config',
    random,
    decode: decodeCloudLink,
  });
}
