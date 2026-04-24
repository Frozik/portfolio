import { DateTimePicker, useFunction, useToday } from '@frozik/components';
import {
  EDateTimeStep,
  EDayOfWeek,
  EDayType,
  ETimeResolution,
  parseFuzzyDate,
} from '@frozik/utils';
import { Temporal } from '@js-temporal/polyfill';
import { memo, useState } from 'react';

import { getCurrentLanguage } from '../../../../shared/i18n';
import { CardFrame, MonoKicker, RadioGroup, SectionNumber } from '../../../../shared/ui';
import { controlsT } from '../translations';
import { Kbd } from './Kbd';

const TIME_ZONE = Temporal.Now.timeZoneId();
const WEEKEND_DAYS = new Set([EDayOfWeek.Saturday, EDayOfWeek.Sunday]);
const NEAREST_VALUE = 'nearest';

const NEAREST_OPTIONS = [
  { label: controlsT.datePage.futureOnly, value: 'future' },
  { label: controlsT.datePage.nearest, value: NEAREST_VALUE },
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

  const handleStepChange = useFunction((next: string) => {
    setStep(next as EDateTimeStep);
  });

  const handleResolutionChange = useFunction((next: string) => {
    setTimeResolution(next as ETimeResolution);
  });

  const handleNearestChange = useFunction((next: string) => {
    setNearest(next === NEAREST_VALUE);
  });

  return (
    <section className="flex flex-col gap-5">
      <SectionNumber number="03" label={controlsT.datePage.sectionKicker} />
      <h2 className="text-[24px] font-medium text-landing-fg">{controlsT.datePage.title}</h2>
      <p className="text-[14px] leading-[1.55] text-landing-fg-dim">
        {controlsT.datePage.description} <Kbd>↑</Kbd> <Kbd>↓</Kbd>{' '}
        {controlsT.datePage.stepInstruction}
      </p>
      <ul className="flex flex-col gap-1.5">
        <li className="flex flex-wrap items-baseline gap-1.5 text-[13px] leading-[1.6] text-landing-fg-dim">
          <MonoKicker tone="faint" className="mr-1">
            {controlsT.datePage.categories.keywords}
          </MonoKicker>
          <Kbd>today</Kbd> <Kbd>tomorrow</Kbd> <Kbd>tom</Kbd> <Kbd>yesterday</Kbd> <Kbd>now</Kbd>{' '}
          <Kbd>noon</Kbd> <Kbd>midday</Kbd> <Kbd>midnight</Kbd>
        </li>
        <li className="flex flex-wrap items-baseline gap-1.5 text-[13px] leading-[1.6] text-landing-fg-dim">
          <MonoKicker tone="faint" className="mr-1">
            {controlsT.datePage.categories.boundaries}
          </MonoKicker>
          <Kbd>eom</Kbd> <Kbd>bom</Kbd> <Kbd>eoy</Kbd> <Kbd>boy</Kbd> <Kbd>eoq</Kbd>,{' '}
          <Kbd>end of month</Kbd> <Kbd>start of year</Kbd>
        </li>
        <li className="flex flex-wrap items-baseline gap-1.5 text-[13px] leading-[1.6] text-landing-fg-dim">
          <MonoKicker tone="faint" className="mr-1">
            {controlsT.datePage.categories.weekdays}
          </MonoKicker>
          <Kbd>mon</Kbd>–<Kbd>sun</Kbd>, <Kbd>monday</Kbd>–<Kbd>sunday</Kbd>, <Kbd>next fri</Kbd>,{' '}
          <Kbd>last monday</Kbd>
        </li>
        <li className="flex flex-wrap items-baseline gap-1.5 text-[13px] leading-[1.6] text-landing-fg-dim">
          <MonoKicker tone="faint" className="mr-1">
            {controlsT.datePage.categories.offsets}
          </MonoKicker>
          <Kbd>+3d</Kbd> <Kbd>-1w</Kbd> <Kbd>2m</Kbd> <Kbd>1y</Kbd>, <Kbd>in 3 days</Kbd>,{' '}
          <Kbd>2 weeks ago</Kbd>
        </li>
        <li className="flex flex-wrap items-baseline gap-1.5 text-[13px] leading-[1.6] text-landing-fg-dim">
          <MonoKicker tone="faint" className="mr-1">
            {controlsT.datePage.categories.dates}
          </MonoKicker>
          <Kbd>2025-01-15</Kbd> <Kbd>15/03/2025</Kbd> <Kbd>15.03.2025</Kbd> <Kbd>15 jan 2025</Kbd>{' '}
          <Kbd>jan 15 25</Kbd> <Kbd>15 06 27</Kbd> <Kbd>10nov</Kbd> <Kbd>nov10</Kbd>{' '}
          <Kbd>15nov2025</Kbd>
        </li>
        <li className="flex flex-wrap items-baseline gap-1.5 text-[13px] leading-[1.6] text-landing-fg-dim">
          <MonoKicker tone="faint" className="mr-1">
            {controlsT.datePage.categories.months}
          </MonoKicker>
          <Kbd>jan</Kbd> <Kbd>december</Kbd> <Kbd>january 2027</Kbd> <Kbd>jan &apos;27</Kbd>{' '}
          <Kbd>2027-01</Kbd> <Kbd>01/2027</Kbd> <Kbd>2027 jan</Kbd>
        </li>
        <li className="flex flex-wrap items-baseline gap-1.5 text-[13px] leading-[1.6] text-landing-fg-dim">
          <MonoKicker tone="faint" className="mr-1">
            {controlsT.datePage.categories.quarters}
          </MonoKicker>
          <Kbd>Q1</Kbd> <Kbd>Q2 2025</Kbd> <Kbd>Q3/2025</Kbd> <Kbd>1Q25</Kbd> <Kbd>4Q2025</Kbd>
        </li>
        <li className="flex flex-wrap items-baseline gap-1.5 text-[13px] leading-[1.6] text-landing-fg-dim">
          <MonoKicker tone="faint" className="mr-1">
            {controlsT.datePage.categories.ordinals}
          </MonoKicker>
          <Kbd>15th</Kbd> <Kbd>the 1st</Kbd> <Kbd>22nd</Kbd>
        </li>
        <li className="flex flex-wrap items-baseline gap-1.5 text-[13px] leading-[1.6] text-landing-fg-dim">
          <MonoKicker tone="faint" className="mr-1">
            {controlsT.datePage.categories.time}
          </MonoKicker>
          <Kbd>13:00</Kbd> <Kbd>9:30:45</Kbd> <Kbd>9:30:45.123</Kbd> <Kbd>9am</Kbd>{' '}
          <Kbd>5:30pm</Kbd> <Kbd>12am</Kbd> <Kbd>12pm</Kbd>
        </li>
        <li className="flex flex-wrap items-baseline gap-1.5 text-[13px] leading-[1.6] text-landing-fg-dim">
          <MonoKicker tone="faint" className="mr-1">
            {controlsT.datePage.categories.dateTime}
          </MonoKicker>
          <Kbd>tom 13:00</Kbd> <Kbd>mon 9am</Kbd> <Kbd>next fri 17:00</Kbd> <Kbd>last mon 9am</Kbd>{' '}
          <Kbd>+3d 8:00</Kbd> <Kbd>eom 23:59</Kbd> <Kbd>15 jan 2025 14:30</Kbd>
        </li>
      </ul>

      <CardFrame className="p-6">
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
      </CardFrame>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <MonoKicker tone="faint">{controlsT.datePage.arrowKeyStep}</MonoKicker>
          <RadioGroup
            options={STEP_OPTIONS}
            value={step}
            onChange={handleStepChange}
            optionType="button"
          />
        </div>

        <div className="flex flex-col gap-3">
          <MonoKicker tone="faint">{controlsT.datePage.timePrecision}</MonoKicker>
          <RadioGroup
            options={TIME_RESOLUTION_OPTIONS}
            value={timeResolution}
            onChange={handleResolutionChange}
            optionType="button"
          />
        </div>

        <div className="flex flex-col gap-3">
          <MonoKicker tone="faint">{controlsT.datePage.parseDirection}</MonoKicker>
          <RadioGroup
            options={NEAREST_OPTIONS}
            value={nearest ? NEAREST_VALUE : 'future'}
            onChange={handleNearestChange}
            optionType="button"
          />
          <p className="text-xs text-landing-fg-faint">
            {nearest ? controlsT.datePage.nearestHint : controlsT.datePage.futureHint}
          </p>
        </div>

        {value !== undefined && (
          <CardFrame className="px-4 py-3">
            <MonoKicker tone="faint">{controlsT.datePage.resolvedKicker}</MonoKicker>
            <p className="mt-1 font-mono text-sm text-landing-fg">{value.toString()}</p>
          </CardFrame>
        )}
      </div>
    </section>
  );
});
