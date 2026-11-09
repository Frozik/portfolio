import type { TCountryCode } from '../../phone/domain/dialing-region';
import type { IPolicy } from '../../policy/domain/policy';
import { scheduleWindows, timeWindow } from '../../policy/domain/schedule-windows';
import { scheduledWindows, withHolidays } from '../../policy/domain/scheduled-windows';
import type { TWindowSet } from '../../policy/domain/window-set';
import { ALL_TIME, normalizeWindows } from '../../policy/domain/window-set';
import { windowsOnPhoneClock } from '../../policy/domain/zone-shift';
import type { IScreeningInputs } from './screening-inputs';

function holidayDates(inputs: IScreeningInputs, country: TCountryCode | null) {
  return country === null ? [] : (inputs.holidaysByCountry.get(country) ?? []);
}

/** The holidays of a country as whole-day windows: what a `holidays-here` calendar rule reads. */
function holidayWindows(inputs: IScreeningInputs, country: TCountryCode | null): TWindowSet {
  return normalizeWindows(
    holidayDates(inputs, country).map(date => timeWindow(date, { kind: 'all-day' }))
  );
}

/** The windows a group's scheduled action applies in, where the phone is now; `null` without one. */
export function groupWindows(
  policy: IPolicy,
  inputs: IScreeningInputs,
  networkCountry: TCountryCode | null
): TWindowSet | null {
  const { scheduled } = policy;
  if (scheduled === null) {
    return null;
  }
  const base =
    scheduled.schedule === null
      ? ALL_TIME
      : windowsOnPhoneClock(
          withHolidays(
            scheduled.schedule,
            scheduleWindows(scheduled.schedule, inputs.occurrencesOf(scheduled.schedule)),
            { dates: holidayDates(inputs, networkCountry) }
          ),
          scheduled.schedule.zone,
          inputs.zone
        );
  return scheduledWindows(scheduled, base, rule =>
    rule.source.kind === 'holidays-here'
      ? holidayWindows(inputs, networkCountry)
      : inputs.eventsOf(rule)
  );
}
