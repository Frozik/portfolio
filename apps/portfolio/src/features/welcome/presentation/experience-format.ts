import { isNil } from 'lodash-es';
import { Temporal, Intl as TemporalIntl } from 'temporal-polyfill';

import { welcomeT } from './translations';

export function measureDuration(
  start: Temporal.PlainDate,
  end: Temporal.PlainDate = Temporal.Now.plainDateISO()
): string {
  const duration = end.since(start, { smallestUnit: 'months', largestUnit: 'years' });
  const years = duration.years > 0 ? welcomeT.duration.years(duration.years) : undefined;
  const months = duration.months > 0 ? welcomeT.duration.months(duration.months) : undefined;
  if (isNil(years) || isNil(months)) {
    return years ?? months ?? welcomeT.duration.lessThanAMonth;
  }
  return `${years} ${months}`;
}

export function formatDateMonthYear(date: Temporal.PlainDate): string {
  return TemporalIntl.DateTimeFormat(welcomeT.dateLocale, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}
