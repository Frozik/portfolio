import type { Milliseconds } from '@frozik/utils/date/types';
import { isNil } from 'lodash-es';

import type { ITimeSample } from '../ports/time-source';
import type { TWallClock } from '../ports/wall-clock';

/** A sample whose round trip took longer is too vague to trust. */
export const MAX_ROUND_TRIP_MS = 1000;

/** How far the device's wall clock is behind the server's, from one exchange (SNTP: the answer left at the midpoint). */
function offsetOf({ roundTrip, serverEpochMs, localEpochMsAtReceipt }: ITimeSample): number {
  return serverEpochMs - (localEpochMsAtReceipt - roundTrip / 2);
}

/**
 * The median offset of the samples that came back fast
 * enough; `null` when none did. The error is half a round trip, orders of
 * magnitude below a TOTP step.
 */
export function estimateClockOffset(samples: readonly ITimeSample[]): Milliseconds | null {
  const offsets = samples
    .filter(sample => sample.roundTrip <= MAX_ROUND_TRIP_MS)
    .map(offsetOf)
    .sort((first, second) => first - second);
  const middle = Math.floor(offsets.length / 2);
  if (offsets.length === 0) {
    return null;
  }
  const median =
    offsets.length % 2 === 1
      ? offsets[middle]
      : ((offsets[middle - 1] ?? 0) + (offsets[middle] ?? 0)) / 2;
  return isNil(median) ? null : (Math.round(median) as Milliseconds);
}

/** The session's one clock: the device's, moved by the measured offset. */
export function correctedClock(deviceClock: TWallClock, offset: Milliseconds): TWallClock {
  return () => deviceClock().add({ milliseconds: offset });
}
