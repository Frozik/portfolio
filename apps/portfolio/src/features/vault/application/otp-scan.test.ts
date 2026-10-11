import { assert } from '@frozik/utils/assert/assert';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from './fake-device.test-helper';
import { scanOtp } from './otp-scan';

/** Google Authenticator's transfer of two accounts, hand-encoded as its protobuf. */
const TWO_ACCOUNTS =
  'otpauth-migration://offline?data=' +
  encodeURIComponent(
    btoa(
      String.fromCharCode(
        ...[
          [
            0x0a, 0x13, 0x0a, 0x05, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x12, 0x04, 0x6a, 0x61, 0x6e,
            0x65, 0x1a, 0x04, 0x42, 0x61, 0x6e, 0x6b,
          ],
          [
            0x0a, 0x12, 0x0a, 0x05, 0x57, 0x6f, 0x72, 0x6c, 0x64, 0x12, 0x03, 0x62, 0x6f, 0x62,
            0x1a, 0x04, 0x4d, 0x61, 0x69, 0x6c,
          ],
        ].flat()
      )
    )
  );

const asImage = (text: string) => ({ bytes: new TextEncoder().encode(text), mime: 'image/png' });
const readText = (image: { readonly bytes: Uint8Array<ArrayBuffer> }) =>
  Promise.resolve(new TextDecoder().decode(image.bytes) || null);

describe('a one-time code from a QR code', () => {
  it('fills the field from an otpauth QR', async () => {
    expect(
      await scanOtp(readText, asImage('otpauth://totp/Bank:jane?secret=JBSWY3DPEHPK3PXP'))
    ).toEqual({
      kind: 'code',
      value: expect.stringMatching(/^otpauth:\/\/totp\/.*secret=JBSWY3DPEHPK3PXP/),
    });
  });

  it('takes a QR that holds only the secret, as some services print it', async () => {
    expect(await scanOtp(readText, asImage('JBSW Y3DP EHPK 3PXP'))).toEqual({
      kind: 'code',
      value: 'JBSW Y3DP EHPK 3PXP',
    });
  });

  it('asks which account when the transfer QR holds several, and says when there is none', async () => {
    const scan = await scanOtp(readText, asImage(TWO_ACCOUNTS));

    expect(scan.kind === 'choose' && scan.codes.map(code => code.issuer)).toEqual(['Bank', 'Mail']);
    expect(await scanOtp(readText, asImage(''))).toEqual({ kind: 'none' });
    expect(await scanOtp(readText, asImage('https://example.com'))).toEqual({ kind: 'none' });
  });

  it('imports a picture of the transfer QR as one card per account', async () => {
    const store = aDevice().startStore();
    store.create('Family', TEST_PASSWORD);
    await when(() => store.session !== null);
    const { session } = store;
    assert(session !== null);
    const flow = store.importInto(session, key => key);

    await flow.chooseImage(asImage(TWO_ACCOUNTS));

    expect(flow.step).toMatchObject({ kind: 'preview', preview: { cards: 2 } });
    await flow.chooseImage(asImage(''));
    expect(flow.step).toEqual({ kind: 'failed', error: 'no-qr-code' });
  });
});
