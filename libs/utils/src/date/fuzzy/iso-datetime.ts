import { Temporal } from 'temporal-polyfill';
import type { IPipelineResult } from './pipeline-result';
import { EParseTemporality } from './types';

/** The fast path for input that is already an ISO date or date-time. */
const ISO_DATE_LENGTH = 10; // "YYYY-MM-DD".length

const ISO_YEAR_SEPARATOR_INDEX = 4; // position of first '-' in ISO date

export function tryParseISODateTime(input: string, timeZone: string): IPipelineResult | undefined {
  // Quick check: ISO dates are at least 10 chars and have '-' at position 4
  if (input.length < ISO_DATE_LENGTH || input[ISO_YEAR_SEPARATOR_INDEX] !== '-') {
    return undefined;
  }

  try {
    if (input.includes('T')) {
      const zonedDateTime = Temporal.ZonedDateTime.from(`${input}[${timeZone}]`);
      return { value: zonedDateTime, temporality: EParseTemporality.ExplicitDate };
    }
    // Try ISO date "YYYY-MM-DD" (exactly 10 chars)
    if (input.length === ISO_DATE_LENGTH) {
      const date = Temporal.PlainDate.from(input);
      return {
        value: date.toZonedDateTime(timeZone),
        temporality: EParseTemporality.ExplicitDate,
      };
    }
  } catch {
    // Not valid ISO format, fall through to FSM
  }
  return undefined;
}
