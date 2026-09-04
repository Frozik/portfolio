import { assert } from '@frozik/utils/assert/assert';
import { isNil, minBy } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';

export interface ICareerEntry {
  readonly start: Temporal.PlainDate;
}

export function getYearsOfExperience(
  careerStart: Temporal.PlainDate,
  today: Temporal.PlainDate
): number {
  return today.since(careerStart, { smallestUnit: 'years', largestUnit: 'years' }).years;
}

export function findEarliestStart(entries: readonly ICareerEntry[]): Temporal.PlainDate {
  const earliest = minBy(entries, entry => entry.start.toString());
  assert(!isNil(earliest), 'career needs at least one entry');
  return earliest.start;
}
