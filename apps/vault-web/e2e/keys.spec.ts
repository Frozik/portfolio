import { expect, test } from '@playwright/test';

import { FIXTURE_PASSWORD } from './fixture-vault';
import { openFromDrive } from './open-vault';

const RECOVERY_KEY = /^[0-9A-Z]{4}(-[0-9A-Z]{4}){6}$/;

test('a recovery key made in the settings opens the vault in place of the password', async ({
  context,
}) => {
  const page = await openFromDrive(context);
  await page.getByTestId('tab-settings').click();

  await page.getByTestId('recovery-key-start').click();
  const key = (await page.getByTestId('recovery-key-value').textContent()) ?? '';
  expect(key).toMatch(RECOVERY_KEY);
  await page.getByTestId('recovery-key-saved').click();
  const confirm = page.getByTestId('recovery-key-confirm');
  await confirm
    .getByRole('textbox')
    .first()
    .fill(key.split('-').at(-1) ?? '');
  await confirm.locator('input[autocomplete="current-password"]').fill(FIXTURE_PASSWORD);
  await page.getByTestId('recovery-key-turn-on').click();
  await expect(page.getByTestId('recovery-key-on')).toBeVisible();

  await page.getByTestId('lock').click();
  await page.getByTestId('use-recovery-key').click();
  const field = page.getByTestId('recovery-key-unlock').locator('input');
  await field.fill(key);
  await field.press('Enter');

  await expect(page.getByTestId('opened-with-recovery-key')).toBeVisible();
});

// Chrome's virtual authenticator with the PRF extension stands in for Touch ID.
test('a passkey added in the settings unlocks the vault without the password', async ({
  context,
}) => {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
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
  await openFromDrive(context, page);
  await page.getByTestId('tab-settings').click();

  const passkeys = page.getByTestId('passkeys');
  const password = passkeys.locator('input[autocomplete="current-password"]');
  await password.fill(FIXTURE_PASSWORD);
  await password.press('Enter');
  await page.getByTestId('passkey-create').click();
  await expect(page.getByTestId('passkey-added')).toBeVisible();
  await page.getByTestId('tab-vault').click();

  await page.getByTestId('lock').click();
  await page.getByTestId('passkey-unlock').click();

  await expect(page.getByTestId('card-row').first()).toBeVisible();
});
