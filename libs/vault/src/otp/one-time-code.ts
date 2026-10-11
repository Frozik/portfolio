import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { Temporal } from 'temporal-polyfill';

import type { IOtpParams } from '../model/validation/otpauth-uri';
import { decodeBase32 } from './base32';
import type { TOtpEncoding } from './hotp';
import { hotpCode } from './hotp';

const MS_PER_SECOND = 1000;

export interface IOneTimeCode {
  readonly code: string;
  /** TOTP: the step the code belongs to, and when the next one starts; HOTP: the counter it used. */
  readonly step: number;
  readonly validUntil: Temporal.Instant | null;
}

function encodingOf(params: IOtpParams): TOtpEncoding {
  return params.encoder === 'steam'
    ? { kind: 'steam' }
    : { kind: 'decimal', digits: params.digits };
}

/** RFC 6238 — the step of a time: whole periods since the Unix epoch (T0 = 0). */
export function totpStep(instant: Temporal.Instant, period: number): number {
  return Math.floor(instant.epochMilliseconds / MS_PER_SECOND / period);
}

/**
 * The code of a field at an instant (TOTP) or a counter
 * (HOTP, the document's counter: hotp-counters). A pure function of its
 * inputs; the instant comes from the session's corrected clock.
 */
export async function oneTimeCode(
  params: IOtpParams,
  moment:
    | { readonly kind: 'time'; readonly at: Temporal.Instant }
    | { readonly kind: 'counter'; readonly counter: number }
): Promise<TResult<IOneTimeCode, 'bad-secret'>> {
  const secret = decodeBase32(params.secret);
  if (!secret.ok) {
    return err('bad-secret');
  }
  if (moment.kind === 'counter') {
    return ok({
      code: await hotpCode(secret.value, moment.counter, params.algorithm, encodingOf(params)),
      step: moment.counter,
      validUntil: null,
    });
  }
  const step = totpStep(moment.at, params.period);
  const code = await hotpCode(secret.value, step, params.algorithm, encodingOf(params));
  return ok({
    code,
    step,
    validUntil: Temporal.Instant.fromEpochMilliseconds((step + 1) * params.period * MS_PER_SECOND),
  });
}
