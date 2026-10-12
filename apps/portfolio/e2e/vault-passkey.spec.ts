import { expect, test } from '@playwright/test';

import { waitForApp } from './app-ready';

const DEMO_PASSWORD = 'demo';

// plan task 22d — a passkey through the real WebAuthn calls of the build:
// Chrome's virtual authenticator with the PRF extension stands in for Touch ID.
test('a passkey added in the settings unlocks the vault without the password', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
      hasPrf: true,
    },
  });

  await page.goto('vault');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('option', { name: /GitHub/ })).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  const passkeys = page.getByRole('region', { name: 'Passkeys' });
  await passkeys.getByLabel('Master password', { exact: true }).fill(DEMO_PASSWORD);
  await passkeys.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create a passkey on this device' }).click();
  await expect(page.getByTestId('passkey-added')).toBeVisible();

  await page.getByRole('link', { name: 'Back to the vault' }).click();
  await page.getByRole('button', { name: 'Lock' }).click();
  await page.getByRole('button', { name: 'Unlock with a passkey' }).click();

  await expect(page.getByRole('option', { name: /GitHub/ })).toBeVisible();
});
