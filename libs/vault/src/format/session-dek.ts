import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

import type { TBytes } from '../crypto/bytes';
import type { IKdf } from '../crypto/kdf-port';
import type { TFormatError } from './format-errors';
import { decodeHeader } from './header';
import type { TSlotSecret } from './keyslot-changes';
import { rawDekBy } from './keyslot-changes';

export interface ISessionDek {
  /** The DEK's 32 raw bytes: the holder keeps them where the extension keeps its session and zeroes its copy. */
  readonly rawDek: TBytes;
  /** What `openVaultFile` with a `session` unlock compares: a file under another key is refused. */
  readonly keyId: TBytes;
}

/**
 * The extension's unlock: the vault's DEK as
 * raw bytes for `chrome.storage.session`, so a service worker woken later
 * opens the file again without the password.
 */
export async function unwrapSessionDek(
  file: TBytes,
  secret: TSlotSecret,
  argon2: IKdf
): Promise<TResult<ISessionDek, TFormatError>> {
  const decoded = decodeHeader(file);
  if (!decoded.ok) {
    return err({ kind: decoded.error });
  }
  const { header } = decoded.value;
  const raw = await rawDekBy(header, secret, argon2);
  return raw.ok ? ok({ rawDek: raw.value, keyId: header.keyId }) : err({ kind: raw.error });
}
