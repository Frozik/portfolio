import { getStartOfWeek } from '@frozik/utils/date/boundaries';
import type { EDayOfWeek } from '@frozik/utils/date/constants';
import { DAYS_IN_WEEK } from '@frozik/utils/date/constants';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

/** The day a calendar key moves the active date to; `undefined` for keys the grid does not use. */
export function moveActiveDate(
  active: Temporal.PlainDate,
  key: string,
  shiftKey: boolean,
  startOfWeek: EDayOfWeek
): Temporal.PlainDate | undefined {
  switch (key) {
    case 'ArrowLeft':
      return active.subtract({ days: 1 });
    case 'ArrowRight':
      return active.add({ days: 1 });
    case 'ArrowUp':
      return active.subtract({ days: DAYS_IN_WEEK });
    case 'ArrowDown':
      return active.add({ days: DAYS_IN_WEEK });
    case 'PageUp':
      return shiftKey ? active.subtract({ years: 1 }) : active.subtract({ months: 1 });
    case 'PageDown':
      return shiftKey ? active.add({ years: 1 }) : active.add({ months: 1 });
    case 'Home':
      return getStartOfWeek(active, startOfWeek);
    case 'End':
      return getStartOfWeek(active, startOfWeek).add({ days: DAYS_IN_WEEK - 1 });
    default:
      return undefined;
  }
}

export function clampDate(
  date: Temporal.PlainDate,
  minDate: Temporal.PlainDate | undefined,
  maxDate: Temporal.PlainDate | undefined
): Temporal.PlainDate {
  if (!isNil(minDate) && Temporal.PlainDate.compare(date, minDate) < 0) {
    return minDate;
  }
  if (!isNil(maxDate) && Temporal.PlainDate.compare(date, maxDate) > 0) {
    return maxDate;
  }
  return date;
}
