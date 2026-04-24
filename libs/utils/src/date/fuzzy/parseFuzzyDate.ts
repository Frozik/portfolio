import { isNil } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';

import { ensureFuture } from './ensure-future';
import { parseFullPipeline } from './pipeline';
import type { DateTimeParseResult } from './types';

/**
 * Parse a fuzzy date/time string and return a DateTimeParseResult.
 * Delegates to the full token-based parsing pipeline.
 * Unless the input is explicitly past-directed, results are ensured to be >= now.
 */
export function parseFuzzyDate(
  input: string,
  options: { now: Temporal.ZonedDateTime; nearest?: boolean }
): DateTimeParseResult {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return { success: false, reason: 'Empty input' };
  }

  const today = options.now.toPlainDate();
  const timeZone = options.now.timeZoneId;
  const pipelineResult = parseFullPipeline(trimmed, today, timeZone);

  if (isNil(pipelineResult)) {
    return { success: false, reason: `Cannot parse "${trimmed}"` };
  }

  const value =
    options.nearest === true
      ? pipelineResult.value
      : ensureFuture(pipelineResult.value, options.now, pipelineResult.temporality);
  return { success: true, value };
}
