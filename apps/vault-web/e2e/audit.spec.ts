import { expect, test } from '@playwright/test';

import { openFromDrive } from './open-vault';

const TWO_FACTOR_DIRECTORY = 'https://api.2fa.directory/v4/totp.json';

test('the audit finds the weak password reused on two cards', async ({ context }) => {
  await context.route(TWO_FACTOR_DIRECTORY, route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([['Mail', { domain: 'mail.example', tfa: ['totp'] }]]),
    })
  );
  const page = await openFromDrive(context);

  await page.getByTestId('tab-audit').click();

  await expect(page.getByTestId('two-factor-directory')).toHaveAttribute('data-state', 'loaded');
  await expect(page.getByRole('link', { name: 'Forum' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Shop' }).first()).toBeVisible();
});
