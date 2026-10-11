import { toHex, utf8 } from '../bytes';
import { HASH_WASM_KDF } from './kdf-hash-wasm';

/**
 * Argon2id v1.3 vectors of the reference implementation (phc-winner-argon2
 * `src/test.c`), cross-checked with OpenSSL. RFC 9106 §5.3 needs associated
 * data, which hash-wasm does not take, so the reference vectors stand in.
 */
describe('Argon2id through hash-wasm', () => {
  it.each([
    {
      password: 'password',
      salt: 'somesalt',
      memoryKib: 65_536,
      iterations: 2,
      parallelism: 1,
      hash: '09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7',
    },
    {
      password: 'password',
      salt: 'somesalt',
      memoryKib: 256,
      iterations: 2,
      parallelism: 1,
      hash: '9dfeb910e80bad0311fee20f9c0e2b12c17987b4cac90c2ef54d5b3021c68bfe',
    },
    {
      password: 'password',
      salt: 'somesalt',
      memoryKib: 256,
      iterations: 2,
      parallelism: 2,
      hash: '6d093c501fd5999645e0ea3bf620d7b8be7fd2db59c20d9fff9539da2bf57037',
    },
    {
      password: 'password',
      salt: 'somesalt',
      memoryKib: 65_536,
      iterations: 1,
      parallelism: 1,
      hash: 'f6a5adc1ba723dddef9b5ac1d464e180fcd9dffc9d1cbf76cca2fed795d9ca98',
    },
    {
      password: 'differentpassword',
      salt: 'somesalt',
      memoryKib: 65_536,
      iterations: 2,
      parallelism: 1,
      hash: '0b84d652cf6b0c4beaef0dfe278ba6a80df6696281d7e0d2891b817d8c458fde',
    },
    {
      password: 'password',
      salt: 'diffsalt',
      memoryKib: 65_536,
      iterations: 2,
      parallelism: 1,
      hash: 'bdf32b05ccc42eb15d58fd19b1f856b113da1e9a5874fdcc544308565aa8141c',
    },
  ])(
    'derives the reference hash for $password / $salt at m=$memoryKib KiB, t=$iterations, p=$parallelism',
    async ({ password, salt, hash, ...params }) => {
      expect(toHex(await HASH_WASM_KDF.argon2id(utf8(password), utf8(salt), params))).toBe(hash);
    }
  );
});
