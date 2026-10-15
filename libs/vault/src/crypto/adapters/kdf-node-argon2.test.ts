import { ARGON2ID_REFERENCE_VECTORS } from '../../testing/argon2-reference-vectors';
import { referenceNodeArgon2 } from '../../testing/reference-node-argon2';
import { toHex, utf8 } from '../bytes';
import { nodeArgon2Kdf } from './kdf-node-argon2';

describe('Argon2id through a native crypto.argon2', () => {
  it.each(ARGON2ID_REFERENCE_VECTORS)(
    'derives the reference hash for $password / $salt at m=$memoryKib KiB, t=$iterations, p=$parallelism',
    async ({ password, salt, hash, ...params }) => {
      const kdf = nodeArgon2Kdf(referenceNodeArgon2);

      expect(toHex(await kdf.argon2id(utf8(password), utf8(salt), params))).toBe(hash);
    }
  );

  it('rejects with the native failure', async () => {
    const failure = new RangeError('Invalid Argon2 memory');
    const kdf = nodeArgon2Kdf((_algorithm, _params, callback) =>
      callback(failure, new Uint8Array(0))
    );

    await expect(
      kdf.argon2id(utf8('password'), utf8('somesalt'), {
        memoryKib: 1,
        iterations: 1,
        parallelism: 1,
      })
    ).rejects.toBe(failure);
  });

  it('wipes the native buffer once the key material is copied out', async () => {
    const native = new Uint8Array([1, 2, 3]);
    const kdf = nodeArgon2Kdf((_algorithm, _params, callback) => callback(null, native));

    const material = await kdf.argon2id(utf8('password'), utf8('somesalt'), {
      memoryKib: 256,
      iterations: 2,
      parallelism: 1,
    });

    expect([...material, ...native]).toEqual([1, 2, 3, 0, 0, 0]);
  });
});
