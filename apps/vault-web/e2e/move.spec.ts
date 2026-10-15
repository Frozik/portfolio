import { createFakeDriveServer } from '@frozik/cloud-storage/google-drive/fake-drive-server.test-helper';
import { expect, test } from '@playwright/test';

import { routeFakeGoogle } from './fake-google';

const PORTFOLIO_VAULT = 'http://localhost:4173/portfolio/vault';
const DEMO_PASSWORD = 'demo';

// The two sites share no storage: a vault moves through the user's own cloud.
test('a vault of the portfolio moves to Ciphra Vault through Google Drive with its cards', async ({
  context,
}) => {
  await routeFakeGoogle(context, createFakeDriveServer());
  const portfolio = await context.newPage();
  await portfolio.goto(PORTFOLIO_VAULT);
  await portfolio.getByTestId('try-demo').click();
  await expect(portfolio.getByRole('option').first()).toBeVisible();
  const vaultRoot = new URL(portfolio.url()).pathname.split('/').slice(0, 4).join('/');
  await portfolio.goto(`http://localhost:4173${vaultRoot}/settings`);
  const unlock = portfolio.locator('input[autocomplete="current-password"]');
  await unlock.fill(DEMO_PASSWORD);
  await unlock.press('Enter');
  await portfolio.getByTestId('choose-drive').click();
  await portfolio.getByTestId('drive-sign-in').click();
  await portfolio.getByTestId('keep-here').click();
  await expect(portfolio.getByTestId('cloud-location')).toHaveAttribute(
    'data-state',
    'google-drive'
  );

  const ciphra = await context.newPage();
  await ciphra.goto('/');
  await ciphra.getByTestId('open-from-cloud').click();
  await ciphra.getByTestId('choose-drive').click();
  await ciphra.getByTestId('drive-sign-in').click();
  await ciphra.getByTestId('open-found-vault').click();
  await ciphra.locator('input[autocomplete="current-password"]').fill(DEMO_PASSWORD);
  await ciphra.locator('input[autocomplete="current-password"]').press('Enter');

  await expect(ciphra.getByTestId('card-row').first()).toBeVisible();
});
