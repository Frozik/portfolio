import { DateTimePicker, useFunction, useToday } from '@frozik/components';
import {
  EDateTimeStep,
  EDayOfWeek,
  EDayType,
  ETimeResolution,
  parseFuzzyDate,
} from '@frozik/utils';
import { Temporal } from '@js-temporal/polyfill';
import type { ReactNode } from 'react';
import { memo, useState } from 'react';

import { getCurrentLanguage } from '../../../../shared/i18n';
import { RadioGroup } from '../../../../shared/ui';
import { controlsT } from '../translations';

function Kbd({ children }: { children: ReactNode }): ReactNode {
  return (
    <kbd className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text">
      {children}
    </kbd>
  );
}

const TIME_ZONE = Temporal.Now.timeZoneId();
const WEEKEND_DAYS = new Set([EDayOfWeek.Saturday, EDayOfWeek.Sunday]);

const NEAREST_OPTIONS = [
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

export const DatePage = memo(() => {
  const today = useToday(TIME_ZONE);
  const [value, setValue] = useState<Temporal.ZonedDateTime | undefined>(undefined);
  const [step, setStep] = useState<EDateTimeStep>(EDateTimeStep.Day);
  const [timeResolution, setTimeResolution] = useState<ETimeResolution>(ETimeResolution.Minutes);
  const [nearest, setNearest] = useState(false);

  const parseInput = useFunction((input: string) =>
    parseFuzzyDate(input, {
      now: Temporal.Now.zonedDateTimeISO(TIME_ZONE),
      nearest,
    })
  );

  return (
    <section className="mx-auto max-w-2xl space-y-8 px-6 py-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-text">
          {controlsT.datePage.title}
        </h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          {controlsT.datePage.description}{' '}
          <kbd className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text">
            ↑
          </kbd>{' '}
          <kbd className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text">
            ↓
          </kbd>{' '}
          {controlsT.datePage.stepInstruction}
        </p>
        <ul className="mt-2 space-y-1 text-sm text-text-secondary">
          <li>
            <span className="text-text-secondary">{controlsT.datePage.categories.keywords}</span>{' '}
            <Kbd>today</Kbd> <Kbd>tomorrow</Kbd> <Kbd>tom</Kbd> <Kbd>yesterday</Kbd> <Kbd>now</Kbd>{' '}
            <Kbd>noon</Kbd> <Kbd>midday</Kbd> <Kbd>midnight</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">{controlsT.datePage.categories.boundaries}</span>{' '}
            <Kbd>eom</Kbd> <Kbd>bom</Kbd> <Kbd>eoy</Kbd> <Kbd>boy</Kbd> <Kbd>eoq</Kbd>,{' '}
            <Kbd>end of month</Kbd> <Kbd>start of year</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">{controlsT.datePage.categories.weekdays}</span>{' '}
            <Kbd>mon</Kbd>–<Kbd>sun</Kbd>, <Kbd>monday</Kbd>–<Kbd>sunday</Kbd>, <Kbd>next fri</Kbd>,{' '}
            <Kbd>last monday</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">{controlsT.datePage.categories.offsets}</span>{' '}
            <Kbd>+3d</Kbd> <Kbd>-1w</Kbd> <Kbd>2m</Kbd> <Kbd>1y</Kbd>, <Kbd>in 3 days</Kbd>,{' '}
            <Kbd>2 weeks ago</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">{controlsT.datePage.categories.dates}</span>{' '}
            <Kbd>2025-01-15</Kbd> <Kbd>15/03/2025</Kbd> <Kbd>15.03.2025</Kbd> <Kbd>15 jan 2025</Kbd>{' '}
            <Kbd>jan 15 25</Kbd> <Kbd>15 06 27</Kbd> <Kbd>10nov</Kbd> <Kbd>nov10</Kbd>{' '}
            <Kbd>15nov2025</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">{controlsT.datePage.categories.months}</span>{' '}
            <Kbd>jan</Kbd> <Kbd>december</Kbd> <Kbd>january 2027</Kbd> <Kbd>jan &apos;27</Kbd>{' '}
            <Kbd>2027-01</Kbd> <Kbd>01/2027</Kbd> <Kbd>2027 jan</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">{controlsT.datePage.categories.quarters}</span>{' '}
            <Kbd>Q1</Kbd> <Kbd>Q2 2025</Kbd> <Kbd>Q3/2025</Kbd> <Kbd>1Q25</Kbd> <Kbd>4Q2025</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">{controlsT.datePage.categories.ordinals}</span>{' '}
            <Kbd>15th</Kbd> <Kbd>the 1st</Kbd> <Kbd>22nd</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">{controlsT.datePage.categories.time}</span>{' '}
            <Kbd>13:00</Kbd> <Kbd>9:30:45</Kbd> <Kbd>9:30:45.123</Kbd> <Kbd>9am</Kbd>{' '}
            <Kbd>5:30pm</Kbd> <Kbd>12am</Kbd> <Kbd>12pm</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">{controlsT.datePage.categories.dateTime}</span>{' '}
            <Kbd>tom 13:00</Kbd> <Kbd>mon 9am</Kbd> <Kbd>next fri 17:00</Kbd>{' '}
            <Kbd>last mon 9am</Kbd> <Kbd>+3d 8:00</Kbd> <Kbd>eom 23:59</Kbd>{' '}
            <Kbd>15 jan 2025 14:30</Kbd>
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated/50 p-6">
        <DateTimePicker
          value={value}
          onValueChange={setValue}
          timeZone={TIME_ZONE}
          onParseInput={parseInput}
          getDayInfo={getDayInfo}
          step={step}
          timeResolution={timeResolution}
          placeholder={controlsT.datePage.placeholder}
          today={today}
          language={getCurrentLanguage()}
        />
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <span className="mb-2 block text-sm font-medium text-text">
            {controlsT.datePage.arrowKeyStep}
          </span>
          <RadioGroup
            options={STEP_OPTIONS}
            value={step}
            onChange={setStep as (value: string) => void}
            optionType="button"
          />
        </div>

        <div className="space-y-3">
          <span className="mb-2 block text-sm font-medium text-text">
            {controlsT.datePage.timePrecision}
          </span>
          <RadioGroup
            options={TIME_RESOLUTION_OPTIONS}
            value={timeResolution}
            onChange={setTimeResolution as (value: string) => void}
            optionType="button"
          />
        </div>

        <div className="space-y-3">
          <span className="mb-2 block text-sm font-medium text-text">
            {controlsT.datePage.parseDirection}
          </span>
          <RadioGroup
            options={NEAREST_OPTIONS}
            value={nearest ? 'nearest' : 'future'}
            onChange={(v: string) => setNearest(v === 'nearest')}
            optionType="button"
          />
          <p className="text-xs text-text-secondary">
            {nearest ? controlsT.datePage.nearestHint : controlsT.datePage.futureHint}
          </p>
        </div>

        {value !== undefined && (
          <div className="rounded-lg border border-border bg-surface-elevated/30 px-4 py-3">
            <span className="text-xs font-medium text-text-secondary">
              {controlsT.datePage.resolvedValue}
            </span>
            <p className="mt-1 font-mono text-sm text-text">{value.toString()}</p>
          </div>
        )}
      </div>
    </section>
  );
});
