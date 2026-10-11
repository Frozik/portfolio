import type { Milliseconds } from '@frozik/utils/date/types';
import type { Brand } from '@frozik/utils/types/base';

import type { TStorageResult } from './storage-error';

export type TStoragePath = Brand<string, 'StoragePath'>;

export type TStorageRev = Brand<string, 'StorageRev'>;

export type TStorageKind = 'memory' | 'indexeddb' | 'google-drive' | 'webdav';

export type TWritePrecondition =
  | { readonly kind: 'absent' }
  | { readonly kind: 'match'; readonly rev: TStorageRev }
  | { readonly kind: 'overwrite' };

export interface IStorageCapabilities {
  readonly conditionalWrite: 'atomic' | 'check-then-write';
  readonly revisionKind: 'rev' | 'etag' | 'last-modified' | 'content-hash';
  readonly pinnedRead: boolean;
  readonly revisions: boolean;
  readonly maxSimpleUploadBytes: number;
  readonly authRenewal: 'none' | 'refresh-token' | 'gesture' | 'daily-reauth';
  readonly cors: 'open' | 'server-configured';
  readonly appScopedFolder: boolean;
}

export interface IStorageObjectStat {
  readonly path: TStoragePath;
  readonly rev: TStorageRev;
  readonly size: number;
  readonly modifiedAt: Milliseconds;
}

export interface IStorageObject {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly stat: IStorageObjectStat;
}

export type TWriteResult =
  | { readonly kind: 'ok'; readonly stat: IStorageObjectStat }
  | { readonly kind: 'conflict'; readonly current: IStorageObjectStat | null };

export type TRemoveResult =
  | { readonly kind: 'removed' }
  | { readonly kind: 'conflict'; readonly current: IStorageObjectStat | null };

export interface IStorageProvider {
  readonly kind: TStorageKind;
  readonly capabilities: IStorageCapabilities;
  stat(path: TStoragePath, signal: AbortSignal): Promise<TStorageResult<IStorageObjectStat | null>>;
  read(path: TStoragePath, signal: AbortSignal): Promise<TStorageResult<IStorageObject | null>>;
  write(
    path: TStoragePath,
    bytes: Uint8Array<ArrayBuffer>,
    precondition: TWritePrecondition,
    signal: AbortSignal
  ): Promise<TStorageResult<TWriteResult>>;
  remove(
    path: TStoragePath,
    precondition: TWritePrecondition,
    signal: AbortSignal
  ): Promise<TStorageResult<TRemoveResult>>;
  list(
    directory: TStoragePath,
    signal: AbortSignal
  ): Promise<TStorageResult<readonly IStorageObjectStat[]>>;
  revisions?(
    path: TStoragePath,
    signal: AbortSignal
  ): Promise<TStorageResult<readonly IStorageObjectStat[]>>;
}
