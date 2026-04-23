import { Temporal, Intl as TemporalIntl } from '@js-temporal/polyfill';
import { isNil } from 'lodash-es';

import { getCurrentLanguage } from '../../shared/i18n';

export function getYearsOfExperience(careerStart: Temporal.PlainDate): number {
  const today = Temporal.Now.plainDateISO();
  return today.since(careerStart, { smallestUnit: 'years', largestUnit: 'years' }).years;
}

const DATE_LOCALE_MAP = { en: 'en-US', ru: 'ru-RU' } as const;

const ENGLISH_PLURAL_FORMS: Record<string, [string, string]> = {
  year: ['year', 'years'],
  month: ['month', 'months'],
};

const RUSSIAN_PLURAL_FORMS: Record<string, [string, string, string]> = {
  year: ['год', 'года', 'лет'],
  month: ['месяц', 'месяца', 'месяцев'],
};

const LESS_THAN_A_MONTH = { en: 'less than a month', ru: 'менее месяца' } as const;

const RUSSIAN_PLURAL_MOD_100_BOUNDARY = 100;
const RUSSIAN_PLURAL_MOD_10_BOUNDARY = 10;
const RUSSIAN_PLURAL_TEEN_START = 11;
const RUSSIAN_PLURAL_TEEN_END = 19;
const RUSSIAN_PLURAL_FEW_END = 4;

export function measureDuration(
  start: Temporal.PlainDate,
  end: Temporal.PlainDate = Temporal.Now.plainDateISO()
): string {
  const duration = end.since(start, { smallestUnit: 'months', largestUnit: 'years' });

  const years = duration.years > 0 ? formatNumber(duration.years, 'year') : undefined;
  const months = duration.months > 0 ? formatNumber(duration.months, 'month') : undefined;

  if (isNil(years) || isNil(months)) {
    return years || months || LESS_THAN_A_MONTH[getCurrentLanguage()];
  }

  return `${years} ${months}`;
}

function formatNumber(value: number, unit: string): string {
  if (getCurrentLanguage() === 'ru') {
    const forms = RUSSIAN_PLURAL_FORMS[unit];
    return `${value} ${pluralizeRussian(value, forms[0], forms[1], forms[2])}`;
  }

  const forms = ENGLISH_PLURAL_FORMS[unit];
  return `${value} ${value === 1 ? forms[0] : forms[1]}`;
}

function pluralizeRussian(value: number, one: string, few: string, many: string): string {
  const mod100 = value % RUSSIAN_PLURAL_MOD_100_BOUNDARY;
  const mod10 = value % RUSSIAN_PLURAL_MOD_10_BOUNDARY;

  if (mod100 >= RUSSIAN_PLURAL_TEEN_START && mod100 <= RUSSIAN_PLURAL_TEEN_END) {
    return many;
  }
  if (mod10 === 1) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= RUSSIAN_PLURAL_FEW_END) {
    return few;
  }
  return many;
}

export function formatDateMonthYear(date: Temporal.PlainDate): string {
  return TemporalIntl.DateTimeFormat(DATE_LOCALE_MAP[getCurrentLanguage()], {
    month: 'long',
    year: 'numeric',
  }).format(date);
}
