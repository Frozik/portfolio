import { isNil } from 'lodash-es';

import { assert } from '../../assert/assert';
import { isValidTimeZoneId } from '../time-zone';
import { tokenize } from './lexer/tokenize';
import { resolve } from './resolution/resolve';
import { scoreCandidates } from './scoring/score-candidates';
import type { DateTimeParseResult, IParseContext } from './types';

export interface IParseFuzzyDateOptions extends IParseContext {
  /** Keeps the occurrence of today even when its time has passed: "13:00" asked at 14:00 stays today. */
  readonly nearest?: boolean;
}

/**
 * Reads a date or time written the way people type it: "tom 13:00", "15 jan", "+3d", "eom".
 *
 * The text goes through three layers: the lexer cuts it into tokens, scoring weighs every bare
 * number against the slots it could fill, resolution settles the slots and completes the moment
 * from `now`. What is left untold recurs — "15th" comes every month, "13:00" every day — and the
 * first occurrence not yet past is taken.
 */
export function parseFuzzyDate(
  input: string,
  { now, timeZone, nearest = false }: IParseFuzzyDateOptions
): DateTimeParseResult {
  assert(isValidTimeZoneId(timeZone), `parseFuzzyDate: unknown time zone "${timeZone}"`);

  const text = input.trim();
  if (text.length === 0) {
    return { success: false, reason: 'Empty input' };
  }

  const tokens = tokenize(text);
  const value = resolve(tokens, scoreCandidates(tokens), {
    now: now.toZonedDateTimeISO(timeZone),
    nearest,
  });

  return isNil(value)
    ? { success: false, reason: `Cannot parse "${text}"` }
    : { success: true, value };
}
