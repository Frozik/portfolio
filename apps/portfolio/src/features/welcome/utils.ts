import { EDayOfWeek } from '@frozik/utils';
import { Temporal, Intl as TemporalIntl } from '@js-temporal/polyfill';
import { isNil } from 'lodash-es';
import { getCurrentLanguage } from '../../shared/i18n';
import { AWAKE_END_HOUR, AWAKE_START_HOUR, MY_TIMEZONE } from './constants';
import type { EAvailability } from './types';

const WEEKEND: readonly EDayOfWeek[] = [EDayOfWeek.Saturday, EDayOfWeek.Sunday];

const LOCALE_MAP = { en: 'en-GB', ru: 'ru-RU' } as const;
const DATE_LOCALE_MAP = { en: 'en-US', ru: 'ru-RU' } as const;

const AVAILABILITY_TITLES = {
  en: {
    weekend: (time: string) => `${time} UTC+3 — Weekend, day off`,
    online: (time: string) => `${time} UTC+3 — Working hours`,
    away: (time: string) => `${time} UTC+3 — Off hours, away`,
  },
  ru: {
    weekend: (time: string) => `${time} UTC+3 — Выходной`,
    online: (time: string) => `${time} UTC+3 — Рабочие часы`,
    away: (time: string) => `${time} UTC+3 — Нерабочее время`,
  },
} as const;

export function getAvailability(): { status: EAvailability; localTime: string; title: string } {
  const now = Temporal.Now.zonedDateTimeISO(MY_TIMEZONE);
  const hour = now.hour;
  const dayOfWeek = now.dayOfWeek;

  const localTime = now.toLocaleString(LOCALE_MAP[getCurrentLanguage()], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const titles = AVAILABILITY_TITLES[getCurrentLanguage()];

  const isWeekend = WEEKEND.includes(dayOfWeek as EDayOfWeek);
  if (isWeekend) {
    return { status: 'weekend', localTime, title: titles.weekend(localTime) };
  }

  const isAwake = hour >= AWAKE_START_HOUR && hour < AWAKE_END_HOUR;
  return isAwake
    ? { status: 'online', localTime, title: titles.online(localTime) }
    : { status: 'away', localTime, title: titles.away(localTime) };
}

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

const ENGLISH_PLURAL_FORMS: Record<string, [string, string]> = {
  year: ['year', 'years'],
  month: ['month', 'months'],
};

const RUSSIAN_PLURAL_FORMS: Record<string, [string, string, string]> = {
  year: ['год', 'года', 'лет'],
  month: ['месяц', 'месяца', 'месяцев'],
};

const LESS_THAN_A_MONTH = { en: 'less than a month', ru: 'менее месяца' } as const;

export function measureDuration(
  start: Temporal.PlainDate,
  end = Temporal.Now.plainDateISO()
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

const RUSSIAN_PLURAL_MOD_100_BOUNDARY = 100;
const RUSSIAN_PLURAL_MOD_10_BOUNDARY = 10;
const RUSSIAN_PLURAL_TEEN_START = 11;
const RUSSIAN_PLURAL_TEEN_END = 19;
const RUSSIAN_PLURAL_FEW_END = 4;

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
