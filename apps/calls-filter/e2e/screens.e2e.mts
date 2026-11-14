import assert from 'node:assert/strict';
import { describe } from 'node:test';

import { locate } from '@frozik/tooling/src/android-e2e/agent.ts';
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
import { control, PACKAGE } from './support/channel.mts';
import { hasPhysicalKeyboard, hideKeyboard, keyboardTop } from './support/keyboard.mts';
import { AMSTERDAM, NEW_YORK, phoneAt } from './support/location.mts';
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
    readonly conditions: { readonly places: readonly IPlaceState[] } | null;
  }>('group', { groupName });
  return group.conditions?.places[0];
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
      // A test provider sends one fix per call, and the app may ask after the last one: keep it coming.
      await waitFor(
        'a fix in Amsterdam for the place',
        async () => {
          await phoneAt(AMSTERDAM);
          return locate('place-save');
        },
        button => button?.enabled === true,
        PLACE_SETTLE_MS
      );
      await tap('place-save');
      const saved = await waitFor(
        'the place, measured in Amsterdam',
        async () => {
          await phoneAt(AMSTERDAM);
          return placeOf('Work');
        },
        place => place?.here === true,
        PLACE_SETTLE_MS
      );
      assert.equal(saved?.name, 'Office');
      await phoneAt(NEW_YORK);
      await adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
      await launch(PACKAGE);
      await waitFor(
        'the place, measured again in New York once the app is in front',
        async () => {
          await phoneAt(NEW_YORK);
          return placeOf('Work');
        },
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
    'a blocking group switched off from the button a left swipe on its row uncovers lets its caller ring as a stranger',
    SCREEN_LIMIT_MS,
    async () => {
      const number = freshNumber();
      const { id } = await control<{ readonly id: string }>('create-group', {
        group: { name: 'Spam', action: 'block', numbers: [number] },
      });
      await launch(PACKAGE);
      const row = await waitForElement(`group-${id}`, { timeoutMs: APP_START_MS });
      const y = String(Math.round((row.top + row.bottom) / 2));
      await adb(
        'shell',
        'input',
        'swipe',
        String(row.right - SWIPE_INSET_PX),
        y,
        String(row.left + SWIPE_INSET_PX),
        y,
        String(SWIPE_MS)
      );
      await tap(`group-switch-${id}`);
      await waitForElement(`group-dot-off-${id}`);
      const answer = await call(number);
      assert.deepEqual([answer.verdict, answer.group], ['passed', 'strangers']);
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
          control<{ readonly conditions: { readonly calendars: readonly string[] } | null }>(
            'group',
            { groupName: 'Clients' }
          ),
        group => (group.conditions?.calendars.length ?? 0) > 0,
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
