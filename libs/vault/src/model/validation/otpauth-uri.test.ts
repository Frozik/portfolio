import * as fc from 'fast-check';

import { bareSecretToUri, formatOtpUri, isBareSecret, parseOtpUri } from './otpauth-uri';

describe('otpauth URI', () => {
  it('reads the Key URI example with the defaults filled in', () => {
    expect(
      parseOtpUri('otpauth://totp/Example:alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Example')
    ).toEqual({
      ok: true,
      value: {
        type: 'totp',
        label: 'Example:alice@google.com',
        issuer: 'Example',
        secret: 'JBSWY3DPEHPK3PXP',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        counter: 0,
        encoder: 'default',
      },
    });
  });

  it('reads HOTP counters, other algorithms and lower-case or spaced secrets', () => {
    const parsed = parseOtpUri(
      'otpauth://hotp/svc?secret=jbsw y3dp&algorithm=sha512&digits=8&counter=7'
    );

    expect(parsed).toMatchObject({
      ok: true,
      value: { type: 'hotp', secret: 'JBSWY3DP', algorithm: 'SHA512', digits: 8, counter: 7 },
    });
  });

  it('reads Steam Guard both as Bitwarden writes it and as an encoder parameter', () => {
    expect(parseOtpUri('steam://JBSWY3DPEHPK3PXP')).toMatchObject({
      ok: true,
      value: { encoder: 'steam', digits: 5 },
    });
    expect(parseOtpUri('otpauth://totp/Steam?secret=JBSWY3DPEHPK3PXP&encoder=steam')).toMatchObject(
      {
        ok: true,
        value: { encoder: 'steam', digits: 5 },
      }
    );
  });

  it.each([
    ['https://example.com', 'not-otp'],
    ['otpauth://push/x?secret=JBSWY3DP', 'not-otp'],
    ['otpauth://totp/x?secret=not*base32', 'bad-secret'],
    ['otpauth://totp/x', 'bad-secret'],
    ['otpauth://totp/x?secret=JBSWY3DP&digits=9', 'bad-parameter'],
    ['otpauth://totp/x?secret=JBSWY3DP&period=0', 'bad-parameter'],
    ['otpauth://totp/x?secret=JBSWY3DP&algorithm=MD5', 'bad-parameter'],
    ['otpauth://totp/100%?secret=JBSWY3DP', 'bad-parameter'],
  ])('refuses %s as %s', (uri, error) => {
    expect(parseOtpUri(uri)).toEqual({ ok: false, error });
  });

  it('writes every code it reads back to the same parameters', () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constantFrom('totp' as const, 'hotp' as const),
          label: fc.string({ maxLength: 20 }),
          issuer: fc.option(fc.string({ maxLength: 10 }), { nil: null }),
          secret: fc.stringMatching(/^[A-Z2-7]{8,32}$/),
          algorithm: fc.constantFrom('SHA1' as const, 'SHA256' as const, 'SHA512' as const),
          digits: fc.constantFrom(6, 8),
          period: fc.integer({ min: 1, max: 120 }),
          counter: fc.nat(1_000_000),
        }),
        params => {
          const full = {
            ...params,
            encoder: 'default' as const,
            counter: params.type === 'hotp' ? params.counter : 0,
            period: params.type === 'totp' ? params.period : 30,
          };
          const parsed = parseOtpUri(formatOtpUri(full));
          return parsed.ok && JSON.stringify(parsed.value) === JSON.stringify(full);
        }
      ),
      { seed: 20261011 }
    );
  });

  it('turns a pasted bare secret into a TOTP URI labelled with the card, dropping spaces, dashes and padding', () => {
    expect(isBareSecret('jbsw y3dp ehpk 3pxp')).toBe(true);
    expect(isBareSecret('otpauth://totp/x')).toBe(false);
    expect(bareSecretToUri('JBSW-Y3DP-EHPK-3PXP', 'My Bank')).toContain('secret=JBSWY3DPEHPK3PXP&');
    expect(bareSecretToUri('JBSW\u00a0Y3DP\tEHPK 3PXP==', 'My Bank')).toContain(
      'secret=JBSWY3DPEHPK3PXP&'
    );
    expect(bareSecretToUri('jbsw y3dp ehpk 3pxp', 'My Bank')).toBe(
      'otpauth://totp/My%20Bank?secret=JBSWY3DPEHPK3PXP&algorithm=SHA1&digits=6&period=30'
    );
  });
});
