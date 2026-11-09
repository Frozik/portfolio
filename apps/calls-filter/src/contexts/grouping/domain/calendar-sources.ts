import { uniqWith } from 'lodash-es';

import type { TCalendarSource } from '../../calendars/domain/calendar-source';
import { sameCalendarSource } from '../../calendars/domain/calendar-source';
import type { GroupBook } from './group-book';

/** Every calendar some group's policy looks at, each once. */
export function calendarSourcesOf(book: GroupBook): readonly TCalendarSource[] {
  return uniqWith(
    book.groups.flatMap(group => group.policy.scheduled?.calendars.map(rule => rule.source) ?? []),
    sameCalendarSource
  );
}
