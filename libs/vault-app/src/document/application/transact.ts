import type { IHlc } from '@frozik/vault/model/hlc';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';

/** An edit of the whole document at one stamp, with what the caller wants to know about it. */
export type TDocumentEdit<T> = (
  document: IVaultDocument,
  at: IHlc
) => { readonly document: IVaultDocument; readonly result: T };

/** The session's one write path; `null` in a read-only session. */
export type TTransact = <T>(edit: TDocumentEdit<T>) => T | null;
