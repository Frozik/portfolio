import { argon2id } from 'hash-wasm';

import type { TBytes } from '../bytes';
import type { IKdf } from '../kdf-port';
import { KEK_BYTES } from '../kdf-port';

/** Argon2id from hash-wasm (RFC 9106, version 0x13); synchronous inside, so it belongs in a Worker. */
export const HASH_WASM_KDF: IKdf = {
  async argon2id(password, salt, { memoryKib, iterations, parallelism }): Promise<TBytes> {
    const output = await argon2id({
      password,
      salt,
      iterations,
      parallelism,
      memorySize: memoryKib,
      hashLength: KEK_BYTES,
      outputType: 'binary',
    });
    const material = new Uint8Array(output);
    output.fill(0);
    return material;
  },
};
