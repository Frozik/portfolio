import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import type { CryptoEngine } from 'kdbxweb';
import { Kdbx, KdbxCredentials, KdbxError, ProtectedValue } from 'kdbxweb';
import * as kdbxweb from 'kdbxweb';
import { isNil } from 'lodash-es';

import type { TBytes } from '../../crypto/bytes';
import type { IImportBatch } from '../imported-card';
import { importKdbx } from './map-kdbx';

export type TKdbxError = 'wrong-password' | 'unreadable';

export type TKdbxArgon2 = Parameters<typeof CryptoEngine.setArgon2Impl>[0];

const INVALID_KEY = 'InvalidKey';

/**
 * Opens a KeePass file with its password, its key file or
 * both (KeePass tells "no password" from an empty one: with a key file and
 * nothing typed, there is none) and reads its entries. Argon2 comes from the caller: it
 * is memory-hard and belongs in a Worker, like the vault's own.
 */
export async function readKdbx(
  file: TBytes,
  credentials: { readonly password: string; readonly keyFile: TBytes | null },
  argon2: TKdbxArgon2
): Promise<TResult<IImportBatch, TKdbxError>> {
  kdbxweb.CryptoEngine.setArgon2Impl(argon2);
  try {
    const { password, keyFile } = credentials;
    const database = await Kdbx.load(
      file.slice().buffer,
      new KdbxCredentials(
        password === '' && !isNil(keyFile) ? null : ProtectedValue.fromString(password),
        keyFile
      )
    );
    return ok(await importKdbx(database));
  } catch (error) {
    return err(
      error instanceof KdbxError && error.code === INVALID_KEY ? 'wrong-password' : 'unreadable'
    );
  }
}
