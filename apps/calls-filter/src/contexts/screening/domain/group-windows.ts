import type { IPolicy } from '../../policy/domain/policy';
import { scheduleWindows } from '../../policy/domain/schedule-windows';
import { scheduledWindows } from '../../policy/domain/scheduled-windows';
import type { TWindowSet } from '../../policy/domain/window-set';
import { ALL_TIME } from '../../policy/domain/window-set';
import { windowsOnPhoneClock } from '../../policy/domain/zone-shift';
import type { IScreeningInputs } from './screening-inputs';

/** The windows a group's scheduled action applies in, on the phone's clock; `null` without one. */
export function groupWindows(policy: IPolicy, inputs: IScreeningInputs): TWindowSet | null {
  const { scheduled } = policy;
  if (scheduled === null) {
    return null;
  }
  const base =
    scheduled.schedule === null
      ? ALL_TIME
      : windowsOnPhoneClock(
          scheduleWindows(scheduled.schedule, inputs.occurrencesOf(scheduled.schedule)),
          scheduled.schedule.zone,
          inputs.zone
        );
  return scheduledWindows(scheduled, base, rule => inputs.eventsOf(rule));
}
