import { conformantSubtle } from '@frozik/vault/crypto/adapters/conformant-subtle';
import { install } from 'react-native-quick-crypto';

/** Hermes has no WebCrypto: OpenSSL through quick-crypto takes its place, failing the way the standard says. */
export function installWebCrypto(): void {
  install();
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: conformantSubtle(globalThis.crypto.subtle),
    configurable: true,
  });
}
