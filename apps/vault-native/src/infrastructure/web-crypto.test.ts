import { isOperationError } from '@frozik/vault/crypto/operation-error';

import { installWebCrypto } from './web-crypto';

jest.mock('react-native-quick-crypto', () => ({
  install: () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: { subtle: { decrypt: () => Promise.reject(new Error('EVP_DecryptFinal_ex failed')) } },
      configurable: true,
    });
  },
}));

describe('the installed WebCrypto', () => {
  it('reports a failed AES-GCM check as the OperationError the vault reads', async () => {
    installWebCrypto();

    const failure = await globalThis.crypto.subtle
      .decrypt({ name: 'AES-GCM', iv: new Uint8Array(12) }, {} as CryptoKey, new Uint8Array(16))
      .catch((error: unknown) => error);

    expect(isOperationError(failure)).toBe(true);
  });
});
