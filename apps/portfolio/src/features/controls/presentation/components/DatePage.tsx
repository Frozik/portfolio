import { DateTimePicker } from '@frozik/components/components/RichEditor/DateTimePicker';
import { useToday } from '@frozik/components/hooks/useToday';
import { EDateTimeStep, EDayOfWeek, EDayType, ETimeResolution } from '@frozik/utils/date/constants';
import { getNowInstant } from '@frozik/utils/date/now';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { Fragment } from 'react';
import type { Temporal } from 'temporal-polyfill';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { CardFrame } from '../../../../shared/ui/CardFrame';
import { MonoKicker } from '../../../../shared/ui/MonoKicker';
import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import { SectionNumber } from '../../../../shared/ui/SectionNumber';
import type { ParseDirection } from '../../application/ControlsDemoStore';
import { useControlsDemoStore } from '../../application/useControlsDemoStore';
import { controlsT } from '../translations';
import { Kbd } from './Kbd';

const WEEKEND_DAYS = new Set([EDayOfWeek.Saturday, EDayOfWeek.Sunday]);

const DEFAULT_TOKEN_SEPARATOR = ' ';

type FormatToken = { readonly text: string; readonly after?: string };

type FormatCategory = {
  readonly id: string;
  readonly label: ReactNode;
  readonly tokens: ReadonlyArray<FormatToken>;
};

const FORMAT_CATEGORIES: ReadonlyArray<FormatCategory> = [
  {
    id: 'keywords',
    label: controlsT.datePage.categories.keywords,
    tokens: [
      { text: 'today' },
      { text: 'tomorrow' },
      { text: 'tom' },
      { text: 'yesterday' },
      { text: 'day after tomorrow' },
      { text: 'tonight' },
      { text: 'tomorrow morning' },
      { text: 'now' },
      { text: 'noon' },
      { text: 'midday' },
      { text: 'midnight' },
    ],
  },
  {
    id: 'boundaries',
    label: controlsT.datePage.categories.boundaries,
    tokens: [
      { text: 'eom' },
      { text: 'bom' },
      { text: 'eoy' },
      { text: 'boy' },
      { text: 'eoq' },
      { text: 'eow' },
      { text: 'bow' },
      { text: 'eod', after: ', ' },
      { text: 'end of month', after: ', ' },
      { text: 'start of year', after: ', ' },
      { text: 'end of next month' },
    ],
  },
  {
    id: 'weekdays',
    label: controlsT.datePage.categories.weekdays,
    tokens: [
      { text: 'mon', after: '–' },
      { text: 'sun', after: ', ' },
      { text: 'monday', after: '–' },
      { text: 'sunday', after: ', ' },
      { text: 'next fri', after: ', ' },
      { text: 'this fri', after: ', ' },
      { text: 'next weekend', after: ', ' },
      { text: 'last monday', after: ', ' },
      { text: 'wed 15 jan 2025' },
    ],
  },
  {
    id: 'offsets',
    label: controlsT.datePage.categories.offsets,
    tokens: [
      { text: '+3d' },
      { text: '-1w' },
      { text: '2m' },
      { text: '1y' },
      { text: '+4h' },
      { text: '30min' },
      { text: '30s' },
      { text: '1h30min' },
      { text: '1.5h', after: ', ' },
      { text: 'in 3 days', after: ', ' },
      { text: 'in 2 hours', after: ', ' },
      { text: 'in an hour', after: ', ' },
      { text: '2 weeks ago', after: ', ' },
      { text: 'a week ago', after: ', ' },
      { text: 'next week' },
    ],
  },
  {
    id: 'dates',
    label: controlsT.datePage.categories.dates,
    tokens: [
      { text: '2025-01-15' },
      { text: '15/03/2025' },
      { text: '15.03.2025' },
      { text: '15 jan 2025' },
      { text: 'jan 15 25' },
      { text: '15 06 27' },
      { text: '10nov' },
      { text: 'nov10' },
      { text: '15nov2025' },
      { text: 'sept 15', after: ', ' },
      { text: '1st of january' },
    ],
  },
  {
    id: 'months',
    label: controlsT.datePage.categories.months,
    tokens: [
      { text: 'jan' },
      { text: 'december' },
      { text: 'january 2027' },
      { text: "jan '27" },
      { text: '2027-01' },
      { text: '01/2027' },
      { text: '2027 jan' },
    ],
  },
  {
    id: 'quarters',
    label: controlsT.datePage.categories.quarters,
    tokens: [
      { text: 'Q1' },
      { text: 'Q2 2025' },
      { text: 'Q3/2025' },
      { text: '1Q25' },
      { text: '4Q2025' },
    ],
  },
  {
    id: 'ordinals',
    label: controlsT.datePage.categories.ordinals,
    tokens: [{ text: '15th' }, { text: 'the 1st' }, { text: '22nd' }],
  },
  {
    id: 'time',
    label: controlsT.datePage.categories.time,
    tokens: [
      { text: '13:00' },
      { text: '9:30:45' },
      { text: '9:30:45.123' },
      { text: '10 30' },
      { text: '9am' },
      { text: '5:30pm' },
      { text: '12am' },
      { text: '12pm' },
      { text: '9.30pm', after: ', ' },
      { text: '9 p.m.' },
    ],
  },
  {
    id: 'dateTime',
    label: controlsT.datePage.categories.dateTime,
    tokens: [
      { text: 'tom 13:00' },
      { text: 'tomorrow at 5pm', after: ', ' },
      { text: 'mon 9am' },
      { text: 'next fri 17:00' },
      { text: 'last mon 9am' },
      { text: '+3d 8:00' },
      { text: 'eom 23:59' },
      { text: '15 jan 2025 14:30' },
      { text: '15 06 27 10 30' },
      { text: '8 30 15 06 27' },
    ],
  },
  {
    id: 'shifted',
    label: controlsT.datePage.categories.shifted,
    tokens: [
      { text: 'eom -4h' },
      { text: 'end-of-month -4h' },
      { text: 'tom 13:00 +30min' },
      { text: 'mon +1w' },
      { text: '15 jan 2025 -1d' },
    ],
  },
];

const DIRECTION_OPTIONS: readonly { readonly label: string; readonly value: ParseDirection }[] = [
  { label: controlsT.datePage.futureOnly, value: 'future' },
  { label: controlsT.datePage.nearest, value: 'nearest' },
];

const STEP_OPTIONS = [
  { label: controlsT.datePage.stepMinute, value: EDateTimeStep.Minute },
  { label: controlsT.datePage.stepHour, value: EDateTimeStep.Hour },
  { label: controlsT.datePage.stepDay, value: EDateTimeStep.Day },
  { label: controlsT.datePage.stepWeek, value: EDateTimeStep.Week },
];

const TIME_RESOLUTION_OPTIONS = [
  { label: controlsT.datePage.resolutionMinutes, value: ETimeResolution.Minutes },
  { label: controlsT.datePage.resolutionSeconds, value: ETimeResolution.Seconds },
  { label: controlsT.datePage.resolutionMilliseconds, value: ETimeResolution.Milliseconds },
];

function getDayInfo(date: Temporal.PlainDate): EDayType {
  if (WEEKEND_DAYS.has(date.dayOfWeek)) {
    return EDayType.Weekend;
  }

  return EDayType.Business;
}

export const DatePage = observer(() => {
  const store = useControlsDemoStore();
  const today = useToday(store.timeZone);
  const { dateValue: value, step, timeResolution, direction } = store;

  return (
    <section className="flex flex-col gap-5">
      <SectionNumber number="03" label={controlsT.datePage.sectionKicker} />
      <h2 className="text-[24px] font-medium text-landing-fg">{controlsT.datePage.title}</h2>
      <p className="text-[14px] leading-[1.55] text-landing-fg-dim">
        {controlsT.datePage.description} <Kbd>↑</Kbd> <Kbd>↓</Kbd>{' '}
        {controlsT.datePage.stepInstruction}
      </p>
      <ul className="flex flex-col gap-1.5">
        {FORMAT_CATEGORIES.map(category => (
          <li
            key={category.id}
            className="flex flex-wrap items-baseline gap-1.5 text-[13px] leading-[1.6] text-landing-fg-dim"
          >
            <MonoKicker tone="faint" className="mr-1">
              {category.label}
            </MonoKicker>
            {category.tokens.map((token, tokenIndex) => (
              <Fragment key={token.text}>
                <Kbd>{token.text}</Kbd>
                {tokenIndex < category.tokens.length - 1
                  ? (token.after ?? DEFAULT_TOKEN_SEPARATOR)
                  : null}
              </Fragment>
            ))}
          </li>
        ))}
      </ul>

      <CardFrame className="p-6">
        <DateTimePicker
          value={value}
          onValueChange={store.setDateValue}
          timeZone={store.timeZone}
          getNow={getNowInstant}
          onParseInput={store.parseDate}
          getDayInfo={getDayInfo}
          step={step}
          timeResolution={timeResolution}
          placeholder={controlsT.datePage.placeholder}
          today={today}
          locale={getCurrentLanguage()}
        />
      </CardFrame>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <MonoKicker tone="faint">{controlsT.datePage.arrowKeyStep}</MonoKicker>
          <RadioGroup
            options={STEP_OPTIONS}
            value={step}
            onChange={store.setStep}
            optionType="button"
          />
        </div>

        <div className="flex flex-col gap-3">
          <MonoKicker tone="faint">{controlsT.datePage.timePrecision}</MonoKicker>
          <RadioGroup
            options={TIME_RESOLUTION_OPTIONS}
            value={timeResolution}
            onChange={store.setTimeResolution}
            optionType="button"
          />
        </div>

        <div className="flex flex-col gap-3">
          <MonoKicker tone="faint">{controlsT.datePage.parseDirection}</MonoKicker>
          <RadioGroup
            options={DIRECTION_OPTIONS}
            value={direction}
            onChange={store.setDirection}
            optionType="button"
          />
          <p className="text-xs text-landing-fg-faint">
            {direction === 'nearest'
              ? controlsT.datePage.nearestHint
              : controlsT.datePage.futureHint}
          </p>
        </div>

        {!isNil(value) && (
          <CardFrame className="px-4 py-3">
            <MonoKicker tone="faint">{controlsT.datePage.resolvedKicker}</MonoKicker>
            <p className="mt-1 font-mono text-sm text-landing-fg">{value.toString()}</p>
          </CardFrame>
        )}
      </div>
    </section>
  );
});
