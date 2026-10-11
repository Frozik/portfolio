import { fromHex } from '../testing/hex';
import { toHex } from './bytes';
import { deriveLabelledBytes, hkdfBytes, importHkdfKey } from './hkdf';

const range = (from: number, to: number): Uint8Array<ArrayBuffer> =>
  Uint8Array.from({ length: to - from }, (_, index) => from + index);

describe('HKDF-SHA-256', () => {
  it.each([
    {
      name: 'RFC 5869 test case 1',
      ikm: new Uint8Array(22).fill(0x0b),
      salt: range(0x00, 0x0d),
      info: range(0xf0, 0xfa),
      length: 42,
      okm: '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
    },
    {
      name: 'RFC 5869 test case 2 (long inputs)',
      ikm: range(0x00, 0x50),
      salt: range(0x60, 0xb0),
      info: range(0xb0, 0x100),
      length: 82,
      okm: 'b11e398dc80327a1c8e7f78c596a49344f012eda2d4efad8a050cc4c19afa97c59045a99cac7827271cb41c65e590e09da3275600c2f09b8367793a9aca3db71cc30c58179ec3e87c14c01d5c1f3434f1d87',
    },
    {
      name: 'RFC 5869 test case 3 (no salt, no info)',
      ikm: new Uint8Array(22).fill(0x0b),
      salt: new Uint8Array(0),
      info: new Uint8Array(0),
      length: 42,
      okm: '8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8',
    },
  ])('matches $name', async ({ ikm, salt, info, length, okm }) => {
    const okmBytes = await hkdfBytes(await importHkdfKey(ikm), salt, info, length);

    expect(toHex(okmBytes)).toBe(okm);
  });

  it('gives every label its own subkey from the same base key', async () => {
    const baseKey = await importHkdfKey(fromHex('00'.repeat(32)));

    const draft = await deriveLabelledBytes(baseKey, 'pwv/draft', 32);
    const usage = await deriveLabelledBytes(baseKey, 'pwv/device-usage', 32);

    expect(toHex(draft)).not.toBe(toHex(usage));
    expect(toHex(await deriveLabelledBytes(baseKey, 'pwv/draft', 32))).toBe(toHex(draft));
  });
});
