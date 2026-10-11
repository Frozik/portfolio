import { argon2d, argon2id } from 'hash-wasm';

import type { TKdbxArgon2 } from '../read-kdbx';

const ARGON2D = 0;
const ARGON2_VERSION_13 = 0x13;

/** KeePass's Argon2d or Argon2id through hash-wasm (memory comes in KiB); hash-wasm knows only version 1.3, which every KDBX 4 writer uses. */
export const HASH_WASM_KDBX_ARGON2: TKdbxArgon2 = async (
  password,
  salt,
  memory,
  iterations,
  length,
  parallelism,
  type,
  version
) => {
  if (version !== ARGON2_VERSION_13) {
    throw new Error('Argon2 version 1.0 is not supported');
  }
  const options = {
    password: new Uint8Array(password),
    salt: new Uint8Array(salt),
    memorySize: memory,
    iterations,
    hashLength: length,
    parallelism,
    outputType: 'binary' as const,
  };
  const hash = type === ARGON2D ? await argon2d(options) : await argon2id(options);
  return hash.slice().buffer;
};
