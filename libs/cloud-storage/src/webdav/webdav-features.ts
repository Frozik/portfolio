import type { IStorageCapabilities } from '../core/storage-provider';

/** What the probe found the server honours; kept in the vault registry with the account. */
export interface IWebDavFeatures {
  /** `If-Match` / `If-None-Match: *` answered with 412: the server does the compare-and-swap. */
  readonly conditionalRequests: boolean;
  /** `MOVE` refuses with `Overwrite: F` and replaces with `Overwrite: T`: a write never leaves half a file. */
  readonly moveReplace: boolean;
  readonly revisionKind: 'etag' | 'last-modified';
}

export function webDavCapabilitiesOf(features: IWebDavFeatures): IStorageCapabilities {
  return {
    conditionalWrite: features.conditionalRequests ? 'atomic' : 'check-then-write',
    revisionKind: features.revisionKind,
    pinnedRead: features.conditionalRequests,
    revisions: false,
    maxSimpleUploadBytes: Number.MAX_SAFE_INTEGER,
    authRenewal: 'none',
    cors: 'server-configured',
    appScopedFolder: false,
  };
}
