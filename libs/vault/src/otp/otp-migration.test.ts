import * as fc from 'fast-check';

import { decodeBase32, encodeBase32 } from './base32';
import { parseOtpMigration } from './otp-migration';

/** Protocol Buffers by hand: a length-delimited field and a small varint field. */
function bytesField(number: number, value: Uint8Array): number[] {
  return [(number << 3) | 2, value.length, ...value];
}

function varintField(number: number, value: number): number[] {
  return [(number << 3) | 0, value];
}

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

function migrationUri(entries: readonly number[][]): string {
  const payload = Uint8Array.from([
    ...entries.flatMap(entry => bytesField(1, Uint8Array.from(entry))),
    ...varintField(2, 1),
  ]);
  const data = btoa(String.fromCharCode(...payload));
  return `otpauth-migration://offline?data=${encodeURIComponent(data)}`;
}

const SECRET = Uint8Array.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21, 0xde, 0xad, 0xbe, 0xef]);

describe('Google Authenticator transfer', () => {
  it('reads every account of the QR, TOTP and HOTP alike', () => {
    const totp = [
      ...bytesField(1, SECRET),
      ...bytesField(2, text('jane@example.com')),
      ...bytesField(3, text('Example')),
      ...varintField(4, 2),
      ...varintField(5, 2),
      ...varintField(6, 2),
    ];
    const hotp = [
      ...bytesField(1, SECRET),
      ...bytesField(2, text('bank')),
      ...varintField(6, 1),
      ...varintField(7, 5),
    ];

    const parsed = parseOtpMigration(migrationUri([totp, hotp]));

    expect(parsed).toEqual({
      ok: true,
      value: [
        expect.objectContaining({
          type: 'totp',
          label: 'jane@example.com',
          issuer: 'Example',
          secret: encodeBase32(SECRET),
          algorithm: 'SHA256',
          digits: 8,
        }),
        expect.objectContaining({
          type: 'hotp',
          label: 'bank',
          issuer: null,
          counter: 5,
          digits: 6,
        }),
      ],
    });
  });

  it('leaves out an account it cannot use, and refuses anything else', () => {
    const md5 = [...bytesField(1, SECRET), ...varintField(4, 4)];

    expect(parseOtpMigration(migrationUri([md5]))).toEqual({ ok: false, error: 'not-migration' });
    expect(parseOtpMigration('otpauth://totp/x?secret=JBSWY3DP')).toEqual({
      ok: false,
      error: 'not-migration',
    });
    expect(parseOtpMigration('otpauth-migration://offline?data=%%%')).toEqual({
      ok: false,
      error: 'not-migration',
    });
  });

  it('writes base32 that reads back to the same bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 1, maxLength: 64 }), bytes => {
        const decoded = decodeBase32(encodeBase32(bytes));
        expect(decoded.ok && [...decoded.value]).toEqual([...bytes]);
      })
    );
  });
});
