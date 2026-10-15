import { nodeArgon2Kdf } from '@frozik/vault/crypto/adapters/kdf-node-argon2';
import { argon2 } from 'react-native-quick-crypto';

/** Argon2id in OpenSSL on a native thread: the JS thread keeps drawing while it runs. */
export const QUICK_CRYPTO_KDF = nodeArgon2Kdf(argon2);
