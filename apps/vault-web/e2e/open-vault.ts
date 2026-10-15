import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { routeFakeGoogle } from './fake-google';
import { aDriveWithAVault, FIXTURE_CARDS, FIXTURE_PASSWORD } from './fixture-vault';

export async function unlock(page: Page): Promise<void> {
  const password = page.locator('input[autocomplete="current-password"]');
  await password.fill(FIXTURE_PASSWORD);
  await password.press('Enter');
}

/** A second device: the fixture vault opened from a fake Drive and unlocked, its list on screen. */
export async function openFromDrive(context: BrowserContext, page?: Page): Promise<Page> {
  await routeFakeGoogle(context, await aDriveWithAVault());
  const opened = page ?? (await context.newPage());
  await opened.goto('/');
  await opened.getByTestId('open-from-cloud').click();
  await opened.getByTestId('choose-drive').click();
  await opened.getByTestId('drive-sign-in').click();
  await opened.getByTestId('open-found-vault').click();
  await unlock(opened);
  await expect(opened.getByTestId('card-row')).toHaveCount(FIXTURE_CARDS);
  return opened;
}
