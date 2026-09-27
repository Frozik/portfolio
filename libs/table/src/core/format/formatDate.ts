import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

export type TDateStyle = 'date' | 'datetime' | 'time' | 'datetimeSeconds';

export interface IDateFormat {
  readonly locale?: string;
  readonly timeZone?: string;
  readonly style?: TDateStyle;
  readonly empty?: string;
}

const OPTIONS: Readonly<Record<TDateStyle, Intl.DateTimeFormatOptions>> = {
  date: { year: 'numeric', month: '2-digit', day: '2-digit' },
  datetime: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  },
  datetimeSeconds: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  },
  time: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
};

type TDateValue =
  | string
  | Temporal.Instant
  | Temporal.ZonedDateTime
  | Temporal.PlainDate
  | Temporal.PlainDateTime;

function toZoned(value: TDateValue, timeZone: string): Temporal.ZonedDateTime | Temporal.PlainDate {
  if (typeof value === 'string') {
    return value.includes('T')
      ? Temporal.Instant.from(value).toZonedDateTimeISO(timeZone)
      : Temporal.PlainDate.from(value);
  }
  if (value instanceof Temporal.Instant) {
    return value.toZonedDateTimeISO(timeZone);
  }
  if (value instanceof Temporal.PlainDateTime) {
    return value.toZonedDateTime(timeZone);
  }
  return value;
}

/** `Intl.DateTimeFormat` is expensive to build and cheap to reuse; cells format thousands of values with the same options. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(
  locale: string | undefined,
  timeZone: string,
  style: TDateStyle
): Intl.DateTimeFormat {
  const key = `${locale ?? ''}|${timeZone}|${style}`;
  const cached = formatters.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat(locale, { ...OPTIONS[style], timeZone });
  formatters.set(key, formatter);
  return formatter;
}

/** Formats an ISO string or a Temporal value with Intl, in the given time zone. */
export function formatDate(value: TDateValue | null | undefined, format: IDateFormat = {}): string {
  if (isNil(value) || value === '') {
    return format.empty ?? '';
  }
  const timeZone = format.timeZone ?? Temporal.Now.timeZoneId();
  const style = format.style ?? 'datetime';
  if (typeof value === 'string' && value.includes('T')) {
    return formatterFor(format.locale, timeZone, style).format(
      Temporal.Instant.from(value).epochMilliseconds
    );
  }
  if (value instanceof Temporal.Instant) {
    return formatterFor(format.locale, timeZone, style).format(value.epochMilliseconds);
  }
  const zoned = toZoned(value, timeZone);
  if (zoned instanceof Temporal.PlainDate) {
    return zoned.toLocaleString(format.locale, OPTIONS.date);
  }
  return zoned.toLocaleString(format.locale, OPTIONS[style]);
}
