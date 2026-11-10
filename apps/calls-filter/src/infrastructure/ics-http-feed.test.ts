import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Temporal } from 'temporal-polyfill';

import { ICS_HTTP_FEED } from './ics-http-feed';

const BODY = readFileSync(join(__dirname, 'fixtures', 'meetings.ics'), 'utf8');
const ZONE = 'Europe/Amsterdam';

function events() {
  return ICS_HTTP_FEED.events(
    BODY,
    Temporal.Instant.from('2026-11-01T00:00:00Z'),
    Temporal.Instant.from('2026-12-31T00:00:00Z')
  );
}

function local(instant: Temporal.Instant): string {
  return instant.toZonedDateTimeISO(ZONE).toPlainDateTime().toString().slice(0, 16);
}

describe('an iCal feed', () => {
  it('expands a weekly meeting, skips its excluded date and moves its exception', () => {
    const standups = events()
      .filter(event => event.title.startsWith('Standup'))
      .map(event => local(event.start));
    expect(standups.slice(0, 4)).toEqual([
      '2026-11-02T10:00',
      '2026-11-09T12:00',
      '2026-11-11T10:00',
      '2026-11-16T10:00',
    ]);
  });

  it('reads an all-day event by its dates', () => {
    const christmas = events().find(event => event.title === 'Christmas');
    expect(christmas?.allDay).toBe(true);
    expect(christmas?.startDate.toString()).toBe('2026-12-25');
  });

  it('leaves out a cancelled event', () => {
    expect(events().some(event => event.title === 'Cancelled')).toBe(false);
  });
});
