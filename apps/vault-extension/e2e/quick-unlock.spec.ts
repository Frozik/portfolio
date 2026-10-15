import type { Page, Worker } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { MASTER_PASSWORD, unlockedExtension } from './unlocked-extension';

const PIN = '2468';

/** What the test calls in the worker: the idle lock's alarm, due now. */
declare const chrome: {
  readonly alarms: { create(name: string, info: { readonly when: number }): Promise<void> };
  readonly runtime: object;
};

async function setUpPin(popup: Page): Promise<void> {
  await popup.getByTestId('popup-settings').locator('summary').click();
  const form = popup.getByTestId('quick-set-up');
  const fields = form.locator('input');
  await fields.nth(0).fill(MASTER_PASSWORD);
  await fields.nth(1).fill(PIN);
  await fields.nth(2).fill(PIN);
  await form.getByTestId('quick-set-up-submit').click();
  await expect(popup.getByTestId('quick-on')).toBeVisible();
}

/** The idle alarm fires now; the popup is opened again over the lock it made. */
async function idleLock(worker: Worker, popup: Page): Promise<void> {
  await worker.evaluate(() => chrome.alarms.create('idle-lock', { when: Date.now() }));
  await expect
    .poll(async () => {
      await popup.reload();
      return popup.getByTestId('quick-unlock').isVisible();
    })
    .toBe(true);
}

test('a PIN opens the vault the idle lock closed, without the master password', async () => {
  const { context, popup, worker } = await unlockedExtension();
  await setUpPin(popup);
  await idleLock(worker, popup);

  await popup.keyboard.type(PIN);

  await expect(popup.getByTestId('popup-settings')).toBeVisible();
  await context.close();
});

test('the lock button keeps the PIN; locking completely leaves only the master password', async () => {
  const { context, popup, worker } = await unlockedExtension();
  await setUpPin(popup);
  const popupUrl = popup.url();
  await popup.getByRole('button', { name: 'Lock' }).click();
  const reopened = await context.newPage();
  await reopened.goto(popupUrl);
  await expect(reopened.getByTestId('quick-unlock')).toBeVisible();
  // A full lock ends with the extension restarting, which an unpacked extension under test does
  // not survive; the restart is held back so the popup can show what the lock left.
  await worker.evaluate(() => {
    Object.defineProperty(chrome.runtime, 'reload', { value: () => undefined });
  });

  await reopened.getByTestId('lock-completely').click();

  await expect(reopened.getByTestId('unlock-submit')).toBeVisible();
  await expect(reopened.getByTestId('quick-unlock')).toHaveCount(0);
  await context.close();
});

test('a wrong PIN is the one try: the master password is asked for, and says why', async () => {
  const { context, popup, worker } = await unlockedExtension();
  await setUpPin(popup);
  await idleLock(worker, popup);

  await popup.keyboard.type('1111');

  await expect(popup.getByTestId('unlock-notice')).toBeVisible();
  await context.close();
});

test('the popup keeps the scheme chosen for it', async () => {
  const { context, popup } = await unlockedExtension();
  await popup.getByTestId('popup-settings').locator('summary').click();
  await popup.getByTestId('appearance').locator('input[value="dark"]').check();

  await popup.reload();

  await expect(popup.locator('main')).toHaveAttribute('data-theme', 'dark');
  await context.close();
});
