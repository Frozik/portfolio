import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isNil } from 'lodash-es';

import { dumpViewTree, locate } from '@frozik/tooling/src/android-e2e/agent.ts';
import { adb, waitFor } from '@frozik/tooling/src/android-e2e/device.ts';
import { fill, launch, tap, waitForElement } from '@frozik/tooling/src/android-e2e/screen.ts';

import { sealTestVault, TEST_VAULT_NAME, TEST_VAULT_PASSWORD } from './test-vault.mts';

/**
 * Brings the installed app to the test vault, open: from the unlock screen it lands on after an
 * update, from the list of vaults when it lands on another vault's (the e2e flows make their own),
 * or — on a phone that does not know the vault yet — through Android's file chooser.
 */
const PACKAGE = 'io.github.ciphravault.vault';
const FILE_NAME = 'test-vault.pwv';
const PHONE_FILE = `/sdcard/Download/${FILE_NAME}`;
const SCREEN_MS = 30_000;
/** Argon2 at the floor still takes seconds on an emulator. */
const UNLOCK_MS = 120_000;

const ENTRY_SCREENS = ['card-list-screen', 'unlock-password', 'quick-unlock', 'start'] as const;
type TEntryScreen = (typeof ENTRY_SCREENS)[number];

async function entryScreen(): Promise<TEntryScreen> {
  const found = await waitFor(
    'the app to show a screen',
    async () => {
      for (const id of ENTRY_SCREENS) {
        if ((await locate(id)) !== null) {
          return id;
        }
      }
      return null;
    },
    screen => screen !== null,
    SCREEN_MS
  );
  if (isNil(found)) {
    throw new Error('no screen');
  }
  return found;
}

async function pushTestVault(): Promise<void> {
  const local = join(mkdtempSync(join(tmpdir(), 'test-vault-')), FILE_NAME);
  writeFileSync(local, await sealTestVault());
  await adb('push', local, PHONE_FILE);
  await adb(
    'shell',
    'am',
    'broadcast',
    '-a',
    'android.intent.action.MEDIA_SCANNER_SCAN_FILE',
    '-d',
    `file://${PHONE_FILE}`
  );
}

/** Where another app shows a text, as the middle of its bounds; `null` while it does not. */
async function textCenter(text: string): Promise<readonly [number, number] | null> {
  const node = (await dumpViewTree())
    .split('<node ')
    .find(candidate => candidate.includes(` text="${text}"`));
  const bounds = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (isNil(bounds)) {
    return null;
  }
  const [left, top, right, bottom] = bounds.slice(1).map(Number);
  return [Math.round((left + right) / 2), Math.round((top + bottom) / 2)];
}

/** The chooser opens on its recent files, where a file just pushed is first. */
async function openFromChooser(): Promise<void> {
  await pushTestVault();
  await tap('open-file');
  const center = await waitFor(
    `${FILE_NAME} in the file chooser`,
    () => textCenter(FILE_NAME),
    found => found !== null,
    SCREEN_MS
  );
  if (isNil(center)) {
    throw new Error(`${FILE_NAME} is not in the file chooser`);
  }
  await adb('shell', 'input', 'tap', String(center[0]), String(center[1]));
}

/** The start screen's row of the test vault, or the file chooser for a phone that lost it. */
async function chooseTestVault(): Promise<void> {
  const row = await textCenter(TEST_VAULT_NAME);
  if (isNil(row)) {
    await openFromChooser();
    return;
  }
  await adb('shell', 'input', 'tap', String(row[0]), String(row[1]));
  await waitForElement('unlock-password', { timeoutMs: SCREEN_MS });
}

await launch(PACKAGE);
const screen = await entryScreen();
if (screen !== 'card-list-screen') {
  const anotherVault = screen !== 'start' && isNil(await textCenter(TEST_VAULT_NAME));
  if (anotherVault) {
    await tap('all-vaults');
    await waitForElement('start', { timeoutMs: SCREEN_MS });
  }
  if (screen === 'start' || anotherVault) {
    await chooseTestVault();
  } else if (screen === 'quick-unlock') {
    await tap('use-master-password');
  }
  await fill('unlock-password', TEST_VAULT_PASSWORD);
  await tap('unlock-submit');
  await waitForElement('card-list-screen', { timeoutMs: UNLOCK_MS });
}
