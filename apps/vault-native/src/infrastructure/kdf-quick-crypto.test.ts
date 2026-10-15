import { toHex, utf8 } from '@frozik/vault/crypto/bytes';
import { ARGON2ID_REFERENCE_VECTORS } from '@frozik/vault/testing/argon2-reference-vectors';

import { QUICK_CRYPTO_KDF } from './kdf-quick-crypto';

jest.mock('react-native-quick-crypto', () => {
  const { argon2id } = jest.requireActual<typeof import('hash-wasm')>('hash-wasm');
  return {
    argon2: (
      _algorithm: string,
      params: {
        message: Uint8Array;
        nonce: Uint8Array;
        passes: number;
        parallelism: number;
        memory: number;
        tagLength: number;
      },
      callback: (error: Error | null, result: Uint8Array) => void
    ) =>
      void argon2id({
        password: params.message,
        salt: params.nonce,
        iterations: params.passes,
        parallelism: params.parallelism,
        memorySize: params.memory,
        hashLength: params.tagLength,
        outputType: 'binary',
      }).then(hash => callback(null, hash)),
  };
});

describe('Argon2id through quick-crypto', () => {
  it.each(ARGON2ID_REFERENCE_VECTORS)(
    'derives the reference hash for $password / $salt at m=$memoryKib KiB, t=$iterations, p=$parallelism',
    async ({ password, salt, hash, ...params }) => {
      expect(toHex(await QUICK_CRYPTO_KDF.argon2id(utf8(password), utf8(salt), params))).toBe(hash);
    }
  );
});
