import { describeSubtleCryptoContract } from '../../testing/subtle-crypto-contract';
import { isOperationError } from '../operation-error';
import { conformantSubtle } from './conformant-subtle';

/** Node's WebCrypto failing the way a native library does: its own error, no `OperationError`. */
function nativeLikeSubtle(): SubtleCrypto {
  const failNatively = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch {
      throw new Error('crypto failed');
    }
  };
  return Object.assign(Object.create(null) as object, {
    ...Object.fromEntries(
      (
        [
          'encrypt',
          'sign',
          'verify',
          'digest',
          'generateKey',
          'deriveKey',
          'deriveBits',
          'importKey',
          'exportKey',
          'wrapKey',
        ] as const
      ).map(method => [method, crypto.subtle[method].bind(crypto.subtle)])
    ),
    decrypt: (...args: Parameters<SubtleCrypto['decrypt']>) =>
      failNatively(() => crypto.subtle.decrypt(...args)),
    unwrapKey: (...args: Parameters<SubtleCrypto['unwrapKey']>) =>
      failNatively(() => crypto.subtle.unwrapKey(...args)),
  }) as SubtleCrypto;
}

describe('a native-like WebCrypto', () => {
  it('fails a changed tag with its own error, which the core cannot read', async () => {
    const subtle = nativeLikeSubtle();
    const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    const iv = new Uint8Array(12);
    const sealed = new Uint8Array(
      await subtle.encrypt({ name: 'AES-GCM', iv }, key, new Uint8Array(4))
    );
    sealed[0] = (sealed[0] ?? 0) ^ 1;

    const failure = await subtle
      .decrypt({ name: 'AES-GCM', iv }, key, sealed)
      .catch((error: unknown) => error);

    expect(isOperationError(failure)).toBe(false);
  });
});

describe('a native-like WebCrypto made conformant', () => {
  it('leaves a failure the library already named alone: a misused key is a defect, not a wrong password', async () => {
    const misuse = new Error('Key algorithm mismatch');
    misuse.name = 'InvalidAccessError';
    const subtle = conformantSubtle({
      ...nativeLikeSubtle(),
      decrypt: () => Promise.reject(misuse),
    } as SubtleCrypto);

    const failure = await subtle
      .decrypt({ name: 'AES-GCM', iv: new Uint8Array(12) }, {} as CryptoKey, new Uint8Array(16))
      .catch((error: unknown) => error);

    expect(failure).toBe(misuse);
  });
});

describeSubtleCryptoContract('a native-like WebCrypto made conformant', () =>
  conformantSubtle(nativeLikeSubtle())
);
