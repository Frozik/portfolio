import { fromHex } from '../testing/hex';
import { createSeededRandom } from '../testing/seeded-random';
import { toHex } from './bytes';
import { deriveKeyCheck, generateDek, importDek, keyIdOf } from './dek';

const DEK = fromHex('202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f');

describe('data key', () => {
  it('derives the key check and key id the specification defines (cross-checked with OpenSSL)', async () => {
    const keyCheck = await deriveKeyCheck(await importDek(DEK));

    expect(toHex(keyCheck)).toBe(
      'ce4ece6b762ad22890b3dea7702e3298fbd5b8b21bf0139e256fc4bda9d81883'
    );
    expect(toHex(await keyIdOf(keyCheck))).toBe('2001ce98d0a1f9c631408064cc482c45');
  });

  it('gives two data keys two different ids', async () => {
    const random = createSeededRandom(1);
    const first = await keyIdOf(await deriveKeyCheck(await importDek(generateDek(random))));
    const second = await keyIdOf(await deriveKeyCheck(await importDek(generateDek(random))));

    expect(toHex(first)).not.toBe(toHex(second));
  });

  it('keeps the imported data key inside WebCrypto', async () => {
    expect((await importDek(DEK)).extractable).toBe(false);
  });
});
