import { fromHex } from '../testing/hex';
import { openBlock, sealBlock } from './aead';
import { toHex } from './bytes';

function importKey(hex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromHex(hex), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const GCM_TEST_CASE_16 = {
  key: 'feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308',
  nonce: 'cafebabefacedbaddecaf888',
  plaintext:
    'd9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39',
  additionalData: 'feedfacedeadbeeffeedfacedeadbeefabaddad2',
  ciphertext:
    '522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662',
  tag: '76fc6ece0f4e1768cddf8853bb2d551b',
};

describe('AES-256-GCM block', () => {
  it.each([
    {
      name: 'test case 13 (empty plaintext)',
      plaintext: '',
      sealed: '530f8afbc74536b9a963b4f1c4cb738b',
    },
    {
      name: 'test case 14 (one zero block)',
      plaintext: '00'.repeat(16),
      sealed: 'cea7403d4d606b6e074ec5d3baf39d18d0d1c8a799996bf0265b98b5d48ab919',
    },
  ])(
    'matches the GCM specification $name with a zero key and nonce',
    async ({ plaintext, sealed }) => {
      const key = await importKey('00'.repeat(32));

      expect(
        toHex(await sealBlock(key, fromHex('00'.repeat(12)), fromHex(plaintext), fromHex('')))
      ).toBe(sealed);
    }
  );

  it('matches the GCM specification test case 16 with additional data, both ways', async () => {
    const vector = GCM_TEST_CASE_16;
    const key = await importKey(vector.key);
    const nonce = fromHex(vector.nonce);
    const additionalData = fromHex(vector.additionalData);

    const sealed = await sealBlock(key, nonce, fromHex(vector.plaintext), additionalData);
    const opened = await openBlock(key, nonce, sealed, additionalData);

    expect(toHex(sealed)).toBe(vector.ciphertext + vector.tag);
    expect(opened.ok && toHex(opened.value)).toBe(vector.plaintext);
  });

  it('refuses a block whose ciphertext, tag or additional data was changed', async () => {
    const vector = GCM_TEST_CASE_16;
    const key = await importKey(vector.key);
    const nonce = fromHex(vector.nonce);
    const sealed = fromHex(vector.ciphertext + vector.tag);
    const flipped = sealed.slice();
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    const lastFlipped = sealed.slice();
    lastFlipped[sealed.length - 1] = (lastFlipped[sealed.length - 1] ?? 0) ^ 1;

    const failed = { ok: false, error: 'authentication-failed' };
    expect(await openBlock(key, nonce, flipped, fromHex(vector.additionalData))).toEqual(failed);
    expect(await openBlock(key, nonce, lastFlipped, fromHex(vector.additionalData))).toEqual(
      failed
    );
    expect(await openBlock(key, nonce, sealed, fromHex('00'))).toEqual(failed);
  });
});
