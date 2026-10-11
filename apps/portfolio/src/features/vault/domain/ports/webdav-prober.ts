import type { IStorageObjectStat } from '@frozik/cloud-storage/core/storage-provider';
import type { IWebDavFeatures } from '@frozik/cloud-storage/webdav/webdav-features';
import type { TWebDavProbeFailure } from '@frozik/cloud-storage/webdav/webdav-probe';
import type { IWebDavAccount } from '@frozik/cloud-storage/webdav/webdav-transport';
import type { TResult } from '@frozik/utils/result/result';

/** What "Check" found: what the server honours, and the vaults already in the folder. */
export interface IWebDavReach {
  readonly features: IWebDavFeatures;
  readonly vaults: readonly IStorageObjectStat[];
}

/** "Check": what the server at an address honours, before anything is stored there. */
export type TProbeWebDav = (
  account: IWebDavAccount,
  signal: AbortSignal
) => Promise<TResult<IWebDavReach, TWebDavProbeFailure>>;
