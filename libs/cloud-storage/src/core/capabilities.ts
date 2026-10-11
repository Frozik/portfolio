import type { IStorageCapabilities } from './storage-provider';

/** A store on this device: a real compare-and-swap, revisions from a counter, nothing to authorize. */
export const LOCAL_CAPABILITIES: IStorageCapabilities = {
  conditionalWrite: 'atomic',
  revisionKind: 'rev',
  pinnedRead: true,
  revisions: false,
  maxSimpleUploadBytes: Number.MAX_SAFE_INTEGER,
  authRenewal: 'none',
  cors: 'open',
  appScopedFolder: false,
};
