import { ARGON2ID_REFERENCE_VECTORS } from '../../testing/argon2-reference-vectors';
import { toHex, utf8 } from '../bytes';
import { HASH_WASM_KDF } from './kdf-hash-wasm';

describe('Argon2id through hash-wasm', () => {
  it.each(ARGON2ID_REFERENCE_VECTORS)(
    'derives the reference hash for $password / $salt at m=$memoryKib KiB, t=$iterations, p=$parallelism',
    async ({ password, salt, hash, ...params }) => {
      expect(toHex(await HASH_WASM_KDF.argon2id(utf8(password), utf8(salt), params))).toBe(hash);
    }
  );
});
