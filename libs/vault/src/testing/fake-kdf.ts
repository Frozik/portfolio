import type { TBytes } from '../crypto/bytes';
import { concatBytes, utf8 } from '../crypto/bytes';
import type { IKdf } from '../crypto/kdf-port';

/**
 * A fast deterministic stand-in for Argon2id in tests of the logic above it:
 * SHA-256 of everything Argon2 would read. Argon2 itself is tested against
 * its reference vectors on the real adapter.
 */
export function createFakeKdf(): IKdf & { readonly calls: number } {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    async argon2id(password, salt, { memoryKib, iterations, parallelism }): Promise<TBytes> {
      calls += 1;
      const input = concatBytes(utf8(`${memoryKib}/${iterations}/${parallelism}`), salt, password);
      return new Uint8Array(await crypto.subtle.digest('SHA-256', input));
    },
  };
}
