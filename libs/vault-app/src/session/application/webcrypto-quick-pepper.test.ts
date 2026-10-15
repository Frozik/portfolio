import { toHex } from '@frozik/vault/crypto/bytes';

import { createWebCryptoQuickPepper } from './webcrypto-quick-pepper';

describe('the WebCrypto quick pepper', () => {
  it('mixes the same code the same way until it is renewed', async () => {
    const pepper = createWebCryptoQuickPepper();
    await pepper.renew();
    const first = await pepper.mix('pin:1234');
    const again = await pepper.mix('pin:1234');
    await pepper.renew();
    const renewed = await pepper.mix('pin:1234');

    expect(first).not.toBeNull();
    expect(toHex(again ?? new Uint8Array())).toBe(toHex(first ?? new Uint8Array()));
    expect(toHex(renewed ?? new Uint8Array())).not.toBe(toHex(first ?? new Uint8Array()));
  });

  it('mixes nothing before a pepper exists or after it is gone', async () => {
    const pepper = createWebCryptoQuickPepper();

    expect(await pepper.mix('pin:1234')).toBeNull();
    await pepper.renew();
    pepper.destroy();
    expect(await pepper.mix('pin:1234')).toBeNull();
  });
});
