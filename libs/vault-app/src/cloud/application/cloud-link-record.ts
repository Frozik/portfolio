import type { ISealedRecordStore, TPersisted, TVaultKey } from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';
import { createSealedJsonRecord } from '@frozik/vault/session/sealed-json-record';

import { DEVICE_CONFIG_LABEL } from '@frozik/vault/session/device-record-labels';
import type { IDecodedCloudLink } from '../domain/cloud-link-codec';
import { decodeCloudLink, encodeCloudLink } from '../domain/cloud-link-codec';
import type { ICloudLinkStore } from '../domain/ports/cloud-link-store';

const CLOUD_LINK_RECORD = 'cloud-link';

/**
 * Where the vault lives, sealed with its key: before the unlock this device
 * shows only the vault's name, never the cloud, the address or the login. A
 * record an older client wrote is read, then written again as version 2.
 */
export function createCloudLinkRecord({
  store,
  vaultKey,
  dek,
  random,
}: {
  readonly store: ISealedRecordStore;
  readonly vaultKey: TVaultKey;
  readonly dek: CryptoKey;
  readonly random: IRandom;
}): ICloudLinkStore {
  const sealed = createSealedJsonRecord<IDecodedCloudLink>({
    store,
    vaultKey,
    recordKey: CLOUD_LINK_RECORD,
    dek,
    label: DEVICE_CONFIG_LABEL,
    random,
    decode: decodeCloudLink,
    encode: ({ link }) => encodeCloudLink(link),
  });
  return {
    save: link => sealed.save({ link, legacy: false }),
    async load() {
      const decoded = await sealed.load();
      if (decoded?.legacy === true) {
        await sealed.save({ link: decoded.link, legacy: false });
      }
      return decoded?.link ?? null;
    },
    clear: sealed.clear,
  };
}

/** Forgetting needs no key: the sealed record just goes. */
export function forgetCloudLink(store: ISealedRecordStore, vaultKey: TVaultKey): TPersisted<void> {
  return store.delete(vaultKey, CLOUD_LINK_RECORD);
}
