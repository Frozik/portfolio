import { expect, test } from '@playwright/test';

import { FIXTURE_CARDS } from './fixture-vault';
import { openFromDrive, unlock } from './open-vault';

test('an opened vault reloads and unlocks with the network gone', async ({ context }) => {
  const page = await openFromDrive(context);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);

  await page.reload();
  await unlock(page);

  await expect(page.getByTestId('card-row')).toHaveCount(FIXTURE_CARDS);
  await context.setOffline(false);
});
