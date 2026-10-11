import type { Milliseconds } from '@frozik/utils/date/types';
import { Temporal } from 'temporal-polyfill';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IMF_FIXDATE = /^\w{3}, (\d{2}) (\w{3}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/;
const FIRST_MONTH = 1;

/** RFC 9110 §5.6.7 — the one date format a server must send (`getlastmodified`); `null` for any other. */
export function parseHttpDate(text: string): Milliseconds | null {
  const match = IMF_FIXDATE.exec(text.trim());
  if (match === null) {
    return null;
  }
  const [, day, monthName, year, hour, minute, second] = match;
  const month = MONTHS.indexOf(monthName ?? '');
  if (month < 0) {
    return null;
  }
  return Temporal.ZonedDateTime.from({
    timeZone: 'UTC',
    year: Number(year),
    month: month + FIRST_MONTH,
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  }).epochMilliseconds as Milliseconds;
}
