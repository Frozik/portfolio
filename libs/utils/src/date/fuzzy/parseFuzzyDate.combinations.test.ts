import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { parseFuzzyDate } from './parseFuzzyDate';

interface IWritten<Value> {
  readonly form: string;
  readonly text: string;
  readonly value: Value;
}

const now = Temporal.ZonedDateTime.from('2024-06-15T14:00:00[UTC]');
const today = now.toPlainDate();

const DAYS = [5, 25];
const MONTHS = [
  { month: 3, name: 'mar' },
  { month: 11, name: 'November' },
];
const YEARS = [
  { written: '27', year: 2027 },
  { written: '99', year: 1999 },
  { written: '2025', year: 2025 },
];

function padded(value: number): string {
  return String(value).padStart(2, '0');
}

function upcoming(month: number, day: number): Temporal.PlainDate {
  const thisYear = Temporal.PlainDate.from({ year: today.year, month, day });
  return Temporal.PlainDate.compare(thisYear, today) >= 0 ? thisYear : thisYear.add({ years: 1 });
}

const DATES: readonly IWritten<Temporal.PlainDate>[] = DAYS.flatMap(day =>
  MONTHS.flatMap(({ month, name }) => [
    ...[
      ['D/M', `${day}/${month}`],
      ['DD.MM', `${padded(day)}.${padded(month)}`],
      ['D mon', `${day} ${name}`],
      ['mon D', `${name} ${day}`],
      ['Dmon', `${day}${name}`],
      ['monD', `${name}${day}`],
      ['Dth mon', `${day}th ${name}`],
      ['mon Dth', `${name} ${day}th`],
      ['D-mon', `${day}-${name}`],
    ].map(([form, text]) => ({ form, text, value: upcoming(month, day) })),
    ...YEARS.flatMap(({ written, year }) =>
      [
        ['D/M/Y', `${day}/${month}/${written}`],
        ['DD.MM.Y', `${padded(day)}.${padded(month)}.${written}`],
        ['D-M-Y', `${day}-${month}-${written}`],
        ['D MM Y', `${day} ${padded(month)} ${written}`],
        ['D mon Y', `${day} ${name} ${written}`],
        ['mon D Y', `${name} ${day} ${written}`],
        ['mon D, Y', `${name} ${day}, ${written}`],
        ['Dth mon Y', `${day}th ${name} ${written}`],
        ['mon Dth, Y', `${name} ${day}th, ${written}`],
        ['D-mon-Y', `${day}-${name}-${written}`],
        ['D/mon/Y', `${day}/${name}/${written}`],
        ["D mon 'YY", `${day} ${name} '${written.slice(-2)}`],
      ].map(([form, text]) => ({
        form,
        text,
        value: Temporal.PlainDate.from({ year, month, day }),
      }))
    ),
    ...[
      ['YYYY-MM-DD', `2025-${padded(month)}-${padded(day)}`],
      ['YYYY/M/D', `2025/${month}/${day}`],
      ['YYYY M D', `2025 ${month} ${day}`],
      ['DmonYYYY', `${day}${name}2025`],
    ].map(([form, text]) => ({
      form,
      text,
      value: Temporal.PlainDate.from({ year: 2025, month, day }),
    })),
  ])
);

/** Two bare numbers alone are a time — "5 03" is 5:03 — and a date only beside a time that marks itself. */
const BARE_DAY_AND_MONTH: readonly IWritten<Temporal.PlainDate>[] = DAYS.flatMap(day =>
  MONTHS.map(({ month }) => ({
    form: 'D MM',
    text: `${day} ${padded(month)}`,
    value: upcoming(month, day),
  }))
);

const WORDS: readonly IWritten<Temporal.PlainDate>[] = [
  ['today', '2024-06-15'],
  ['tom', '2024-06-16'],
  ['yesterday', '2024-06-14'],
  ['mon', '2024-06-17'],
  ['next fri', '2024-06-21'],
  ['last mon', '2024-06-10'],
  ['eom', '2024-06-30'],
  ['start of year', '2025-01-01'],
  ['+3d', '2024-06-18'],
  ['in 2 weeks', '2024-06-29'],
  ['2 weeks ago', '2024-06-01'],
  ['Q2 2025', '2025-04-01'],
  ['1Q25', '2025-01-01'],
  ['the 25th', '2024-06-25'],
  ["mar '27", '2027-03-01'],
  ['2027-03', '2027-03-01'],
  ['03/2027', '2027-03-01'],
].map(([text, date]) => ({ form: text, text, value: Temporal.PlainDate.from(date) }));

/** A time that marks itself as one — by a colon, by am or pm, by a word — and so may stand on either side of the date. */
const MARKED_TIMES: readonly IWritten<Temporal.PlainTime>[] = [
  ['H:MM', '8:05', '08:05'],
  ['HH:MM', '17:30', '17:30'],
  ['H:MM:SS', '8:05:45', '08:05:45'],
  ['H:MM:SS.mmm', '17:30:45.123', '17:30:45.123'],
  ['Ham', '8am', '08:00'],
  ['Hpm', '5pm', '17:00'],
  ['H:MMpm', '5:30pm', '17:30'],
  ['H pm', '5 pm', '17:00'],
  ['H:MM pm', '5:30 pm', '17:30'],
  ['noon', 'noon', '12:00'],
  ['midnight', 'midnight', '00:00'],
  ['H:MM SS', '8:05 45', '08:05:45'],
  ['H:MM SS mmm', '17:30 45 900', '17:30:45.9'],
].map(([form, text, time]) => ({ form, text, value: Temporal.PlainTime.from(time) }));

/** Bare numbers are a time only by their place: after the date. */
const BARE_TIMES: readonly IWritten<Temporal.PlainTime>[] = [
  ['H', '8', '08:00'],
  ['HH', '17', '17:00'],
  ['H MM', '8 05', '08:05'],
  ['HH MM', '17 30', '17:30'],
  ['HH MM SS', '17 30 45', '17:30:45'],
  ['HH MM SS mmm', '17 30 45 900', '17:30:45.9'],
].map(([form, text, time]) => ({ form, text, value: Temporal.PlainTime.from(time) }));

function parsed(input: string): string | false {
  const result = parseFuzzyDate(input, {
    now: now.toInstant(),
    timeZone: now.timeZoneId,
    nearest: true,
  });
  return result.success && result.value.toPlainDateTime().toString();
}

function misread(
  inputs: readonly { readonly text: string; readonly expected: string }[]
): readonly string[] {
  return inputs
    .filter(({ text, expected }) => parsed(text) !== expected)
    .map(({ text, expected }) => `"${text}" → ${parsed(text)}, expected ${expected}`);
}

describe('parseFuzzyDate — every way to write a date with every way to write a time', () => {
  const allDates = [...DATES, ...WORDS];

  it('reads every date on its own', () => {
    expect(
      misread(
        allDates.map(({ text, value }) => ({ text, expected: value.toPlainDateTime().toString() }))
      )
    ).toEqual([]);
  });

  it('reads every time on its own as a time of today', () => {
    expect(
      misread(
        MARKED_TIMES.map(({ text, value }) => ({
          text,
          expected: today.toPlainDateTime(value).toString(),
        }))
      )
    ).toEqual([]);
  });

  it.each(MARKED_TIMES)('reads the time $form on either side of a bare day and month', time => {
    expect(
      misread(
        BARE_DAY_AND_MONTH.flatMap(date =>
          [`${date.text} ${time.text}`, `${time.text} ${date.text}`].map(text => ({
            text,
            expected: date.value.toPlainDateTime(time.value).toString(),
          }))
        )
      )
    ).toEqual([]);
  });

  it.each([...MARKED_TIMES, ...BARE_TIMES])('reads the time $form after every date', time => {
    expect(
      misread(
        allDates.map(date => ({
          text: `${date.text} ${time.text}`,
          expected: date.value.toPlainDateTime(time.value).toString(),
        }))
      )
    ).toEqual([]);
  });

  it.each(MARKED_TIMES)('reads the time $form before every date', time => {
    expect(
      misread(
        allDates.map(date => ({
          text: `${time.text} ${date.text}`,
          expected: date.value.toPlainDateTime(time.value).toString(),
        }))
      )
    ).toEqual([]);
  });
});
