import type { TResult } from '@frozik/utils/result/result';
import type { IImportBatch } from '@frozik/vault/import/imported-card';
import type { TKdbxError } from '@frozik/vault/import/kdbx/read-kdbx';

/** A KeePass file opened with its password and key file, read as an import, off the main thread. */
export type TReadKdbx = (
  file: Uint8Array<ArrayBuffer>,
  credentials: { readonly password: string; readonly keyFile: Uint8Array<ArrayBuffer> | null }
) => Promise<TResult<IImportBatch, TKdbxError>>;
