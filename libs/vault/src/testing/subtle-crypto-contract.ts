import type { TBytes } from '../crypto/bytes';
import { toHex, utf8 } from '../crypto/bytes';
import { isOperationError } from '../crypto/operation-error';
import { fromHex } from './hex';

const AES_KEY_BITS = 256;
const BITS_PER_BYTE = 8;
const NONCE = fromHex('000102030405060708090a0b');
const ADDITIONAL_DATA = utf8('header');
const PLAINTEXT = utf8('a card nobody else reads');
const CBC_BLOCK_BYTES = 16;
const KEK_USAGES: KeyUsage[] = ['encrypt', 'decrypt', 'unwrapKey'];
const HKDF_CHECK = {
  name: 'HKDF',
  hash: 'SHA-256',
  salt: new Uint8Array(0),
  info: utf8('pwv/key-check'),
};

const RFC5869_CASE_1 = {
  ikm: fromHex('0b'.repeat(22)),
  salt: fromHex('000102030405060708090a0b0c'),
  info: fromHex('f0f1f2f3f4f5f6f7f8f9'),
  okm: '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
};

const NIST_CBC_AES256 = {
  key: fromHex('603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4'),
  iv: fromHex('000102030405060708090a0b0c0d0e0f'),
  plaintext: fromHex('6bc1bee22e409f96e93d7e117393172a'),
  ciphertext: 'f58c4c04d6e5f1ba779eabfb5f7bfbd6',
};

const RFC_HMAC_CASE_1 = {
  key: fromHex('0b'.repeat(20)),
  message: utf8('Hi There'),
  'SHA-1': 'b617318655057264e28bc0b6fb378c8ef146be00',
  'SHA-256': 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
  'SHA-512':
    '87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cde' +
    'daa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854',
} as const;

async function rejection(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
    return null;
  } catch (error) {
    return error;
  }
}

/**
 * One suite every WebCrypto implementation passes before the vault runs on
 * it: the exact algorithm combinations the core calls, known-answer vectors
 * where a standard publishes them, and `OperationError` wherever the core
 * reads a failed check.
 */
export function describeSubtleCryptoContract(name: string, subtle: () => SubtleCrypto): void {
  describe(`${name} — WebCrypto contract`, () => {
    const hkdfKey = (material: TBytes): Promise<CryptoKey> =>
      subtle().importKey('raw', material, 'HKDF', false, ['deriveBits', 'deriveKey']);

    const gcmKeyFromHkdf = async (material: TBytes, usages: KeyUsage[]): Promise<CryptoKey> =>
      subtle().deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: utf8('pwv/payload') },
        await hkdfKey(material),
        { name: 'AES-GCM', length: AES_KEY_BITS },
        false,
        usages
      );

    it('derives HKDF-SHA-256 bits as RFC 5869 states them', async () => {
      const { ikm, salt, info, okm } = RFC5869_CASE_1;

      const bits = await subtle().deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        await hkdfKey(ikm),
        (okm.length / 2) * BITS_PER_BYTE
      );

      expect(toHex(new Uint8Array(bits))).toBe(okm);
    });

    it('opens what an HKDF-derived AES-GCM key sealed, and only with the same header', async () => {
      const key = await gcmKeyFromHkdf(fromHex('11'.repeat(32)), ['encrypt', 'decrypt']);
      const sealed = new Uint8Array(
        await subtle().encrypt(
          { name: 'AES-GCM', iv: NONCE, additionalData: ADDITIONAL_DATA },
          key,
          PLAINTEXT
        )
      );

      const opened = await subtle().decrypt(
        { name: 'AES-GCM', iv: NONCE, additionalData: ADDITIONAL_DATA },
        key,
        sealed
      );
      const otherHeader = await rejection(
        subtle().decrypt({ name: 'AES-GCM', iv: NONCE, additionalData: utf8('other') }, key, sealed)
      );

      expect(new Uint8Array(opened)).toEqual(PLAINTEXT);
      expect(isOperationError(otherHeader)).toBe(true);
    });

    it('refuses a sealed block with a changed tag or under another key, as an OperationError', async () => {
      const key = await gcmKeyFromHkdf(fromHex('11'.repeat(32)), ['encrypt', 'decrypt']);
      const otherKey = await gcmKeyFromHkdf(fromHex('22'.repeat(32)), ['encrypt', 'decrypt']);
      const parameters = { name: 'AES-GCM', iv: NONCE, additionalData: ADDITIONAL_DATA };
      const sealed = new Uint8Array(await subtle().encrypt(parameters, key, PLAINTEXT));
      const tampered = sealed.with(sealed.length - 1, (sealed.at(-1) ?? 0) ^ 1);

      expect(isOperationError(await rejection(subtle().decrypt(parameters, key, tampered)))).toBe(
        true
      );
      expect(
        isOperationError(await rejection(subtle().decrypt(parameters, otherKey, sealed)))
      ).toBe(true);
    });

    it('unwraps a wrapped key straight into an HKDF key that derives what the raw key derives', async () => {
      const dek = fromHex('33'.repeat(32));
      const kek = await gcmKeyFromHkdf(fromHex('44'.repeat(32)), ['encrypt', 'unwrapKey']);
      const wrapParameters = { name: 'AES-GCM', iv: NONCE, additionalData: ADDITIONAL_DATA };
      const wrapped = new Uint8Array(await subtle().encrypt(wrapParameters, kek, dek));

      const unwrapped = await subtle().unwrapKey(
        'raw',
        wrapped,
        kek,
        wrapParameters,
        'HKDF',
        false,
        ['deriveBits', 'deriveKey']
      );
      const derived = await subtle().deriveBits(HKDF_CHECK, unwrapped, AES_KEY_BITS);
      const expected = await subtle().deriveBits(HKDF_CHECK, await hkdfKey(dek), AES_KEY_BITS);

      expect(new Uint8Array(derived)).toEqual(new Uint8Array(expected));
    });

    it('refuses to unwrap under another key, as an OperationError', async () => {
      const kek = await gcmKeyFromHkdf(fromHex('44'.repeat(32)), ['encrypt', 'unwrapKey']);
      const otherKek = await gcmKeyFromHkdf(fromHex('55'.repeat(32)), ['unwrapKey']);
      const parameters = { name: 'AES-GCM', iv: NONCE, additionalData: ADDITIONAL_DATA };
      const wrapped = new Uint8Array(
        await subtle().encrypt(parameters, kek, fromHex('33'.repeat(32)))
      );

      const refused = await rejection(
        subtle().unwrapKey('raw', wrapped, otherKek, parameters, 'HKDF', false, ['deriveBits'])
      );

      expect(isOperationError(refused)).toBe(true);
    });

    it('derives PBKDF2 bits as RFC 6070 and the published SHA-256 answers state them', async () => {
      const material = await subtle().importKey('raw', utf8('password'), 'PBKDF2', false, [
        'deriveBits',
      ]);
      const pbkdf2 = async (hash: string, iterations: number, bytes: number): Promise<string> =>
        toHex(
          new Uint8Array(
            await subtle().deriveBits(
              { name: 'PBKDF2', hash, salt: utf8('salt'), iterations },
              material,
              bytes * BITS_PER_BYTE
            )
          )
        );

      expect(await pbkdf2('SHA-1', 2, 20)).toBe('ea6c014dc72d6f8ccd1ed92ace1d41f0d8de8957');
      expect(await pbkdf2('SHA-256', 1, 32)).toBe(
        '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b'
      );
    });

    it('unwraps a key into HKDF under a PBKDF2-derived or a raw-imported AES-GCM key', async () => {
      const dek = fromHex('33'.repeat(32));
      const material = await subtle().importKey('raw', utf8('password'), 'PBKDF2', false, [
        'deriveKey',
      ]);
      const derivedKek = await subtle().deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', salt: utf8('salt'), iterations: 1 },
        material,
        { name: 'AES-GCM', length: AES_KEY_BITS },
        false,
        KEK_USAGES
      );
      const importedKek = await subtle().importKey(
        'raw',
        fromHex('66'.repeat(32)),
        { name: 'AES-GCM', length: AES_KEY_BITS },
        false,
        KEK_USAGES
      );
      const parameters = { name: 'AES-GCM', iv: NONCE, additionalData: ADDITIONAL_DATA };
      const unwrappedBits = async (kek: CryptoKey): Promise<Uint8Array> => {
        const wrapped = await subtle().encrypt(parameters, kek, dek);
        const unwrapped = await subtle().unwrapKey('raw', wrapped, kek, parameters, 'HKDF', false, [
          'deriveBits',
        ]);
        return new Uint8Array(await subtle().deriveBits(HKDF_CHECK, unwrapped, AES_KEY_BITS));
      };
      const expected = new Uint8Array(
        await subtle().deriveBits(HKDF_CHECK, await hkdfKey(dek), AES_KEY_BITS)
      );

      expect(await unwrappedBits(derivedKek)).toEqual(expected);
      expect(await unwrappedBits(importedKek)).toEqual(expected);
    });

    it('encrypts AES-256-CBC as NIST SP 800-38A states it and strips the PKCS#7 padding back', async () => {
      const { key, iv, plaintext, ciphertext } = NIST_CBC_AES256;
      const aesKey = await subtle().importKey('raw', key, 'AES-CBC', false, ['encrypt', 'decrypt']);

      const sealed = new Uint8Array(
        await subtle().encrypt({ name: 'AES-CBC', iv }, aesKey, plaintext)
      );
      const opened = await subtle().decrypt({ name: 'AES-CBC', iv }, aesKey, sealed);

      expect(toHex(sealed.subarray(0, CBC_BLOCK_BYTES))).toBe(ciphertext);
      expect(new Uint8Array(opened)).toEqual(plaintext);
    });

    it('refuses AES-CBC bytes whose padding does not check out', async () => {
      const { key, iv } = NIST_CBC_AES256;
      const aesKey = await subtle().importKey('raw', key, 'AES-CBC', false, ['decrypt']);

      const refused = await rejection(
        subtle().decrypt({ name: 'AES-CBC', iv }, aesKey, fromHex('00'.repeat(CBC_BLOCK_BYTES)))
      );

      expect(refused).not.toBeNull();
    });

    it.each(['SHA-1', 'SHA-256', 'SHA-512'] as const)(
      'signs HMAC-%s as RFC 2202 and RFC 4231 state it',
      async hash => {
        const key = await subtle().importKey(
          'raw',
          RFC_HMAC_CASE_1.key,
          { name: 'HMAC', hash },
          false,
          ['sign']
        );

        const signature = await subtle().sign('HMAC', key, RFC_HMAC_CASE_1.message);

        expect(toHex(new Uint8Array(signature))).toBe(RFC_HMAC_CASE_1[hash]);
      }
    );

    it('hashes SHA-256 as FIPS 180-4 states it', async () => {
      const digest = await subtle().digest('SHA-256', utf8('abc'));

      expect(toHex(new Uint8Array(digest))).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
      );
    });
  });
}
