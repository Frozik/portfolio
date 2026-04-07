import type { Temporal } from '@js-temporal/polyfill';

import { assertNever } from '../assert';

import { EDateTimeStep } from './types';

function getDuration(step: EDateTimeStep): Temporal.DurationLike {
  switch (step) {
    case EDateTimeStep.Minute:
      return { minutes: 1 };
    case EDateTimeStep.Hour:
      return { hours: 1 };
    case EDateTimeStep.Day:
      return { days: 1 };
    case EDateTimeStep.Week:
      return { weeks: 1 };
    default:
      assertNever(step);
  }
}

/**
 * Step a ZonedDateTime forward or backward by the given unit.
 * Direction: 1 = forward, -1 = backward.
 */
export function stepDateTime(
  value: Temporal.ZonedDateTime,
  step: EDateTimeStep,
  direction: 1 | -1
): Temporal.ZonedDateTime {
  const duration = getDuration(step);

  if (direction === 1) {
    return value.add(duration);
  }

  return value.subtract(duration);
}
