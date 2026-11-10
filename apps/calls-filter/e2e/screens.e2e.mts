import assert from 'node:assert/strict';
import { describe } from 'node:test';

import { adb, waitFor } from '@frozik/tooling/src/android-e2e/device.ts';
import {
  fill,
  launch,
  openLink,
  scrollIntoView,
  tap,
  tapUntilGone,
  waitForAbsent,
  waitForElement,
} from '@frozik/tooling/src/android-e2e/screen.ts';

import { clearMeetings, ensureWorkCalendar, meetingNow } from './support/calendar.mts';
import { appReady, control, PACKAGE } from './support/channel.mts';
import { hasPhysicalKeyboard, hideKeyboard, keyboardTop } from './support/keyboard.mts';
import { NEW_YORK, phoneAt } from './support/location.mts';
import type { IScreenedCall } from './support/phone.mts';
import { call, e2eTest, freshNumber } from './support/phone.mts';

/** A screen test: about twenty seconds on a Mac, two or three times that on CI's emulator. */
const SCREEN_LIMIT_MS = 240_000;
/** A cold start takes 6–10 s on a Mac; a hung app never shows its first  */
const APP_START_MS = 60_000;
/** The app measures a place when it is saved and again when it comes to the front. */
const PLACE_SETTLE_MS = 30_000;
/** What the app does after a command (a migration at start, the service told a new term) lands within seconds. */
const CONTROL_SETTLE_MS = 30_000;
/** A right swipe starts this far inside the row, clear of the screen's back gesture at its edge. */
const SWIPE_INSET_PX = 60;
const SWIPE_MS = 400;
const MEETING_MINUTES = 30;
const NO_ON_SCREEN_KEYBOARD =
  'the phone has a physical keyboard, so no on-screen one opens (an emulator with hw.keyboard=yes)';
const BOOK_VERSION = 2;
const PREFERENCES_VERSION = 1;
const CALENDARS_VERSION = 1;
const TEAM_LINK = {
  id: 'e2e-team',
  label: 'Team',
  url: 'https://calendar.example.com/team.ics',
  body: null,
  etag: null,
  refreshedAt: null,
  failedAt: null,
};

interface IStored<T> {
  readonly version: number;
  readonly data: T;
}

async function documentOf(key: string): Promise<string> {
  const { text } = await control<{ readonly text: string | null }>('document', { key });
  assert.ok(text !== null, `the app keeps no «${key}»`);
  return text;
}

async function openGroup(name: string): Promise<{ readonly id: string }> {
  const created = await control<{ readonly id: string }>('create-group', {
    group: { name, action: 'block' },
  });
  await openLink(`callsfilter://group/${created.id}`, PACKAGE);
  await waitForElement(`group-screen-${created.id}`, { timeoutMs: APP_START_MS });
  return created;
}

interface IPlaceState {
  readonly name: string;
  readonly here: boolean | null;
}

async function placeOf(groupName: string): Promise<IPlaceState | undefined> {
  const group = await control<{
    readonly scheduled: { readonly places: readonly IPlaceState[] } | null;
  }>('group', { groupName });
  return group.scheduled?.places[0];
}

describe('the screens that only a phone can show', () => {
  e2eTest(
    'takes a place from where the phone is, and knows when it has left',
    SCREEN_LIMIT_MS,
    async () => {
      const { id } = await control<{ readonly id: string }>('create-group', {
        group: { name: 'Work', action: 'pass' },
      });
      await openLink(`callsfilter://place?group=${id}`, PACKAGE);
      await fill('place-name', 'Office');
      await tap('place-here');
      await tap('place-save');
      const saved = await waitFor(
        'the place, measured in Amsterdam',
        () => placeOf('Work'),
        place => place?.here === true,
        PLACE_SETTLE_MS
      );
      assert.equal(saved?.name, 'Office');
      await phoneAt(NEW_YORK);
      await adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
      await launch(PACKAGE);
      await waitFor(
        'the place, measured again in New York once the app is in front',
        () => placeOf('Work'),
        place => place?.here === false,
        PLACE_SETTLE_MS
      );
    }
  );

  e2eTest(
    'asks for the call history it lost, and stops asking once Android grants it',
    SCREEN_LIMIT_MS,
    async () => {
      await adb('shell', 'pm', 'revoke', PACKAGE, 'android.permission.READ_CALL_LOG');
      try {
        await launch(PACKAGE);
        await waitForElement('permission-sheet', { timeoutMs: APP_START_MS });
        await waitForElement('permission-step-call-log');
        await tap('permission-allow');
        await tapUntilGone('com.android.permissioncontroller:id/permission_allow_button');
        await waitForAbsent('permission-sheet');
        await waitForElement('groups-screen');
      } finally {
        await adb('shell', 'pm', 'grant', PACKAGE, 'android.permission.READ_CALL_LOG');
      }
    }
  );

  e2eTest(
    'a group of the user’s own, swiped right on its row, uncovers the delete button, and a tap on it deletes the group',
    SCREEN_LIMIT_MS,
    async () => {
      const { id } = await control<{ readonly id: string }>('create-group', {
        group: { name: 'Couriers', action: 'pass' },
      });
      await launch(PACKAGE);
      const row = await waitForElement(`group-${id}`, { timeoutMs: APP_START_MS });
      const y = String(Math.round((row.top + row.bottom) / 2));
      await adb(
        'shell',
        'input',
        'swipe',
        String(row.left + SWIPE_INSET_PX),
        y,
        String(row.right - SWIPE_INSET_PX),
        y,
        String(SWIPE_MS)
      );
      await tap(`group-delete-${id}`);
      await waitForAbsent(`group-${id}`);
    }
  );

  e2eTest(
    'a sheet with a field (renaming a group) rises above the keyboard: the field and its button stay above it',
    SCREEN_LIMIT_MS,
    async context => {
      if (await hasPhysicalKeyboard()) {
        context.skip(NO_ON_SCREEN_KEYBOARD);
        return;
      }
      await openGroup('Couriers');
      await tap('group-rename');
      await tap('group-name');
      const top = await keyboardTop();
      const field = await waitForElement('group-name');
      const save = await waitForElement('group-name-save');
      await hideKeyboard();
      assert.ok(
        field.bottom <= top,
        `the field ends at ${field.bottom}, the keyboard starts at ${top}`
      );
      assert.ok(
        save.bottom <= top,
        `the button ends at ${save.bottom}, the keyboard starts at ${top}`
      );
    }
  );

  e2eTest(
    'a field low on a screen (a group’s SMS reply) scrolls up above the keyboard',
    SCREEN_LIMIT_MS,
    async context => {
      if (await hasPhysicalKeyboard()) {
        context.skip(NO_ON_SCREEN_KEYBOARD);
        return;
      }
      await openGroup('Meetings');
      await tap('group-tab-rules');
      await scrollIntoView('group-sms');
      await tap('group-sms');
      await tap('auto-reply');
      const top = await keyboardTop();
      const field = await waitForElement('auto-reply');
      await hideKeyboard();
      assert.ok(
        field.bottom <= top,
        `the field ends at ${field.bottom}, the keyboard starts at ${top}`
      );
    }
  );

  e2eTest(
    'the sheet of what a group does closes on the way to the schedule and is not there on the way back',
    SCREEN_LIMIT_MS,
    async () => {
      await openGroup('Work');
      await tap('group-status');
      await waitForElement('policy-sheet');
      await tap('add-schedule');
      await waitForElement('schedule-save');
      await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
      await waitForElement('group-status');
      await waitForAbsent('policy-sheet');
    }
  );

  e2eTest(
    'a long group name ends in an ellipsis before the status button: the title’s right edge is left of the button’s',
    SCREEN_LIMIT_MS,
    async () => {
      await openGroup('Deliveries, couriers and everyone else who rings the doorbell at noon');
      const title = await waitForElement('group-rename');
      const status = await waitForElement('group-status');
      assert.ok(
        title.right <= status.left,
        `the title ends at ${title.right}, the status starts at ${status.left}`
      );
    }
  );

  e2eTest(
    'the screening service keeps its journal for the term chosen in Settings, not a fixed 90 days',
    SCREEN_LIMIT_MS,
    async () => {
      await openLink('callsfilter://diagnostics', PACKAGE);
      await tap('diagnostics-journal-days');
      await tap('journal-days-30');
      await waitFor(
        'the service to keep its journal for 30 days',
        () => control<{ readonly days: number }>('journal-days'),
        answer => answer.days === 30,
        CONTROL_SETTLE_MS
      );
      await tap('diagnostics-journal-days');
      await tap('journal-days-90');
      await waitFor(
        'the service to keep its journal for 90 days again',
        () => control<{ readonly days: number }>('journal-days'),
        answer => answer.days === 90,
        CONTROL_SETTLE_MS
      );
    }
  );

  e2eTest(
    'an update installed over an older app keeps its groups, preferences and iCal links, migrated',
    SCREEN_LIMIT_MS,
    async () => {
      await control('create-group', { group: { name: 'Couriers', action: 'pass' } });
      const book = await documentOf('group-book');
      const preferences = await documentOf('preferences');
      const groups = (JSON.parse(book) as IStored<{ readonly groups: readonly unknown[] }>).data
        .groups;
      await control('write-document', {
        key: 'group-book',
        text: JSON.stringify({ schema: 1, groups }),
      });
      await control('write-document', {
        key: 'preferences',
        text: JSON.stringify((JSON.parse(preferences) as IStored<unknown>).data),
      });
      await control('write-document', {
        key: 'calendars',
        text: JSON.stringify({ subscriptions: [TEAM_LINK] }),
      });
      await adb('shell', 'am', 'force-stop', PACKAGE);
      await appReady();
      const migrated = await waitFor(
        'the documents written back at their current version',
        async () => ({
          book: JSON.parse(await documentOf('group-book')) as IStored<unknown>,
          preferences: JSON.parse(await documentOf('preferences')) as IStored<unknown>,
          calendars: JSON.parse(await documentOf('calendars')) as IStored<{
            readonly subscriptions: readonly { readonly label: string }[];
          }>,
        }),
        documents =>
          documents.book.version === BOOK_VERSION &&
          documents.preferences.version === PREFERENCES_VERSION &&
          documents.calendars.version === CALENDARS_VERSION,
        CONTROL_SETTLE_MS
      );
      const couriers = await control<{ readonly name: string }>('group', {
        groupName: 'Couriers',
      });
      assert.equal(couriers.name, 'Couriers');
      assert.deepEqual(
        migrated.calendars.data.subscriptions.map(subscription => subscription.label),
        ['Team']
      );
    }
  );

  e2eTest(
    'a blocking group given a calendar on its screen blocks during the events and lets calls through after',
    SCREEN_LIMIT_MS,
    async () => {
      const calendarId = await ensureWorkCalendar();
      await clearMeetings(calendarId);
      await control('device-calendars');
      const number = freshNumber();
      const { id } = await control<{ readonly id: string }>('create-group', {
        group: { name: 'Clients', action: 'block', numbers: [number] },
      });
      await meetingNow(calendarId, 'Planning', MEETING_MINUTES);
      await openLink(`callsfilter://calendars?group=${id}`, PACKAGE);
      await tap(`calendar-device-${calendarId}-only`);
      await waitFor(
        'the group to use the calendar',
        () =>
          control<{ readonly scheduled: { readonly calendars: readonly string[] } | null }>(
            'group',
            { groupName: 'Clients' }
          ),
        group => (group.scheduled?.calendars.length ?? 0) > 0,
        CONTROL_SETTLE_MS
      );
      let during: IScreenedCall;
      try {
        during = await call(number);
      } finally {
        await clearMeetings(calendarId);
      }
      const after = await call(number);
      assert.deepEqual([during.verdict, after.verdict], ['rejected', 'passed']);
    }
  );
});
