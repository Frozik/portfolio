import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { FIXTURE_PASSWORD } from './fixture-vault';
import { openFromDrive } from './open-vault';

/** Past the default five idle minutes and the next fifteen-second check. */
const IDLE_PAST_LOCK = '05:30';
const PIN = '2468';

async function withQuickPin(page: Page): Promise<void> {
  await page.getByTestId('tab-settings').click();
  const panel = page.getByTestId('quick-unlock-panel');
  await panel.getByTestId('quick-unlock-set-up').click();
  const password = panel.locator('input[type="password"]');
  await password.fill(FIXTURE_PASSWORD);
  await password.press('Enter');
  await panel.getByTestId('quick-unlock-kinds').locator('[data-kind="pin"]').click();
  for (const step of ['enter', 'confirm']) {
    const pin = panel.locator(`[data-testid="quick-unlock-entry"][data-state="${step}"] input`);
    await pin.fill(PIN);
    await pin.press('Enter');
  }
  await expect(panel.getByTestId('quick-unlock-status')).toHaveAttribute('data-state', 'pin');
  await page.getByTestId('tab-vault').click();
  await page.clock.fastForward(IDLE_PAST_LOCK);
  await expect(page.getByTestId('quick-unlock')).toBeVisible();
}

test('a PIN opens a vault the idle lock closed, without the master password', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.clock.install();
  await openFromDrive(context, page);
  await withQuickPin(page);

  await page.keyboard.type(PIN);

  await expect(page.getByTestId('card-row').first()).toBeVisible();
});

test('a wrong code is the one try: the master password is asked for, and says why', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.clock.install();
  await openFromDrive(context, page);
  await withQuickPin(page);

  await page.keyboard.type('1111');

  await expect(page.getByTestId('unlock-notice')).toBeVisible();
  await expect(page.getByTestId('quick-unlock')).toBeHidden();
});
