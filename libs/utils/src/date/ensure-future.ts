import { Temporal } from '@js-temporal/polyfill';

import { assertNever } from '../assert';
import { EParseTemporality } from './types';

const DAYS_IN_WEEK = 7;
const MAX_ADVANCES = 2;

export function ensureFuture(
  value: Temporal.ZonedDateTime,
  now: Temporal.ZonedDateTime,
  temporality: EParseTemporality
): Temporal.ZonedDateTime {
  if (Temporal.ZonedDateTime.compare(value, now) >= 0) {
    return value;
  }

  const advance = getAdvanceDuration(temporality);
  if (advance === undefined) {
    return value;
  }

  let result = value;
  for (let i = 0; i < MAX_ADVANCES; i++) {
    result = result.add(advance);
    if (Temporal.ZonedDateTime.compare(result, now) >= 0) {
      return result;
    }
  }
  return result;
}

function getAdvanceDuration(temporality: EParseTemporality): Temporal.DurationLike | undefined {
  switch (temporality) {
    case EParseTemporality.TimeOnly:
    case EParseTemporality.KeywordTime:
      return { days: 1 };
    case EParseTemporality.Weekday:
      return { days: DAYS_IN_WEEK };
    case EParseTemporality.DayOfMonth:
      return { months: 1 };
    case EParseTemporality.MonthDay:
    case EParseTemporality.MonthOnly:
    case EParseTemporality.Quarter:
      return { years: 1 };
    case EParseTemporality.PastDirected:
    case EParseTemporality.ExplicitDate:
    case EParseTemporality.FutureDirected:
    case EParseTemporality.Boundary:
      return undefined;
    default:
      assertNever(temporality);
  }
}
