import { Temporal } from 'temporal-polyfill';

import { assert } from '@frozik/utils/assert/assert';
import type { Milliseconds } from '@frozik/utils/date/types';

import type { IOtpParams, TOtpAlgorithm } from '../model/validation/otpauth-uri';
import { decodeBase32 } from './base32';
import { correctedClock, estimateClockOffset } from './clock-offset';
import { oneTimeCode } from './one-time-code';

const base32 = (ascii: string): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of ascii) {
    bits += character.charCodeAt(0).toString(2).padStart(8, '0');
  }
  return (bits.match(/.{1,5}/g) ?? [])
    .map(chunk => alphabet[Number.parseInt(chunk.padEnd(5, '0'), 2)])
    .join('');
};

/** RFC 6238 Appendix B: the seed differs per algorithm. */
const SEEDS: Readonly<Record<TOtpAlgorithm, string>> = {
  SHA1: base32('12345678901234567890'),
  SHA256: base32('12345678901234567890123456789012'),
  SHA512: base32('1234567890123456789012345678901234567890123456789012345678901234'),
};

function params(overrides: Partial<IOtpParams>): IOtpParams {
  return {
    type: 'totp',
    label: 'test',
    issuer: null,
    secret: SEEDS.SHA1,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    counter: 0,
    encoder: 'default',
    ...overrides,
  };
}

const at = (seconds: number): Temporal.Instant =>
  Temporal.Instant.fromEpochMilliseconds(seconds * 1000);

describe('one-time codes', () => {
  it.each([
    [0, '755224'],
    [1, '287082'],
    [2, '359152'],
    [3, '969429'],
    [4, '338314'],
    [5, '254676'],
    [6, '287922'],
    [7, '162583'],
    [8, '399871'],
    [9, '520489'],
  ])('give the RFC 4226 HOTP code for counter %i', async (counter, code) => {
    expect(await oneTimeCode(params({ type: 'hotp' }), { kind: 'counter', counter })).toMatchObject(
      { ok: true, value: { code } }
    );
  });

  it.each([
    [59, 'SHA1', '94287082'],
    [59, 'SHA256', '46119246'],
    [59, 'SHA512', '90693936'],
    [1111111109, 'SHA1', '07081804'],
    [1111111109, 'SHA256', '68084774'],
    [1111111109, 'SHA512', '25091201'],
    [1111111111, 'SHA1', '14050471'],
    [1234567890, 'SHA256', '91819424'],
    [2000000000, 'SHA512', '38618901'],
    [20000000000, 'SHA1', '65353130'],
  ] as const)('give the RFC 6238 TOTP code at %i s with %s', async (seconds, algorithm, code) => {
    const result = await oneTimeCode(params({ algorithm, secret: SEEDS[algorithm], digits: 8 }), {
      kind: 'time',
      at: at(seconds),
    });

    expect(result).toMatchObject({ ok: true, value: { code } });
  });

  it.each([
    [59, 'PV9M4'],
    [1111111109, 'PY4YB'],
    [1234567890, 'VHHQY'],
    [2000000000, '9N776'],
  ])('give the Steam Guard code at %i s (cross-checked in Python)', async (seconds, code) => {
    const result = await oneTimeCode(params({ encoder: 'steam', digits: 5 }), {
      kind: 'time',
      at: at(seconds),
    });

    expect(result).toMatchObject({ ok: true, value: { code } });
  });

  it('say until when a code is valid, for a period that is not thirty seconds too', async () => {
    const result = await oneTimeCode(params({ period: 60 }), { kind: 'time', at: at(130) });

    assert(result.ok);
    expect(result.value.validUntil?.epochMilliseconds).toBe(180_000);
  });

  it('refuse a secret that is not base32', async () => {
    expect(
      await oneTimeCode(params({ secret: 'NOT*BASE32' }), { kind: 'counter', counter: 0 })
    ).toEqual({ ok: false, error: 'bad-secret' });
    expect(decodeBase32('')).toEqual({ ok: false, error: 'bad-secret' });
  });
});

describe('network time', () => {
  const sample = (offsetMs: number, roundTrip: number) => ({
    roundTrip: roundTrip as Milliseconds,
    localEpochMsAtReceipt: 1_760_000_000_000,
    serverEpochMs: 1_760_000_000_000 - roundTrip / 2 + offsetMs,
  });

  it('takes the median offset of the samples that came back fast enough', () => {
    expect(
      estimateClockOffset([
        sample(47_000, 80),
        sample(47_010, 60),
        sample(46_990, 120),
        sample(-5_000, 1_500),
      ])
    ).toBe(47_000);
  });

  it('knows no offset when every sample was too slow or there was none', () => {
    expect(estimateClockOffset([sample(10, 2_000)])).toBeNull();
    expect(estimateClockOffset([])).toBeNull();
  });

  it('gives the right code on a device clock 47 seconds off once corrected', async () => {
    const reference = at(1111111109);
    const skewed = (): Temporal.Instant => reference.subtract({ seconds: 47 });
    const clock = correctedClock(skewed, 47_000 as Milliseconds);

    const onSkewed = await oneTimeCode(params({ digits: 8 }), { kind: 'time', at: skewed() });
    const onCorrected = await oneTimeCode(params({ digits: 8 }), { kind: 'time', at: clock() });

    expect(onCorrected).toMatchObject({ ok: true, value: { code: '07081804' } });
    expect(onSkewed).not.toMatchObject({ ok: true, value: { code: '07081804' } });
  });
});
