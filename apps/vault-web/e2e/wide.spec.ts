import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { openFromDrive } from './open-vault';

const WIDE = { width: 1280, height: 800 };

test.use({ viewport: WIDE });

function cardRow(page: Page, title: string) {
  return page.getByTestId('card-row').filter({ has: page.locator(`text="${title}"`) });
}

test('a wide screen shows the sections, the list and the open card side by side', async ({
  context,
}) => {
  const page = await openFromDrive(context);
  await expect(page.getByTestId('section-nav')).toBeVisible();
  await expect(page.getByTestId('tab-search')).toHaveCount(0);

  await cardRow(page, 'Bank').click();
  await expect(page.getByTestId('card-pane').getByTestId('card')).toBeVisible();
  await expect(cardRow(page, 'Bank')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('recent-strip').getByRole('link')).toHaveCount(1);

  await page.getByTestId('section-favorites').click();
  await expect(page.getByTestId('card-row')).toHaveCount(1);

  await page.getByTestId('tab-settings').click();
  await expect(page.getByTestId('settings')).toBeVisible();
  await expect(page.getByTestId('section-nav')).toHaveCount(0);
});

test('a wide first screen keeps the ways to a vault as buttons beside the vaults, not phone bars', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByTestId('no-vaults')).toBeVisible();
  const create = await page.getByTestId('create-vault').boundingBox();
  expect(create?.width).toBeLessThan(WIDE.width / 4);
  const list = await page.getByTestId('no-vaults').boundingBox();
  expect(list?.x).toBeGreaterThan(WIDE.width / 3);
});
