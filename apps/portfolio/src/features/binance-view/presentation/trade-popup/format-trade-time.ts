import { Temporal } from 'temporal-polyfill';

import type { UnixTimeMs } from '../../domain/types';

const HEADER_DATETIME_LENGTH = 19; // YYYY-MM-DD HH:MM:SS
const TRADE_TIME_FRACTIONAL_DIGITS = 3; // HH:MM:SS.fff

export function formatBucketStart(epochMs: UnixTimeMs): string {
  // Temporal's ZonedDateTime ISO string is `YYYY-MM-DDTHH:MM:SS[+OFFSET][TZ]`;
  // replace the `T` with a space and trim to the second so the header
  // reads as `YYYY-MM-DD HH:MM:SS`.
  return Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO('UTC')
    .toPlainDateTime()
    .toString({ smallestUnit: 'second' })
    .replace('T', ' ')
    .slice(0, HEADER_DATETIME_LENGTH);
}

export function formatTradeTime(epochMs: UnixTimeMs): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO('UTC')
    .toPlainTime()
    .toString({ fractionalSecondDigits: TRADE_TIME_FRACTIONAL_DIGITS });
}
