import { DateTimePicker } from '@frozik/components';
import type { DayInfo } from '@frozik/utils';
import { createDateTimeParser, EDateTimeStep, EDayType, ETimeResolution } from '@frozik/utils';
import { Temporal } from '@js-temporal/polyfill';
import type { ReactNode } from 'react';
import { memo, useMemo, useState } from 'react';

import { RadioGroup } from '../../../../shared/ui';

function Kbd({ children }: { children: ReactNode }): ReactNode {
  return (
    <kbd className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text">
      {children}
    </kbd>
  );
}

const TIME_ZONE = Temporal.Now.timeZoneId();
const WEEKEND_DAYS = new Set([6, 7]);

const STEP_OPTIONS = [
  { label: 'Minute', value: EDateTimeStep.Minute },
  { label: 'Hour', value: EDateTimeStep.Hour },
  { label: 'Day', value: EDateTimeStep.Day },
  { label: 'Week', value: EDateTimeStep.Week },
];

const TIME_RESOLUTION_OPTIONS = [
  { label: 'Minutes', value: ETimeResolution.Minutes },
  { label: 'Seconds', value: ETimeResolution.Seconds },
  { label: 'Milliseconds', value: ETimeResolution.Milliseconds },
];

function getDayInfo(date: Temporal.PlainDate): DayInfo {
  if (WEEKEND_DAYS.has(date.dayOfWeek)) {
    return { type: EDayType.Weekend };
  }

  return { type: EDayType.Business };
}

export const DatePage = memo(() => {
  const [value, setValue] = useState<Temporal.ZonedDateTime | undefined>(undefined);
  const [step, setStep] = useState<EDateTimeStep>(EDateTimeStep.Day);
  const [timeResolution, setTimeResolution] = useState<ETimeResolution>(ETimeResolution.Minutes);

  const parseInput = useMemo(
    () =>
      createDateTimeParser({
        today: Temporal.Now.plainDateISO(TIME_ZONE),
        timeZone: TIME_ZONE,
      }),
    []
  );

  return (
    <section className="mx-auto max-w-2xl space-y-8 px-6 py-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-text">Date / Time Picker</h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          Smart date input with calendar popup and free-form text parsing. Use{' '}
          <kbd className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text">
            ↑
          </kbd>{' '}
          <kbd className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text">
            ↓
          </kbd>{' '}
          to step the value. Supported formats:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-text-secondary">
          <li>
            <span className="text-text-secondary">Keywords:</span> <Kbd>today</Kbd>{' '}
            <Kbd>tomorrow</Kbd> <Kbd>tom</Kbd> <Kbd>yesterday</Kbd> <Kbd>noon</Kbd>{' '}
            <Kbd>midnight</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">Boundaries:</span> <Kbd>eom</Kbd> <Kbd>bom</Kbd>{' '}
            <Kbd>eoy</Kbd> <Kbd>boy</Kbd> <Kbd>eoq</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">Weekdays:</span> <Kbd>mon</Kbd>–<Kbd>sun</Kbd>,{' '}
            <Kbd>next fri</Kbd>, <Kbd>last monday</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">Offsets:</span> <Kbd>+3d</Kbd> <Kbd>-1w</Kbd>{' '}
            <Kbd>2m</Kbd> <Kbd>1y</Kbd>, <Kbd>in 3 days</Kbd>, <Kbd>2 weeks ago</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">Dates:</span> <Kbd>2025-01-15</Kbd>{' '}
            <Kbd>15/03/2025</Kbd> <Kbd>15.03.2025</Kbd> <Kbd>15 jan 2025</Kbd> <Kbd>jan 15 25</Kbd>{' '}
            <Kbd>15 06 27</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">Months:</span> <Kbd>jan</Kbd>{' '}
            <Kbd>january 2027</Kbd> <Kbd>jan &apos;27</Kbd> <Kbd>2027-01</Kbd> <Kbd>01/2027</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">Quarters:</span> <Kbd>Q1</Kbd> <Kbd>Q2 2025</Kbd>{' '}
            <Kbd>1Q25</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">Ordinals:</span> <Kbd>15th</Kbd>{' '}
            <Kbd>the 1st</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">Time:</span> <Kbd>13:00</Kbd> <Kbd>9:30:45</Kbd>{' '}
            <Kbd>9am</Kbd> <Kbd>5:30pm</Kbd>
          </li>
          <li>
            <span className="text-text-secondary">Date + time:</span> <Kbd>tom 13:00</Kbd>{' '}
            <Kbd>mon 9am</Kbd> <Kbd>15 jan 2025 14:30</Kbd>
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
          placeholder="Type a date (tomorrow 13:00, mon 9am, 2024-01-15...)"
        />
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <span className="mb-2 block text-sm font-medium text-text">Arrow key step</span>
          <RadioGroup
            options={STEP_OPTIONS}
            value={step}
            onChange={setStep as (value: string) => void}
            optionType="button"
          />
        </div>

        <div className="space-y-3">
          <span className="mb-2 block text-sm font-medium text-text">Time precision</span>
          <RadioGroup
            options={TIME_RESOLUTION_OPTIONS}
            value={timeResolution}
            onChange={setTimeResolution as (value: string) => void}
            optionType="button"
          />
        </div>

        {value !== undefined && (
          <div className="rounded-lg border border-border bg-surface-elevated/30 px-4 py-3">
            <span className="text-xs font-medium text-text-secondary">Resolved value</span>
            <p className="mt-1 font-mono text-sm text-text">{value.toString()}</p>
          </div>
        )}
      </div>
    </section>
  );
});
