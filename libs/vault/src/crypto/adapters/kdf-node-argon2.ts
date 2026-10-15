import { isNil } from 'lodash-es';

import type { TBytes } from '../bytes';
import type { IKdf } from '../kdf-port';
import { KEK_BYTES } from '../kdf-port';

const ARGON2_VERSION_1_3 = 0x13;

export interface INodeArgon2Params {
  readonly message: Uint8Array;
  readonly nonce: Uint8Array;
  readonly parallelism: number;
  readonly tagLength: number;
  readonly memory: number;
  readonly passes: number;
  readonly version: number;
}

/** Node's `crypto.argon2`, which react-native-quick-crypto reproduces over OpenSSL. */
export type TNodeArgon2 = (
  algorithm: 'argon2d' | 'argon2id',
  params: INodeArgon2Params,
  callback: (error: Error | null, result: Uint8Array) => void
) => void;

/** Argon2id through a native `crypto.argon2`: off the JS thread, and no WASM to load. */
export function nodeArgon2Kdf(argon2: TNodeArgon2): IKdf {
  return {
    argon2id: (password, salt, { memoryKib, iterations, parallelism }) =>
      new Promise<TBytes>((resolve, reject) => {
        const params: INodeArgon2Params = {
          message: password,
          nonce: salt,
          parallelism,
          tagLength: KEK_BYTES,
          memory: memoryKib,
          passes: iterations,
          version: ARGON2_VERSION_1_3,
        };
        argon2('argon2id', params, (error, result) => {
          if (!isNil(error)) {
            reject(error);
            return;
          }
          const material = new Uint8Array(result);
          result.fill(0);
          resolve(material);
        });
      }),
  };
}
