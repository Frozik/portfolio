import { argon2d, argon2id } from 'hash-wasm';

import type { TNodeArgon2 } from '../crypto/adapters/kdf-node-argon2';

const SUPPORTED_VERSION = 0x13;

/** Node's `crypto.argon2` in front of the reference Argon2: every named parameter reaches it, or the hash differs. */
export const referenceNodeArgon2: TNodeArgon2 = (algorithm, params, callback) => {
  if (params.version !== SUPPORTED_VERSION) {
    callback(new RangeError('Invalid Argon2 version'), new Uint8Array(0));
    return;
  }
  const options = {
    password: params.message,
    salt: params.nonce,
    iterations: params.passes,
    parallelism: params.parallelism,
    memorySize: params.memory,
    hashLength: params.tagLength,
    outputType: 'binary' as const,
  };
  void (algorithm === 'argon2d' ? argon2d(options) : argon2id(options)).then(hash =>
    callback(null, hash)
  );
};
