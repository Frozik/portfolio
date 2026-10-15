import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { FIXTURE_LOGIN, FIXTURE_PASSWORD } from './fixture-vault';
import { openFromDrive, unlock } from './open-vault';

const PHONE = { width: 390, height: 844 };

function cardRow(page: Page, title: string) {
  return page.getByTestId('card-row').filter({ has: page.locator(`text="${title}"`) });
}

// The phone's path through the real build: a second device opens the vault from Drive,
// reads a card, copies through the guard, locks by reload and comes back to the same card.
test('a vault from Drive opens on this device; a card is read, copied, locked and reopened', async ({
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await openFromDrive(context);
  await expect(page.getByTestId('favorites-strip').getByRole('link')).toHaveCount(1);

  await cardRow(page, 'Mail').click();
  const card = page.getByTestId('card');
  await expect(card.getByTestId('totp-code')).toBeVisible();
  const password = card.getByTestId('card-field').nth(1);
  await password.locator('[aria-pressed="false"]').click();
  await expect(password.locator('[aria-pressed="true"]')).toBeVisible();
  await card.getByTestId('card-field').first().locator('[data-state="idle"]').click();
  await expect(page.getByTestId('copy-snackbar')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(FIXTURE_LOGIN);
  const cardUrl = page.url();

  await page.getByTestId('lock').click();
  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
  expect(page.url()).toBe(cardUrl);
  await unlock(page);

  await expect(page.getByTestId('card')).toBeVisible();
});

test('a deep link to a card asks for the password, then opens that card', async ({ context }) => {
  const page = await openFromDrive(context);
  await cardRow(page, 'Bank').click();
  await expect(page.getByTestId('card')).toBeVisible();

  const fresh = await context.newPage();
  await fresh.goto(page.url());
  await unlock(fresh);

  await expect(fresh.getByTestId('card')).toBeVisible();
  await expect(fresh.getByTestId('card').getByRole('heading')).toHaveText('Bank');
});

test('a protected card keeps its secret until the master password opens it', async ({
  context,
}) => {
  const page = await openFromDrive(context);
  await cardRow(page, 'Safe').click();
  const secret = page.getByTestId('card').getByTestId('card-field');
  await expect(secret.getByRole('button')).toHaveCount(0);

  await page.getByTestId('open-protected').click();
  await page.getByRole('dialog').locator('input').fill(FIXTURE_PASSWORD);
  await page.getByRole('dialog').locator('input').press('Enter');

  await expect(secret.locator('[aria-pressed="false"]')).toBeVisible();
});

test('a new vault made on this device opens empty, in the scheme chosen at the start', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('appearance').getByRole('radio', { checked: true }).click();
  await page.getByTestId('appearance').locator('[data-value="light"]').click();
  await page.getByTestId('create-vault').click();
  await page.getByRole('textbox').first().fill('Personal');
  await page.locator('input[autocomplete="new-password"]').first().fill(FIXTURE_PASSWORD);
  await page.locator('input[autocomplete="new-password"]').nth(1).fill(FIXTURE_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByTestId('create-submit').click();

  await expect(page.getByTestId('no-cards')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

// The phone's own ways around: the Search tab, the sections sheet, back from a card to its list.
test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the search finds a card by its login; the sections sheet moves to another section', async ({
    context,
  }) => {
    const page = await openFromDrive(context);

    await page.getByTestId('tab-search').click();
    await expect(page.getByRole('textbox')).toBeFocused();
    await page.keyboard.type('jane@');
    await expect(page.getByTestId('card-row')).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');

    await page.getByTestId('open-sections').click();
    await page.getByTestId('section-favorites').click();
    await expect(page.getByTestId('card-row')).toHaveCount(1);
  });

  test('a card opened here comes back in the strip of cards opened lately', async ({ context }) => {
    const page = await openFromDrive(context);
    await expect(page.getByTestId('recent-strip')).toHaveCount(0);

    await cardRow(page, 'Bank').click();
    await expect(page.getByTestId('card')).toBeVisible();
    await page.getByTestId('back-to-list').click();

    await expect(page.getByTestId('recent-strip').getByRole('link')).toHaveCount(1);
  });
});
