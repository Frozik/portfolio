import { utf8 } from '@frozik/vault/crypto/bytes';
import { isNil } from 'lodash-es';

import type { IQuickPepper } from '../domain/ports/quick-pepper';

const PEPPER_ALGORITHM: HmacKeyGenParams = { name: 'HMAC', hash: 'SHA-256' };

/** A non-extractable HMAC key in this process's WebCrypto: nothing can read it out, a restart ends it. */
export function createWebCryptoQuickPepper(): IQuickPepper {
  let pepper: CryptoKey | null = null;
  return {
    async renew() {
      pepper = await crypto.subtle.generateKey(PEPPER_ALGORITHM, false, ['sign']);
    },
    async mix(canonicalCode) {
      const current = pepper;
      return isNil(current)
        ? null
        : new Uint8Array(await crypto.subtle.sign('HMAC', current, utf8(canonicalCode)));
    },
    destroy() {
      pepper = null;
    },
  };
}
