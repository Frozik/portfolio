import type { TStorageResult } from '@frozik/cloud-storage/core/storage-error';
import type {
  IStorageObject,
  IStorageObjectStat,
  TWriteResult,
} from '@frozik/cloud-storage/core/storage-provider';
import type { TResult } from '@frozik/utils/result/result';

import type { IVaultKeys } from '../format/vault-keys';
import type { IVaultDocument } from '../model/vault-document';

/** What the codec reports of a file it opened, beside the document. */
export interface IOpenedHeader {
  readonly vaultId: string;
  readonly keyId: string;
  readonly revision: number;
  readonly keyslotsEpoch: number;
  readonly access: 'read-write' | 'read-only';
  readonly movedTo: string | null;
  /** SHA-256 of the file as read, hex. */
  readonly fileHash: string;
}

/** Why the shell could not open a file it read, in the engine's own terms (the shell translates the codec's). */
export type TOpenFailure =
  /** The file's header names another vault: the session's key was never tried on it. */
  | { readonly kind: 'foreign-vault' }
  | { readonly kind: 'aborted' }
  | { readonly kind: 'crashed' }
  /**
   * The file is under another key. `stale`: its authenticated key generation
   * is not past the session's, so it holds an earlier key;
   * `keyId` from the plaintext header is checked against the retired ones.
   */
  | { readonly kind: 'key-rotated'; readonly keyId: string | null; readonly stale: boolean }
  | { readonly kind: 'unreadable' };

/** What happened: requests from the session and the outcomes of effects, in past tense. */
export type TSyncEvent =
  | { readonly kind: 'push-requested' }
  | { readonly kind: 'pull-requested' }
  | { readonly kind: 'stat-done'; readonly result: TStorageResult<IStorageObjectStat | null> }
  | { readonly kind: 'read-done'; readonly result: TStorageResult<IStorageObject | null> }
  | {
      readonly kind: 'opened';
      readonly result: TResult<
        {
          readonly header: IOpenedHeader;
          readonly document: IVaultDocument;
          /** The file's slot set under the session's key: taken only once the engine accepts the file. */
          readonly keys: IVaultKeys;
        },
        TOpenFailure
      >;
    }
  | { readonly kind: 'merged'; readonly localHasNews: boolean }
  | {
      readonly kind: 'sealed';
      readonly file: Uint8Array<ArrayBuffer>;
      readonly fileHash: string;
      /** The slot set it was sealed with: once written, the target has shown it. */
      readonly keyslotsEpoch: number;
    }
  /** The codec could not seal: the session is ending (`aborted`), or its Worker died (`crashed`, retried). */
  | {
      readonly kind: 'seal-failed';
      readonly failure: Extract<TOpenFailure, { readonly kind: 'aborted' | 'crashed' }>;
    }
  | { readonly kind: 'write-done'; readonly result: TStorageResult<TWriteResult> }
  | { readonly kind: 'retry-due'; readonly attempt: number }
  | { readonly kind: 'online' };
