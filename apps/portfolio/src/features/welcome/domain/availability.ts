import { EDayOfWeek } from '@frozik/utils/date/constants';
import type { Temporal } from 'temporal-polyfill';

export type TAvailabilityStatus = 'online' | 'away' | 'weekend';

export interface IAvailability {
  readonly status: TAvailabilityStatus;
  readonly isAwake: boolean;
}

export interface IAvailabilityWindow {
  readonly awakeStartHour: number;
  readonly awakeEndHour: number;
}

const WEEKEND_DAYS: ReadonlySet<EDayOfWeek> = new Set([EDayOfWeek.Saturday, EDayOfWeek.Sunday]);

/** Whether the author is likely at the keyboard at `now`, given in their own time zone. */
export function resolveAvailability(
  now: Temporal.ZonedDateTime,
  window: IAvailabilityWindow
): IAvailability {
  const isAwake = now.hour >= window.awakeStartHour && now.hour < window.awakeEndHour;
  if (WEEKEND_DAYS.has(now.dayOfWeek)) {
    return { status: 'weekend', isAwake };
  }
  return { status: isAwake ? 'online' : 'away', isAwake };
}
