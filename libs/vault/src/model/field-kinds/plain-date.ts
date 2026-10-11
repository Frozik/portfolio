import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DOTTED_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

function plainDate(year: number, month: number, day: number): Temporal.PlainDate | null {
  try {
    return new Temporal.PlainDate(year, month, day, 'iso8601');
  } catch {
    return null;
  }
}

/** `2031-05-17` and `17.05.2031` are the same day; an impossible day (31.02) is no date. */
export function parsePlainDate(value: string): Temporal.PlainDate | null {
  const trimmed = value.trim();
  if (ISO_DATE.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    return plainDate(year ?? 0, month ?? 0, day ?? 0);
  }
  const dotted = DOTTED_DATE.exec(trimmed);
  return isNil(dotted) ? null : plainDate(Number(dotted[3]), Number(dotted[2]), Number(dotted[1]));
}
