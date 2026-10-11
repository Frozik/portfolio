import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import type { IWebDavFeatures } from '@frozik/cloud-storage/webdav/webdav-features';

import type { TCloudLocation } from '../cloud-files';
import type { IGoogleDriveAuth } from './google-drive';

/** What a WebDAV link needs besides its address; sealed in `device-config`. */
export interface IWebDavSecrets {
  readonly password: string;
  readonly features: IWebDavFeatures;
}

/** A vault's cloud, ready to sync: where it is, the storage, and for Drive the sign-in it needs. */
export interface ICloudConnection {
  readonly location: TCloudLocation;
  readonly storage: IStorageProvider;
  readonly googleAuth: IGoogleDriveAuth | null;
}

/** `null` when the location cannot be reached from what is known (WebDAV without its secrets). */
export type TConnectCloud = (
  location: TCloudLocation,
  secrets: IWebDavSecrets | null
) => ICloudConnection | null;
