import { conditionWindows } from '../../policy/domain/condition-windows';
import type { IPolicy } from '../../policy/domain/policy';
import { scheduleWindows } from '../../policy/domain/schedule-windows';
import type { TWindowSet } from '../../policy/domain/window-set';
import { ALL_TIME } from '../../policy/domain/window-set';
import { windowsOnPhoneClock } from '../../policy/domain/zone-shift';
import type { IScreeningInputs } from './screening-inputs';

/** When a group's conditions allow by the clock, on the phone's clock; `null` without conditions. */
export function groupWindows(policy: IPolicy, inputs: IScreeningInputs): TWindowSet | null {
  const { conditions } = policy;
  if (conditions === null) {
    return null;
  }
  const base =
    conditions.schedule === null
      ? ALL_TIME
      : windowsOnPhoneClock(
          scheduleWindows(conditions.schedule, inputs.occurrencesOf(conditions.schedule)),
          conditions.schedule.zone,
          inputs.zone
        );
  return conditionWindows(conditions, base, rule => inputs.eventsOf(rule));
}
