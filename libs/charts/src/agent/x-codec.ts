import { parseFuzzyDate } from '@frozik/utils/date/fuzzy/parseFuzzyDate';
import { getNowInstant } from '@frozik/utils/date/now';
import { Temporal } from 'temporal-polyfill';

/** How an agent writes and reads a position along X: text in, text out, the axis type hidden. */
export interface IXCodec<TX> {
  /** What a position looks like, for the tool descriptions. */
  readonly format: string;
  parse(text: string): TX | undefined;
  print(position: TX): string;
}

/**
 * Time as `bigint` nanoseconds, told to the agent as local date-times in `timeZone`.
 * Reads anything the date picker reads — ISO as well as "last monday 10:00" — and
 * takes an ambiguous day as the nearest one, since a chart looks back more than ahead.
 */
export function timeCodec(timeZone: string): IXCodec<bigint> {
  return {
    format: `a date-time in ${timeZone}: ISO ("2026-03-14", "2026-03-14T15:30") or plain words ("yesterday 10:00", "3 days ago")`,
    parse: text => {
      const result = parseFuzzyDate(text, { now: getNowInstant(), timeZone, nearest: true });
      return result.success ? result.value.epochNanoseconds : undefined;
    },
    print: position =>
      Temporal.Instant.fromEpochNanoseconds(position)
        .toZonedDateTimeISO(timeZone)
        .toPlainDateTime()
        .toString({ smallestUnit: 'second' }),
  };
}

export const numberCodec: IXCodec<number> = {
  format: 'a number, e.g. "1250.5"',
  parse: text => {
    const trimmed = text.trim();
    const value = Number(trimmed);
    return trimmed.length === 0 || !Number.isFinite(value) ? undefined : value;
  },
  print: position => String(position),
};
