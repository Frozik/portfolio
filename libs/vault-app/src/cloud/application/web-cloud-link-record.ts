import type { IVaultKeys } from '@frozik/vault/format/vault-keys';
import type { ISealedRecordStore, TVaultKey } from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';
import type { ISealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import { isNil, omit } from 'lodash-es';
import type { TCloudLink } from '../domain/cloud-link';
import { linkOfWebRecord } from '../domain/cloud-link-codec';
import { createCloudLinkRecord } from './cloud-link-record';

import type { TCloudLocation } from '../domain/cloud-files';
import type { IWebDavSecrets } from '../domain/ports/cloud';

export interface ICloudLinkRecord {
  readonly location: TCloudLocation;
  readonly webdav: IWebDavSecrets | null;
}

/** Secrets without probed features are none here: the web connects again and probes. */
function recordOf(link: TCloudLink): ICloudLinkRecord {
  if (link.kind === 'google-drive') {
    return { location: omit(link, 'account'), webdav: null };
  }
  const { secret } = link;
  return {
    location: omit(link, 'secret'),
    webdav:
      isNil(secret) || isNil(secret.features)
        ? null
        : { password: secret.password, features: secret.features },
  };
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
  const record = createCloudLinkRecord({ store, vaultKey, dek: keys.dek, random });
  return {
    save: value => record.save(linkOfWebRecord(value)),
    load: async () => {
      const link = await record.load();
      return isNil(link) ? null : recordOf(link);
    },
    clear: record.clear,
  };
}
