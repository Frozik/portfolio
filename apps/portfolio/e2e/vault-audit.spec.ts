import { expect, test } from '@playwright/test';

import { waitForApp } from './app-ready';

const TWO_FACTOR_DIRECTORY = 'https://api.2fa.directory/v4/totp.json';

// plan task 23 — the audit through the real build: zxcvbn in its Worker, the
// 2FA list (answered by the test), the "Problem passwords" group.
test('the demo vault’s audit finds its weak and its reused password', async ({ page }) => {
  await page.route(TWO_FACTOR_DIRECTORY, route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([['GitHub', { domain: 'github.com', tfa: ['totp'] }]]),
    })
  );
  await page.goto('vault');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('option', { name: /GitHub/ })).toBeVisible();

  await page.getByRole('link', { name: /^Audit/ }).click();

  await expect(page.getByRole('heading', { name: /^Weak · / })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Reused on several sites · / })).toBeVisible();
  await expect(page.getByTestId('two-factor-directory')).toHaveAttribute('data-state', 'loaded');
});
