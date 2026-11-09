import assert from 'node:assert/strict';
import { describe } from 'node:test';

import {
  clearMeetings,
  ensureWorkCalendar,
  meetingNow,
  WORK_CALENDAR,
} from './support/calendar.mts';
import { control } from './support/channel.mts';
import { call, e2eTest, freshNumber } from './support/phone.mts';

/** Seeding, a few real calls and their answers: a hang, not a slow emulator, runs past this. */
const SCREENING_LIMIT_MS = 90_000;

describe('the screening service on real calls', () => {
  e2eTest(
    'lets a stranger ring and files the call under «Strangers»',
    SCREENING_LIMIT_MS,
    async () => {
      const answer = await call(freshNumber());
      assert.deepEqual([answer.verdict, answer.group], ['passed', 'strangers']);
    }
  );

  e2eTest('turns away a number a blocking group holds', SCREENING_LIMIT_MS, async () => {
    const number = freshNumber();
    await control('create-group', { group: { name: 'Spam', action: 'block', numbers: [number] } });
    const answer = await call(number);
    assert.deepEqual([answer.verdict, answer.group], ['rejected', 'Spam']);
  });

  e2eTest(
    'lets a repeat ring once «a repeat call rings» is on for the filter',
    SCREENING_LIMIT_MS,
    async () => {
      const number = freshNumber();
      await control('create-group', {
        group: { name: 'Spam', action: 'block', numbers: [number] },
      });
      await control('set-filter-repeat', { repeat: 'always' });
      const first = await call(number);
      const second = await call(number);
      assert.deepEqual([first.verdict, second.verdict], ['awaiting-repeat', 'passed-as-repeat']);
    }
  );

  e2eTest(
    'lets a group for one place through only there, and decides without it when unknown',
    SCREENING_LIMIT_MS,
    async () => {
      const number = freshNumber();
      await control('create-group', {
        group: {
          name: 'Work',
          action: 'pass',
          numbers: [number],
          onlyAt: {
            id: 'office',
            name: 'Office',
            latitude: 52.3676,
            longitude: 4.9041,
            radius: 500,
          },
        },
      });
      await control('set-at-place', { place: 'office', inside: true });
      const atOffice = await call(number);
      await control('set-at-place', { place: 'office', inside: false });
      const elsewhere = await call(number);
      await control('set-at-place', { place: 'office', inside: null });
      const unknown = await call(number);
      assert.deepEqual(
        [atOffice.verdict, elsewhere.verdict, unknown.verdict],
        ['passed', 'rejected', 'passed']
      );
    }
  );

  e2eTest(
    'turns calls away during a meeting of a phone calendar, and lets them through after',
    SCREENING_LIMIT_MS,
    async () => {
      const calendarId = await ensureWorkCalendar();
      await clearMeetings(calendarId);
      const seen = await control<readonly (typeof WORK_CALENDAR)[]>('device-calendars');
      assert.ok(
        seen.some(calendar => calendar.calendarName === WORK_CALENDAR.calendarName),
        'the app lists the phone calendar'
      );
      const number = freshNumber();
      await control('create-group', {
        group: { name: 'Work', action: 'pass', numbers: [number], exceptDuring: WORK_CALENDAR },
      });
      await meetingNow(calendarId, 'Planning', 30);
      const during = await call(number);
      await clearMeetings(calendarId);
      const after = await call(number);
      assert.deepEqual([during.verdict, after.verdict], ['rejected', 'passed']);
    }
  );
});
