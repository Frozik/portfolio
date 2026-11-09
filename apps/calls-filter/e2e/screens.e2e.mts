import assert from 'node:assert/strict';
import { describe } from 'node:test';

import { adb, waitFor } from '@frozik/tooling/src/android-e2e/device.ts';
import {
  fill,
  launch,
  openLink,
  tap,
  tapUntilGone,
  waitForAbsent,
  waitForElement,
} from '@frozik/tooling/src/android-e2e/screen.ts';

import { control, PACKAGE } from './support/channel.mts';
import { NEW_YORK, phoneAt } from './support/location.mts';
import { e2eTest } from './support/phone.mts';

/** A screen test: about twenty seconds on a Mac, two or three times that on CI's emulator. */
const SCREEN_LIMIT_MS = 240_000;
/** A cold start takes 6–10 s on a Mac; a hung app never shows its first  */
const APP_START_MS = 60_000;
/** The app measures a place when it is saved and again when it comes to the front. */
const PLACE_SETTLE_MS = 30_000;

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
      await adb('shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1');
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
});
