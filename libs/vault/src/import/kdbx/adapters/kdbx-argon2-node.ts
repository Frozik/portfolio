import { isNil } from 'lodash-es';

import type { TNodeArgon2 } from '../../../crypto/adapters/kdf-node-argon2';
import type { TKdbxArgon2 } from '../read-kdbx';

const ARGON2D = 0;

/** KeePass's Argon2d or Argon2id through a native `crypto.argon2` (memory in KiB, the version as the file asks). */
export function nodeKdbxArgon2(argon2: TNodeArgon2): TKdbxArgon2 {
  return (password, salt, memory, iterations, length, parallelism, type, version) =>
    new Promise<ArrayBuffer>((resolve, reject) => {
      const message = new Uint8Array(password);
      argon2(
        type === ARGON2D ? 'argon2d' : 'argon2id',
        {
          message,
          nonce: new Uint8Array(salt),
          parallelism,
          tagLength: length,
          memory,
          passes: iterations,
          version,
        },
        (error, result) => {
          message.fill(0);
          if (!isNil(error)) {
            reject(error);
            return;
          }
          resolve(result.slice().buffer);
          result.fill(0);
        }
      );
    });
}
