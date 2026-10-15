import { expect, test } from '@playwright/test';

test('an iPhone in a browser tab is asked to install the app first, and may go on anyway', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByTestId('install-gate')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByTestId('install-gate').getByRole('button').click();

  await expect(page.getByTestId('no-vaults')).toBeVisible();
  await expect(page.getByTestId('open-from-cloud')).toBeVisible();
  const width = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(width).toBeLessThanOrEqual(0);
});

test('the start screen’s actions are touch targets of at least 44 px', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('install-gate').getByRole('button').click();

  for (const id of ['open-from-cloud', 'create-vault']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});
