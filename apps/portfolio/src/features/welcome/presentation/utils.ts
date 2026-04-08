import { Temporal, Intl as TemporalIntl } from '@js-temporal/polyfill';
import { isNil } from 'lodash-es';

export function getYearsOfExperience(careerStart: Temporal.PlainDate): number {
  const today = Temporal.Now.plainDateISO();
  return today.since(careerStart, { smallestUnit: 'years', largestUnit: 'years' }).years;
}

export function getAge(): number {
  const birth = new Temporal.PlainDate(1982, 11, 10);
  const today = Temporal.Now.plainDateISO();

  const duration = today.since(birth, { smallestUnit: 'years', largestUnit: 'years' });

  return duration.years;
}

export function measureDuration(
  start: Temporal.PlainDate,
  end = Temporal.Now.plainDateISO()
): string {
  const duration = end.since(start, { smallestUnit: 'months', largestUnit: 'years' });

  const years = duration.years > 0 ? formatNumber(duration.years, ['year', 'years']) : undefined;
  const months =
    duration.months > 0 ? formatNumber(duration.months, ['month', 'months']) : undefined;

  if (isNil(years) || isNil(months)) {
    return years || months || 'less than a month';
  }

  return `${years} ${months}`;
}

function formatNumber(
  value: number,
  forms: [string, string] | [string, string, string, string]
): string {
  const enOrdinalRules = new Intl.PluralRules('en-US', { type: 'ordinal' });

  const suffixes = new Map([
    ['one', forms[0]],
    ['two', forms[1]],
    ['few', forms[2] ?? forms[1]],
    ['other', forms[3] ?? forms[1]],
  ]);

  const rule = enOrdinalRules.select(value);
  const suffix = suffixes.get(rule);

  return `${value} ${suffix}`;
}

export function formatDateMonthYear(date: Temporal.PlainDate): string {
  return TemporalIntl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}
