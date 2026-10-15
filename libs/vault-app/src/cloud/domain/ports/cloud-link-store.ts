import type { ISealedJsonRecord } from '@frozik/vault/session/sealed-json-record';

import type { TCloudLink } from '../cloud-link';

/** One vault's cloud link on this device, sealed with the vault's key. */
export type ICloudLinkStore = ISealedJsonRecord<TCloudLink>;
