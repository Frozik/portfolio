import type { TBytes } from '@frozik/vault/crypto/bytes';
import { deriveAesKey, importHkdfKey } from '@frozik/vault/crypto/hkdf';

/** The key a quick lock keeps the vault's key behind: the peppered code through HKDF. */
export async function quickKeyOf(pepperedCode: TBytes): Promise<CryptoKey> {
  return deriveAesKey(await importHkdfKey(pepperedCode), 'pwv/quick-kek');
}
