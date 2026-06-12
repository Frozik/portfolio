import { Temporal } from 'temporal-polyfill';

import type { ISO } from './types';

export function millisecondsToISO8601(ms: number): ISO {
  return Temporal.Instant.fromEpochMilliseconds(ms).toString() as ISO;
}

export function ISO8601ToMilliseconds(iso: ISO): number {
  return Temporal.Instant.from(iso).epochMilliseconds;
}
