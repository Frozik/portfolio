import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TVaultKey } from '@frozik/vault/persistence/ports';

export interface ICustodyKey {
  readonly dek: CryptoKey;
  readonly keyId: TBytes;
}

/**
 * Where the open vault's key is kept while unlocked. The web keeps the
 * non-extractable key in memory only; a platform whose process sleeps while
 * the vault stays open (the extension's service worker) keeps it where the
 * sleep does not reach and restores it on waking.
 */
export interface ISessionKeyCustody {
  hold(vaultKey: TVaultKey, key: ICustodyKey): Promise<void>;
  /** The key kept for this vault, or `null` when there is none (or this platform keeps none). */
  restore(vaultKey: TVaultKey): Promise<ICustodyKey | null>;
  release(): Promise<void>;
  /** A quick lock: the key stays only behind the quick key, for one try. */
  lockQuick(vaultKey: TVaultKey, key: ICustodyKey, quickKey: CryptoKey): Promise<void>;
  /** The one try: the key behind this quick key, or `null` — and then nothing is kept. */
  unlockQuick(vaultKey: TVaultKey, quickKey: CryptoKey): Promise<ICustodyKey | null>;
}
