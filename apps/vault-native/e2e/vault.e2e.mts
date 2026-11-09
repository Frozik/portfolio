import assert from 'node:assert/strict';
import { describe } from 'node:test';

import { defineE2eTest } from '@frozik/tooling/src/android-e2e/e2e-test.ts';
import { hideKeyboard, launchClean, screenDriver } from '@frozik/tooling/src/android-e2e/screen.ts';

import { firstWindowFlags, isSecure, PACKAGE, windowSecure } from './support/window.mts';

/** Creating a vault runs Argon2 for real: seconds on a Mac, several times that on CI's emulator. */
const JOURNEY_LIMIT_MS = 300_000;
const COLD_START_LIMIT_MS = 90_000;
const KEY_DERIVATION_MS = 120_000;
const RESTART_MS = 60_000;
/** Twelve characters, the shortest the app accepts: typing time is test time. */
const MASTER_PASSWORD = 'e2e-pass-1234';

/** The vault has no e2e channel: its views are found from the screen dump. */
const { fill, scrollIntoView, tap, waitForElement } = screenDriver();

/** Every test brings the app to the state it needs itself: nothing to prepare. */
const e2eTest = defineE2eTest(async () => {});

/** A vault created on a clean phone, locked, and opened again with its master password. */
async function createLockAndUnlock(): Promise<void> {
  await launchClean(PACKAGE);
  await tap('create-vault');
  await fill('create-name', 'Family');
  await fill('create-password', MASTER_PASSWORD);
  await hideKeyboard();
  await scrollIntoView('create-confirmation');
  await fill('create-confirmation', MASTER_PASSWORD);
  await hideKeyboard();
  await scrollIntoView('create-acknowledged');
  await tap('create-acknowledged');
  await scrollIntoView('create-submit');
  await tap('create-submit');
  await waitForElement('card-list-screen', KEY_DERIVATION_MS);
  // The lock restarts the app straight on this vault's unlock screen.
  await tap('lock');
  await waitForElement('unlock-password', RESTART_MS);
  await fill('unlock-password', MASTER_PASSWORD);
  await hideKeyboard();
  await tap('unlock-submit');
  await waitForElement('card-list-screen', KEY_DERIVATION_MS);
}

describe('the vault on a phone', () => {
  e2eTest(
    'keeps its window from screenshots from the very first frame of a cold start',
    COLD_START_LIMIT_MS,
    async () => {
      const flags = await firstWindowFlags();
      assert.ok(isSecure(flags), `the first window can be captured: ${flags}`);
    }
  );

  e2eTest(
    'creates a vault, opens it again with its master password, and lets screenshots in only while the user allows them',
    JOURNEY_LIMIT_MS,
    async () => {
      await createLockAndUnlock();
      await windowSecure(true);
      await tap('tab-settings');
      await scrollIntoView('allow-screenshots');
      await tap('allow-screenshots');
      await tap('confirm-screenshots');
      await waitForElement('block-screenshots');
      await windowSecure(false);
      await tap('block-screenshots');
      await waitForElement('allow-screenshots');
      await windowSecure(true);
    }
  );
});
