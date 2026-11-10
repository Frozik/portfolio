import type { Temporal } from 'temporal-polyfill';

import type { TIcsId } from './calendar-source';

/**
 * An iCal link with its last good copy. The link reads the whole calendar, so it stays on
 * this phone; an empty or broken answer never replaces the copy.
 */
export interface IIcsSubscription {
  readonly id: TIcsId;
  readonly label: string;
  readonly url: string;
  readonly body: string | null;
  readonly etag: string | null;
  readonly refreshedAt: Temporal.Instant | null;
  readonly failedAt: Temporal.Instant | null;
}

/** An answer that is no calendar at all (a login page with 200, an empty file) is a failure, not «no events». */
export function looksLikeCalendar(body: string): boolean {
  return body.includes('BEGIN:VCALENDAR');
}
