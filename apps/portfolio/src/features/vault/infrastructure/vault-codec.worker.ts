import type { Milliseconds } from '@frozik/utils/date/types';
import { serveVaultCodec } from '@frozik/vault/codec/serve-vault-codec';
import { HASH_WASM_KDF } from '@frozik/vault/crypto/adapters/kdf-hash-wasm';
import { WEB_RANDOM } from '@frozik/vault/crypto/web-random';

/** Argon2 and the whole open/seal pipeline, off the main thread; it keeps no key. */
serveVaultCodec(self, {
  argon2: HASH_WASM_KDF,
  random: WEB_RANDOM,
  elapsed: () => performance.now() as Milliseconds,
});
