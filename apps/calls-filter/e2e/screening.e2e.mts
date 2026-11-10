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

  e2eTest(
    'turns away a stranger by the name the network sends with the call, whatever the number',
    SCREENING_LIMIT_MS,
    async () => {
      await control('create-group', {
        group: { name: 'Call centres', action: 'block', names: ['IP*'] },
      });
      const named = await control<{ readonly verdict: string }>('screen-call', {
        number: freshNumber(),
        networkName: 'IP Isanshin: kol-tsentr',
      });
      const unnamed = await control<{ readonly verdict: string }>('screen-call', {
        number: freshNumber(),
        networkName: 'Pizza Napoli',
      });
      assert.deepEqual([named.verdict, unnamed.verdict], ['rejected', 'allowed']);
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
    'a blocking group for one place is in force only there, and while the place is unknown; elsewhere its caller rings as a stranger',
    SCREENING_LIMIT_MS,
    async () => {
      const number = freshNumber();
      await control('create-group', {
        group: {
          name: 'Office spam',
          action: 'block',
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
        [atOffice, elsewhere, unknown].map(answer => `${answer.verdict} ${answer.group}`),
        ['rejected Office spam', 'passed strangers', 'rejected Office spam']
      );
    }
  );

  e2eTest(
    'a blocking group out of force during a meeting of a phone calendar lets its caller ring then, and turns them away after',
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
        group: { name: 'Spam', action: 'block', numbers: [number], exceptDuring: WORK_CALENDAR },
      });
      await meetingNow(calendarId, 'Planning', 30);
      const during = await call(number);
      await clearMeetings(calendarId);
      const after = await call(number);
      assert.deepEqual(
        [during, after].map(answer => `${answer.verdict} ${answer.group}`),
        ['passed strangers', 'rejected Spam']
      );
    }
  );
});
